import { OPENROUTER_DEFAULT_BASE_URL } from '@extension/storage';
import {
  isRetiredOpenRouterComputerUseModel,
  getOpenRouterComputerUseReplacementModel,
} from '@extension/storage/lib/settings/visionModels';
import { createLogger } from '@src/background/log';
import { resolveComputerUseVersion, type ComputerUseVersion } from './computerUseVersion';
import { buildComputerUseSystemPrompt, buildOpenRouterComputerUseTool } from './computerUseToolSchema';
import {
  COMPUTER_USE_TOOL_NAME,
  type AnthropicMessage,
  type AnthropicMessageContentBlock,
  type AnthropicMessagesResponse,
  type ComputerToolUseBlock,
  type ComputerUseConfig,
} from './types';

export {
  resolveComputerUseVersion,
  COMPUTER_USE_VERSION_LEGACY,
  COMPUTER_USE_VERSION_LATEST,
  type ComputerUseVersion,
} from './computerUseVersion';

export const OPENROUTER_MESSAGES_PATH = '/messages';

const logger = createLogger('OpenRouterAnthropicClient');

export function getOpenRouterMessagesUrl(baseUrl?: string): string {
  const normalized = (baseUrl || OPENROUTER_DEFAULT_BASE_URL).replace(/\/$/, '');
  if (normalized.endsWith('/v1')) {
    return `${normalized}${OPENROUTER_MESSAGES_PATH}`;
  }
  return `${normalized}/v1${OPENROUTER_MESSAGES_PATH}`;
}

export function buildComputerUseTool(
  viewportWidth: number,
  viewportHeight: number,
  version: ComputerUseVersion = resolveComputerUseVersion(''),
) {
  return buildOpenRouterComputerUseTool(viewportWidth, viewportHeight, version);
}

export function buildInitialUserMessage(
  task: string,
  currentUrl?: string,
  screenshotBase64?: string,
  quotedTargets: string[] = [],
): AnthropicMessage {
  const lines = [task];
  if (currentUrl) {
    lines.push('', `The browser is already open at: ${currentUrl}`);
  }
  if (quotedTargets.length > 0) {
    lines.push('', `Target labels from the task: ${quotedTargets.join(', ')}`);
    lines.push('Prefer left_click with the text field set to the exact target label.');
  }
  lines.push('', 'The attached screenshot shows the current viewport. Scroll if a target is not visible.');
  const text = lines.join('\n');

  if (!screenshotBase64) {
    return {
      role: 'user',
      content: text,
    };
  }

  return {
    role: 'user',
    content: [
      { type: 'text', text },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: screenshotBase64,
        },
      },
    ],
  };
}

export function buildToolResultContentBlocks(
  screenshotBase64: string,
  outputText?: string,
): AnthropicMessageContentBlock[] {
  if (outputText) {
    return [
      { type: 'text', text: outputText },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: screenshotBase64,
        },
      },
    ];
  }

  return [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: screenshotBase64,
      },
    },
  ];
}

export function buildToolResultMessage(
  toolUseId: string,
  screenshotBase64: string,
  outputText?: string,
): AnthropicMessage {
  return {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: buildToolResultContentBlocks(screenshotBase64, outputText),
      },
    ],
  };
}

export interface ComputerToolResultPayload {
  toolUseId: string;
  screenshotBase64: string;
  outputText?: string;
}

export function buildCombinedToolResultsMessage(results: ComputerToolResultPayload[]): AnthropicMessage {
  return {
    role: 'user',
    content: results.map(result => ({
      type: 'tool_result',
      tool_use_id: result.toolUseId,
      content: buildToolResultContentBlocks(result.screenshotBase64, result.outputText),
    })),
  };
}

export function buildContinuationUserMessage(
  currentUrl: string,
  screenshotBase64: string,
  task?: string,
  extraInstruction?: string,
  plannerNextSteps?: string | null,
): AnthropicMessage {
  const lines = [
    extraInstruction ?? 'Continue the task from the current browser state using the computer tool.',
    `Current page: ${currentUrl}`,
  ];
  if (plannerNextSteps) {
    lines.push('', 'Planner next steps:', plannerNextSteps);
  }
  if (task) {
    lines.push('', 'Full task:', task);
  }
  lines.push(
    '',
    'Use left_click.text for link labels and left_click.text "checkbox 1" for the first checkbox.',
    'Do not use address-bar shortcuts (ctrl/cmd+l), F6, or browser zoom keys unless recovering from a wrong page.',
  );

  return {
    role: 'user',
    content: [
      { type: 'text', text: lines.join('\n') },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: screenshotBase64,
        },
      },
    ],
  };
}

