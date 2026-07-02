import { t } from '@extension/i18n';
import type { BatchActionItem } from '@extension/storage';

/**
 * Parse planner next_steps into a list of plan step strings.
 */
export function parsePlanSteps(nextSteps: string): string[] {
  return nextSteps
    .split('\n')
    .map(line =>
      line
        .replace(/^\s*[-*•]\s*/, '')
        .replace(/^\s*\d+[\).\s]+/, '')
        .trim(),
    )
    .filter(line => line.length > 0);
}

/**
 * Format a browser action into a human-readable label for batch UI display.
 */
export function formatActionLabel(
  actionName: string,
  args: Record<string, unknown>,
): Pick<BatchActionItem, 'label' | 'detail'> {
  const intent = typeof args.intent === 'string' ? args.intent : undefined;

  switch (actionName) {
    case 'go_to_url':
      return { label: t('act_label_navigating'), detail: String(args.url ?? '') };
    case 'search_google':
      return { label: t('act_label_searching'), detail: String(args.query ?? '') };
    case 'click_element': {
      const lowerIntent = intent?.toLowerCase() ?? '';
      if (lowerIntent.includes('find') || lowerIntent.includes('search bar') || lowerIntent.includes('search box')) {
        return { label: t('act_label_finding'), detail: intent };
      }
      return { label: t('act_label_clicking'), detail: intent };
    }
    case 'input_text':
      return { label: t('act_label_typing'), detail: `"${String(args.text ?? '')}"` };
    case 'send_keys': {
      const keys = String(args.keys ?? args.key ?? '');
      if (keys.toLowerCase() === 'enter' || keys.toLowerCase() === 'return') {
        return { label: t('act_label_pressingReturn') };
      }
      return { label: t('act_label_pressingKey'), detail: keys };
    }
    case 'go_back':
      return { label: t('act_label_goingBack') };
    case 'scroll_to_percent':
    case 'scroll_to_top':
    case 'scroll_to_bottom':
    case 'scroll_to_text':
    case 'previous_page':
    case 'next_page':
      return { label: t('act_label_scrolling'), detail: intent };
    case 'wait':
      return { label: t('act_label_waiting'), detail: `${String(args.seconds ?? 3)}s` };
    case 'switch_tab':
      return { label: t('act_label_switchingTab') };
    case 'open_tab':
      return { label: t('act_label_openingTab'), detail: String(args.url ?? '') };
    case 'close_tab':
      return { label: t('act_label_closingTab') };
    case 'select_dropdown_option':
      return { label: t('act_label_selecting'), detail: String(args.text ?? '') };
    case 'get_dropdown_options':
      return { label: t('act_label_readingOptions') };
    case 'cache_content':
      return { label: t('act_label_caching') };
    case 'done':
      return { label: t('act_label_completing') };
    default:
      return { label: intent || actionName };
  }
}

/**
 * Build batch action items from a list of parsed actions.
 */
export function buildBatchActionItems(actions: Record<string, unknown>[]): BatchActionItem[] {
  return actions.map(action => {
    const actionName = Object.keys(action)[0];
    const actionArgs = (action[actionName] as Record<string, unknown>) ?? {};
    const { label, detail } = formatActionLabel(actionName, actionArgs);
    return { label, detail, status: 'pending' as const };
  });
}
