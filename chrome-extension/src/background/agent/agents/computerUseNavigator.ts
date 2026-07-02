import { HumanMessage } from '@langchain/core/messages';
import { t } from '@extension/i18n';
import type { BatchActionItem, MessageMetadata } from '@extension/storage';
import { createLogger } from '@src/background/log';
import { ActionResult, type AgentContext, type AgentOutput } from '../types';
import { Actors, ExecutionState } from '../event/types';
import type { NavigatorPrompt } from '../prompts/navigator';
import type { NavigatorResult } from './navigator';
import type { AgentStepRecord } from '../history';
import {
  ChatModelAuthError,
  ChatModelBadRequestError,
  ChatModelForbiddenError,
  isAuthenticationError,
  isBadRequestError,
  isForbiddenError,
  LLM_FORBIDDEN_ERROR_MESSAGE,
  RequestCancelledError,
  isAbortedError,
} from './errors';
import { buildComputerActionFeedback } from '../computer-use/actionFeedback';
import { prepareComputerUseTab } from '../computer-use/prepareComputerUseTab';
import { evaluateNumberedTaskProgress, type ComputerUseSnapshot } from '../computer-use/taskProgress';
import { extractQuotedTargetTexts } from '../computer-use/taskUrl';
import { URLNotAllowedError } from '@src/background/browser/views';
import { BrowserHarness } from '../computer-use/browserHarness';
import {
  buildComputerBatchActionItems,
  shouldEmitCapturePageForComputerUse,
} from '../computer-use/computerActionLabels';
import {
  buildAssistantMessage,
  buildCombinedToolResultsMessage,
  buildContinuationUserMessage,
  buildInitialUserMessage,
  messagesEndWithUser,
  OpenRouterAnthropicClient,
  parseComputerToolUses,
} from '../computer-use/openRouterAnthropicClient';
import type { AnthropicMessage, ComputerUseConfig } from '../computer-use/types';

const logger = createLogger('ComputerUseNavigator');

export interface ComputerUseNavigatorOptions {
  context: AgentContext;
  config: ComputerUseConfig;
  prompt: NavigatorPrompt;
  task: string;
  client?: OpenRouterAnthropicClient;
}

export class ComputerUseNavigator {
  private readonly context: AgentContext;
  private readonly config: ComputerUseConfig;
  private readonly prompt: NavigatorPrompt;
  private readonly client: OpenRouterAnthropicClient;
  private readonly task: string;
  private computerMessages: AnthropicMessage[] = [];
  private initialized = false;
  private screenshotCount = 0;
  private recentActions: string[] = [];

  constructor(options: ComputerUseNavigatorOptions) {
    this.context = options.context;
    this.config = options.config;
    this.prompt = options.prompt;
    this.client = options.client ?? new OpenRouterAnthropicClient({ config: options.config });
    this.task = options.task;
  }

  public async addStateMessageToMemory(): Promise<void> {
    if (this.context.stateMessageAdded) {
      return;
    }

    const messageManager = this.context.messageManager;
    if (this.context.actionResults.length > 0) {
      let index = 0;
      for (const r of this.context.actionResults) {
        if (r.includeInMemory) {
          if (r.extractedContent) {
            messageManager.addMessageWithTokens(new HumanMessage(`Action result: ${r.extractedContent}`));
          }
          if (r.error) {
            const errorText = r.error.toString().trim();
            const lastLine = errorText.split('\n').pop() || '';
            messageManager.addMessageWithTokens(new HumanMessage(`Action error: ${lastLine}`));
          }
          this.context.actionResults[index] = new ActionResult();
        }
        index++;
      }
    }

    const page = await this.context.browserContext.getCurrentPage();
    const title = await page.title();
    const snapshot = this.getSnapshot();
    const checkboxStates = await page.getCheckboxStates();
    const progress = evaluateNumberedTaskProgress(this.task, page.url(), snapshot, checkboxStates);
    const stateDescription = `[Task history memory ends]
[Current state starts here]
Computer use mode: the navigator uses screenshots and the computer tool, not DOM element indices like [1] or [2].
Current tab: {url: ${page.url()}, title: ${title}}
User task: ${this.task}
${this.context.plannerNextSteps ? `Planner next steps: ${this.context.plannerNextSteps}` : ''}
Task progress:
${progress.summaryLines.map(line => `- ${line}`).join('\n')}
Navigator guidance: use left_click.text for link labels, left_click.text "checkbox 1" for the first checkbox, then screenshot.`;

    messageManager.addStateMessage(new HumanMessage(stateDescription));
    this.context.stateMessageAdded = true;
  }

