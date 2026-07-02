import type { ComputerUseVersion } from './computerUseVersion';

const BASE_COMPUTER_ACTIONS = [
  'screenshot',
  'left_click',
  'right_click',
  'middle_click',
  'double_click',
  'triple_click',
  'left_click_drag',
  'left_mouse_down',
  'left_mouse_up',
  'scroll',
  'type',
  'key',
  'mouse_move',
  'hold_key',
  'wait',
] as const;

const LATEST_COMPUTER_ACTIONS = [...BASE_COMPUTER_ACTIONS, 'zoom'] as const;

function buildComputerInputSchema(actions: readonly string[]) {
  return {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [...actions],
        description: 'The computer action to perform.',
      },
      coordinate: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
        description: 'Target [x, y] coordinate in viewport pixels.',
      },
      start_coordinate: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
        description: 'Drag start [x, y] coordinate in viewport pixels.',
      },
      end_coordinate: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
        description: 'Drag end [x, y] coordinate in viewport pixels.',
      },
      region: {
        type: 'array',
        items: { type: 'number' },
        minItems: 4,
        maxItems: 4,
        description: 'Zoom region [x1, y1, x2, y2] in viewport pixels.',
      },
      text: {
        type: 'string',
        description: 'Text to type, link label for left_click/scroll, or a modifier key for other actions.',
      },
      key: {
        type: 'string',
        description: 'Keyboard key or shortcut to press.',
      },
      scroll_direction: {
        type: 'string',
        enum: ['up', 'down', 'left', 'right'],
      },
      scroll_amount: {
        type: 'number',
      },
      duration: {
        type: 'number',
        description: 'Wait duration in seconds.',
      },
    },
    required: ['action'],
    additionalProperties: false,
  };
}

export function buildComputerUseSystemPrompt(viewportWidth: number, viewportHeight: number): string {
  return [
    'You control a web browser through the computer tool.',
    `The viewport is ${viewportWidth}x${viewportHeight} pixels with origin at the top-left.`,
    'Take a screenshot when you need to inspect the page. If the user only asks for a screenshot, take one and stop.',
    'If the task names a URL and the browser is already on that page, do not navigate away.',
    'If a link or button is not visible in the latest screenshot, use the scroll action with direction down. Do not use zoom or browser zoom shortcuts.',
    'When the task names a link in quotes, prefer left_click with the text field set to that exact label instead of guessing coordinates.',
    'For checkboxes, use left_click with text "checkbox 1" for the first checkbox or "checkbox 2" for the second.',
    'Read the tool result page URL after each click. If you opened the wrong page, press alt+Left to go back and retry.',
    'Always use coordinates from the most recent screenshot in the conversation.',
  ].join(' ');
}

export function buildOpenRouterComputerUseTool(
  viewportWidth: number,
  viewportHeight: number,
  version: ComputerUseVersion,
) {
  const actions = version.toolType === 'computer_20251124' ? LATEST_COMPUTER_ACTIONS : BASE_COMPUTER_ACTIONS;

  return {
    type: 'custom',
    name: 'computer',
    description: `Interact with the browser viewport (${viewportWidth}x${viewportHeight}px) using mouse, keyboard, scroll, and screenshot actions.`,
    input_schema: buildComputerInputSchema(actions),
  };
}