export function messagesEndWithUser(messages: AnthropicMessage[]): boolean {
  return messages.length === 0 || messages[messages.length - 1].role === 'user';
}

export function buildAssistantMessage(content: AnthropicMessageContentBlock[]): AnthropicMessage {
  return {
    role: 'assistant',
    content,
  };
}

export function parseComputerToolUses(response: AnthropicMessagesResponse): ComputerToolUseBlock[] {
  if (!response.content) {
    return [];
  }

  return response.content
    .filter(
      (block): block is ComputerToolUseBlock => block.type === 'tool_use' && block.name === COMPUTER_USE_TOOL_NAME,
    )
    .map(block => ({
      type: 'tool_use',
      id: block.id,
      name: block.name,
      input: block.input ?? { action: 'screenshot' },
    }));
}

export function buildMessagesRequestBody(
  config: Pick<ComputerUseConfig, 'modelName' | 'viewportWidth' | 'viewportHeight'>,
  messages: AnthropicMessage[],
  maxTokens = 4096,
) {
  const version = resolveComputerUseVersion(config.modelName);
  return {
    model: config.modelName,
    max_tokens: maxTokens,
    system: buildComputerUseSystemPrompt(config.viewportWidth, config.viewportHeight),
    provider: {
      order: ['Anthropic'],
      allow_fallbacks: false,
    },
    tools: [buildComputerUseTool(config.viewportWidth, config.viewportHeight, version)],
    messages,
  };
}

function formatMessagesApiError(payload: AnthropicMessagesResponse, status: number): string {
  const raw = payload.error?.metadata?.raw;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as
        | { error?: { message?: string } }
        | Array<{ message?: string; path?: Array<string | number> }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const details = parsed
          .map(issue => {
            const path = issue.path?.length ? `${issue.path.join('.')}: ` : '';
            return `${path}${issue.message ?? 'validation error'}`;
          })
          .join('; ');
        if (details) {
          return details;
        }
      }
      if (!Array.isArray(parsed) && parsed.error?.message) {
        return parsed.error.message;
      }
    } catch {
      return raw;
    }
    return raw;
  }
  return payload.error?.message || `OpenRouter Messages API error: ${status}`;
}

export interface OpenRouterAnthropicClientOptions {
  config: ComputerUseConfig;
  fetchImpl?: typeof fetch;
}

export class OpenRouterAnthropicClient {
  private readonly config: ComputerUseConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenRouterAnthropicClientOptions) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async createMessages(messages: AnthropicMessage[], maxTokens = 4096): Promise<AnthropicMessagesResponse> {
    if (isRetiredOpenRouterComputerUseModel(this.config.modelName)) {
      const replacementModel = getOpenRouterComputerUseReplacementModel(this.config.modelName);
      throw new Error(
        `Model ${this.config.modelName} no longer supports Anthropic Computer Use on OpenRouter. Reload the extension, then set Navigator to ${replacementModel} in settings.`,
      );
    }

    const url = getOpenRouterMessagesUrl(this.config.baseUrl);
    const version = resolveComputerUseVersion(this.config.modelName);
    if (!messagesEndWithUser(messages)) {
      throw new Error('Computer use conversation must end with a user message before calling the model.');
    }
    const body = buildMessagesRequestBody(this.config, messages, maxTokens);

    logger.info('OpenRouter Messages request', {
      model: this.config.modelName,
      toolType: version.toolType,
      toolFormat: 'custom',
      betaHeader: version.betaHeader,
      messageCount: messages.length,
      url,
    });

    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-beta': version.betaHeader,
        'anthropic-version': '2023-06-01',
        'HTTP-Referer': 'https://sap-browser-automation.local',
        'X-Title': 'SAP Browser Automation',
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as AnthropicMessagesResponse;

    if (!response.ok) {
      const errorMessage = formatMessagesApiError(payload, response.status);
      logger.error('OpenRouter Messages API error', {
        status: response.status,
        model: this.config.modelName,
        toolType: version.toolType,
        betaHeader: version.betaHeader,
        error: errorMessage,
        payload,
      });
      throw new Error(errorMessage);
    }

    return payload;
  }
}
