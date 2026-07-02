import { t } from '@extension/i18n';
import { createLogger } from '@src/background/log';
import type Page from '../../browser/page';
import type { ComputerActionInput } from './types';
import { parseCheckboxTarget } from './clickTargets';

const logger = createLogger('BrowserHarness');

export interface BrowserHarnessOptions {
  page: Page;
  viewportWidth: number;
  viewportHeight: number;
}

export class BrowserHarness {
  private readonly page: Page;
  private readonly viewportWidth: number;
  private readonly viewportHeight: number;

  constructor(options: BrowserHarnessOptions) {
    this.page = options.page;
    this.viewportWidth = options.viewportWidth;
    this.viewportHeight = options.viewportHeight;
  }

  private async prepareViewport(): Promise<void> {
    await this.page.ensureComputerUseViewport(this.viewportWidth, this.viewportHeight);
  }

  async takeScreenshot(): Promise<string> {
    await this.prepareViewport();
    return this.page.takeComputerUseScreenshot(this.viewportWidth, this.viewportHeight);
  }

  async executeAction(input: ComputerActionInput): Promise<string | undefined> {
    await this.prepareViewport();
    const action = input.action;

    switch (action) {
      case 'screenshot':
        return this.takeScreenshot();
      case 'left_click':
        if (input.text) {
          const checkboxIndex = parseCheckboxTarget(input.text);
          if (checkboxIndex) {
            return this.page.clickNthCheckbox(checkboxIndex);
          }
          return this.page.clickTextTarget(input.text);
        }
        if (!input.coordinate) {
          throw new Error(t('act_errors_computerUseMissingCoordinate'));
        }
        await this.page.clickAtCoordinate(input.coordinate[0], input.coordinate[1], 1, 'left');
        await this.page.waitComputerUse(0.3);
        return `Clicked at (${input.coordinate[0]}, ${input.coordinate[1]}).`;
      case 'right_click':
        if (!input.coordinate) {
          throw new Error(t('act_errors_computerUseMissingCoordinate'));
        }
        await this.page.clickAtCoordinate(input.coordinate[0], input.coordinate[1], 1, 'right');
        await this.page.waitComputerUse(0.3);
        return undefined;
      case 'middle_click':
        if (!input.coordinate) {
          throw new Error(t('act_errors_computerUseMissingCoordinate'));
        }
        await this.page.clickAtCoordinate(input.coordinate[0], input.coordinate[1], 1, 'middle');
        await this.page.waitComputerUse(0.3);
        return undefined;
      case 'double_click':
        if (!input.coordinate) {
          throw new Error(t('act_errors_computerUseMissingCoordinate'));
        }
        await this.page.clickAtCoordinate(input.coordinate[0], input.coordinate[1], 2, 'left');
        await this.page.waitComputerUse(0.3);
        return undefined;
      case 'triple_click':
        if (!input.coordinate) {
          throw new Error(t('act_errors_computerUseMissingCoordinate'));
        }
        await this.page.clickAtCoordinate(input.coordinate[0], input.coordinate[1], 3, 'left');
        await this.page.waitComputerUse(0.3);
        return undefined;
      case 'left_click_drag':
        if (!input.start_coordinate || !input.end_coordinate) {
          throw new Error(t('act_errors_computerUseMissingCoordinate'));
        }
        await this.page.dragMouseBetween(input.start_coordinate, input.end_coordinate, 'left');
        await this.page.waitComputerUse(0.3);
        return undefined;
      case 'left_mouse_down':
        if (!input.coordinate) {
          throw new Error(t('act_errors_computerUseMissingCoordinate'));
        }
        await this.page.setMouseButtonState('left', 'down', input.coordinate);
        await this.page.waitComputerUse(0.1);
        return undefined;
      case 'left_mouse_up':
        await this.page.setMouseButtonState('left', 'up', input.coordinate);
        await this.page.waitComputerUse(0.1);
        return undefined;
      case 'hold_key': {
        const holdKey = input.text ?? input.key;
        if (!holdKey) {
          throw new Error(t('act_errors_computerUseMissingKey'));
        }
        await this.page.holdComputerKey(holdKey, input.duration ?? 1);
        return undefined;
      }
      case 'type':
        if (!input.text) {
          throw new Error(t('act_errors_computerUseMissingText'));
        }
        await this.page.typeComputerText(input.text);
        await this.page.waitComputerUse(0.2);
        return undefined;
      case 'key': {
        const key = input.text ?? input.key;
        if (!key) {
          throw new Error(t('act_errors_computerUseMissingKey'));
        }
        await this.page.pressComputerKey(key);
        await this.page.waitComputerUse(0.3);
        return undefined;
      }
      case 'scroll':
        if (input.text) {
          const found = await this.page.scrollToText(input.text);
          await this.page.waitComputerUse(0.3);
          return found
            ? `Scrolled "${input.text}" into view.`
            : `Could not find "${input.text}" yet. Scroll down further or try again.`;
        }
        await this.page.scrollComputerUse(input.scroll_direction ?? 'down', input.scroll_amount ?? 3);
        await this.page.waitComputerUse(0.3);
        return undefined;
      case 'zoom':
        if (input.region) {
          await this.page.zoomComputerUseRegion(input.region, this.viewportHeight);
        } else {
          await this.page.scrollComputerUse('down', input.scroll_amount ?? 3);
        }
        await this.page.waitComputerUse(0.3);
        return undefined;
      case 'wait':
        await this.page.waitComputerUse(input.duration ?? 1);
        return undefined;
      case 'mouse_move':
        if (input.coordinate) {
          await this.page.moveMouseToCoordinate(input.coordinate[0], input.coordinate[1]);
        }
        await this.page.waitComputerUse(0.1);
        return undefined;
      default:
        logger.warning(`Unsupported computer action: ${action}`);
        return undefined;
    }
  }
}