  private getSnapshot(): ComputerUseSnapshot {
    return {
      screenshotCount: this.screenshotCount,
      recentActions: [...this.recentActions],
    };
  }

  private syncSnapshotToContext(): void {
    this.context.computerUseSnapshot = this.getSnapshot();
  }

  private recordAction(summary: string): void {
    this.recentActions.push(summary);
    if (this.recentActions.length > 12) {
      this.recentActions.shift();
    }
  }

  private recordScreenshot(): void {
    this.screenshotCount += 1;
  }

  private async assistPendingCheckboxStep(harness: BrowserHarness, page: Page): Promise<void> {
    if (!/first checkbox/i.test(this.task) || !page.url().includes('/checkboxes')) {
      return;
    }

    const checkboxStates = await page.getCheckboxStates();
    if (checkboxStates.find(box => box.index === 1)?.checked) {
      return;
    }

    const note = await harness.executeAction({ action: 'left_click', text: 'checkbox 1' });
    this.recordAction(note ?? 'left_click checkbox 1');
  }

  private removeLastStateMessageFromMemory(): void {
    if (!this.context.stateMessageAdded) {
      return;
    }
    this.context.messageManager.removeLastStateMessage();
    this.context.stateMessageAdded = false;
  }

  async execute(): Promise<AgentOutput<NavigatorResult>> {
    const agentOutput: AgentOutput<NavigatorResult> = {
      id: 'computer-use-navigator',
    };

    let cancelled = false;

    try {
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.STEP_START, 'Navigating...');

      if (this.context.paused || this.context.stopped) {
        cancelled = true;
        return agentOutput;
      }

      const tabId = this.context.browserContext.getCurrentTabId();
      if (!tabId) {
        throw new Error(t('bg_errors_noTabId'));
      }

      if (!this.initialized) {
        await prepareComputerUseTab(this.context.browserContext, tabId, this.task);
      } else {
        await this.context.browserContext.ensureComputerUsePage(tabId);
      }

      const page = await this.context.browserContext.getCurrentPage();
      const harness = new BrowserHarness({
        page,
        viewportWidth: this.config.viewportWidth,
        viewportHeight: this.config.viewportHeight,
      });

      if (!this.initialized) {
        const quotedTargets = extractQuotedTargetTexts(this.task);
        for (const target of quotedTargets) {
          try {
            await page.scrollToText(target);
          } catch {
            // Best-effort pre-scroll for off-screen quoted targets.
          }
        }

        this.computerMessages = [
          buildInitialUserMessage(this.task, page.url(), await harness.takeScreenshot(), quotedTargets),
        ];
        this.initialized = true;
      }

      await this.assistPendingCheckboxStep(harness, page);

      const maxInnerTurns = Math.max(this.context.options.maxActionsPerStep, 1);
      let turn = 0;

      while (turn < maxInnerTurns) {
        if (this.context.paused || this.context.stopped) {
          cancelled = true;
          return agentOutput;
        }

        const response = await this.client.createMessages(await this.prepareMessagesForModel(harness, page));
        const toolUses = parseComputerToolUses(response);

        if (response.content && response.content.length > 0) {
          this.computerMessages.push(buildAssistantMessage(response.content));
        }

        if (toolUses.length === 0) {
          if (turn + 1 < maxInnerTurns) {
            const screenshot = await harness.takeScreenshot();
            this.computerMessages.push(
              buildContinuationUserMessage(
                page.url(),
                screenshot,
                this.task,
                'The task is not finished. Continue with the computer tool for the remaining steps.',
                this.context.plannerNextSteps,
              ),
            );
            turn++;
            continue;
          }
          break;
        }

        const batchInputs = toolUses.map(toolUse => toolUse.input);
        const batchActions = buildComputerBatchActionItems(batchInputs);

        if (batchActions.length > 0) {
          await this.emitBatchStart(batchActions);
        }

        let batchScreenshot: string | undefined;
        let displayIndex = 0;
        const actionNotes = new Map<string, string>();

        for (const toolUse of toolUses) {
          if (this.context.paused || this.context.stopped) {
            cancelled = true;
            return agentOutput;
          }

          const isDisplayAction = toolUse.input.action !== 'screenshot';

          if (isDisplayAction && batchActions.length > 0) {
            batchActions[displayIndex] = { ...batchActions[displayIndex], status: 'running' };
            await this.emitBatchProgress(batchActions, displayIndex);
          }

          try {
            if (toolUse.input.action !== 'screenshot') {
              const note = await harness.executeAction(toolUse.input);
              if (note) {
                actionNotes.set(toolUse.id, note);
                this.recordAction(note);
              }
            }
            if (isDisplayAction && batchActions.length > 0) {
              batchActions[displayIndex] = { ...batchActions[displayIndex], status: 'done' };
              displayIndex++;
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Computer action failed: ${errorMessage}`);
            if (isDisplayAction && batchActions.length > 0) {
              batchActions[displayIndex] = { ...batchActions[displayIndex], status: 'failed' };
            }
            batchScreenshot = await harness.takeScreenshot();
            const pageUrl = page.url();
            const pageTitle = await page.title();
            const failedIndex = toolUses.findIndex(candidate => candidate.id === toolUse.id);
            const errorResults = toolUses.slice(0, failedIndex + 1).map((candidate, index) => ({
              toolUseId: candidate.id,
              screenshotBase64: batchScreenshot!,
              outputText:
                index === failedIndex
                  ? `Error: ${errorMessage}`
                  : buildComputerActionFeedback(actionNotes.get(candidate.id), pageUrl, pageTitle),
            }));
            this.computerMessages.push(buildCombinedToolResultsMessage(errorResults));
            throw error;
          }
        }

        const tab = await chrome.tabs.get(tabId);
        page.syncFromTab(tab);
        batchScreenshot = await harness.takeScreenshot();
        const pageUrl = page.url();
        const pageTitle = await page.title();

        await this.emitPageScreenshotUi(batchActions, batchScreenshot, pageUrl);
        this.recordScreenshot();

        this.computerMessages.push(
          buildCombinedToolResultsMessage(
            toolUses.map(candidate => ({
              toolUseId: candidate.id,
              screenshotBase64: batchScreenshot!,
              outputText: buildComputerActionFeedback(actionNotes.get(candidate.id), pageUrl, pageTitle),
            })),
          ),
        );

        turn++;
      }

      this.removeLastStateMessageFromMemory();
      this.syncSnapshotToContext();
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.STEP_OK, 'Navigation done');
      agentOutput.result = { done: false };
      return agentOutput;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (isAuthenticationError(error)) {
        throw new ChatModelAuthError(errorMessage, error);
      }
      if (isBadRequestError(error)) {
        throw new ChatModelBadRequestError(errorMessage, error);
      }
      if (isAbortedError(error)) {
        throw new RequestCancelledError(errorMessage);
      }
      if (isForbiddenError(error)) {
        throw new ChatModelForbiddenError(LLM_FORBIDDEN_ERROR_MESSAGE, error);
      }
      if (error instanceof URLNotAllowedError) {
        throw error;
      }

      logger.error(`Computer use navigation failed: ${errorMessage}`);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.STEP_FAIL, `Navigation failed: ${errorMessage}`);
      agentOutput.error = errorMessage;
      return agentOutput;
    } finally {
      if (cancelled) {
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.STEP_CANCEL, 'Navigation cancelled');
      }
    }
  }

  private async prepareMessagesForModel(
    harness: BrowserHarness,
    page: Awaited<ReturnType<AgentContext['browserContext']['getCurrentPage']>>,
  ): Promise<AnthropicMessage[]> {
    if (!messagesEndWithUser(this.computerMessages)) {
      const screenshot = await harness.takeScreenshot();
      this.computerMessages.push(
        buildContinuationUserMessage(page.url(), screenshot, this.task, undefined, this.context.plannerNextSteps),
      );
    }

    return this.computerMessages;
  }

  private buildBatchMetadata(
    batchActions: BatchActionItem[],
    currentIndex?: number,
    screenshot?: string,
  ): MessageMetadata {
    const total = batchActions.length;
    const current = currentIndex !== undefined ? currentIndex + 1 : 0;
    return {
      batchActions,
      batchCurrent: current,
      batchTotal: total,
      toolName: 'browser_batch',
      screenshot,
    };
  }

  private async emitBatchStart(batchActions: BatchActionItem[]): Promise<void> {
    const metadata = this.buildBatchMetadata(batchActions);
    await this.context.emitEvent(
      Actors.NAVIGATOR,
      ExecutionState.BATCH_START,
      t('chat_navigator_batchHeader', [`${batchActions.length}`, `${batchActions.length}`]),
      metadata,
    );
  }

  private async emitBatchProgress(
    batchActions: BatchActionItem[],
    actionIndex: number,
    screenshot?: string,
  ): Promise<void> {
    const metadata = this.buildBatchMetadata(batchActions, actionIndex, screenshot);
    await this.context.emitEvent(
      Actors.NAVIGATOR,
      ExecutionState.BATCH_PROGRESS,
      t('chat_navigator_batchHeader', [`${actionIndex + 1}`, `${batchActions.length}`]),
      metadata,
    );
  }

  private async emitBatchOk(batchActions: BatchActionItem[], screenshot?: string, pageUrl?: string): Promise<void> {
    const doneActions = batchActions.map(a => ({ ...a, status: 'done' as const }));
    const metadata: MessageMetadata = {
      ...this.buildBatchMetadata(doneActions, batchActions.length - 1, screenshot),
      ...(pageUrl ? { pageUrl } : {}),
    };
    await this.context.emitEvent(
      Actors.NAVIGATOR,
      ExecutionState.BATCH_OK,
      t('chat_navigator_batchHeader', [`${batchActions.length}`, `${batchActions.length}`]),
      metadata,
    );
  }

  private async emitPageCapture(screenshot: string, pageUrl?: string): Promise<void> {
    const metadata: MessageMetadata = {
      screenshot,
      toolName: 'browser_batch',
      ...(pageUrl ? { pageUrl } : {}),
    };
    await this.context.emitEvent(
      Actors.NAVIGATOR,
      ExecutionState.CAPTURE_PAGE,
      t('chat_navigator_capturingPage'),
      metadata,
    );
  }

  private async emitPageScreenshotUi(
    batchActions: BatchActionItem[],
    screenshot: string,
    pageUrl?: string,
  ): Promise<void> {
    if (shouldEmitCapturePageForComputerUse(batchActions.length)) {
      await this.emitPageCapture(screenshot, pageUrl);
      return;
    }

    await this.emitBatchOk(batchActions, screenshot, pageUrl);
  }

  async executeHistoryStep(
    _historyItem: AgentStepRecord,
    _stepIndex: number,
    _totalSteps: number,
  ): Promise<ActionResult[]> {
    throw new Error('History replay is not supported in computer use mode');
  }
}
