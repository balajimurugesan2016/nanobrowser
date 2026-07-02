import { t } from '@extension/i18n';
import type { BatchActionItem } from '@extension/storage';
import type { ComputerActionInput } from './types';

export function formatComputerActionLabel(input: ComputerActionInput): Pick<BatchActionItem, 'label' | 'detail'> {
  const action = input.action;

  switch (action) {
    case 'screenshot':
      return { label: t('chat_navigator_capturingPage') };
    case 'left_click':
    case 'right_click':
    case 'middle_click':
      return {
        label: t('act_label_clicking'),
        detail: input.text ?? (input.coordinate ? `(${input.coordinate[0]}, ${input.coordinate[1]})` : undefined),
      };
    case 'double_click':
    case 'triple_click':
      return {
        label: t('act_label_clicking'),
        detail: input.coordinate ? `(${input.coordinate[0]}, ${input.coordinate[1]})` : undefined,
      };
    case 'type':
      return { label: t('act_label_typing'), detail: input.text ? `"${input.text}"` : undefined };
    case 'key': {
      const keyText = input.text ?? input.key ?? '';
      if (keyText.toLowerCase() === 'return' || keyText.toLowerCase() === 'enter') {
        return { label: t('act_label_pressingReturn') };
      }
      return { label: t('act_label_pressingKey'), detail: keyText };
    }
    case 'scroll':
      return {
        label: t('act_label_scrolling'),
        detail: input.text
          ? `"${input.text}"`
          : input.scroll_direction
            ? `${input.scroll_direction} x${input.scroll_amount ?? 1}`
            : undefined,
      };
    case 'wait':
      return { label: t('act_label_waiting'), detail: input.duration ? `${input.duration}s` : undefined };
    case 'mouse_move':
      return {
        label: t('act_label_movingMouse'),
        detail: input.coordinate ? `(${input.coordinate[0]}, ${input.coordinate[1]})` : undefined,
      };
    default:
      return { label: action };
  }
}

export function buildComputerBatchActionItems(actions: ComputerActionInput[]): BatchActionItem[] {
  return actions
    .filter(action => action.action !== 'screenshot')
    .map(action => ({
      ...formatComputerActionLabel(action),
      status: 'pending' as const,
    }));
}

/** Screenshot-only tool batches have no batch card; use a dedicated capture event instead. */
export function shouldEmitCapturePageForComputerUse(displayActionCount: number): boolean {
  return displayActionCount === 0;
}
