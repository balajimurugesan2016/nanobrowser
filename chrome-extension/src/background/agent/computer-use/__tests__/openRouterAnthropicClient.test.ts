import { describe, it, expect, vi } from 'vitest';

vi.mock('@extension/i18n', () => ({
  t: (key: string) => key,
}));

import { ProviderTypeEnum } from '@extension/storage';
import { isComputerUseCapableModel } from '@extension/storage/lib/settings/visionModels';
import {
  buildComputerUseTool,
  buildCombinedToolResultsMessage,
  buildInitialUserMessage,
  messagesEndWithUser,
  buildMessagesRequestBody,
  getOpenRouterMessagesUrl,
  OpenRouterAnthropicClient,
  parseComputerToolUses,
  extractAssistantTextFromResponse,
  resolveComputerUseVersion,
  COMPUTER_USE_VERSION_LEGACY,
  COMPUTER_USE_VERSION_LATEST,
} from '../openRouterAnthropicClient';
import { buildComputerBatchActionItems, formatComputerActionLabel } from '../computerActionLabels';

describe('resolveComputerUseVersion', () => {
  it('uses legacy computer use for claude-sonnet-4', () => {
    expect(resolveComputerUseVersion('anthropic/claude-sonnet-4')).toEqual(COMPUTER_USE_VERSION_LEGACY);
  });

  it('uses legacy computer use for claude-4.5-sonnet', () => {
    expect(resolveComputerUseVersion('anthropic/claude-4.5-sonnet')).toEqual(COMPUTER_USE_VERSION_LEGACY);
  });

  it('uses latest computer use for claude-4.6-sonnet', () => {
    expect(resolveComputerUseVersion('anthropic/claude-4.6-sonnet')).toEqual(COMPUTER_USE_VERSION_LATEST);
  });
});

describe('isComputerUseCapableModel', () => {
  it('allows supported Anthropic OpenRouter computer-use models', () => {
    expect(isComputerUseCapableModel(ProviderTypeEnum.OpenRouter, 'anthropic/claude-4.5-sonnet')).toBe(true);
    expect(isComputerUseCapableModel(ProviderTypeEnum.OpenRouter, 'anthropic/claude-4.6-sonnet')).toBe(true);
  });

  it('rejects retired Anthropic computer-use models on OpenRouter', () => {
    expect(isComputerUseCapableModel(ProviderTypeEnum.OpenRouter, 'anthropic/claude-sonnet-4')).toBe(false);
    expect(isComputerUseCapableModel(ProviderTypeEnum.OpenRouter, 'anthropic/claude-opus-4')).toBe(false);
  });

  it('rejects non-Anthropic vision models', () => {
    expect(isComputerUseCapableModel(ProviderTypeEnum.OpenRouter, 'google/gemini-2.5-pro')).toBe(false);
    expect(isComputerUseCapableModel(ProviderTypeEnum.OpenRouter, 'openai/gpt-4o-2024-11-20')).toBe(false);
  });
});

describe('getOpenRouterMessagesUrl', () => {
  it('appends /messages to default OpenRouter base URL', () => {
    expect(getOpenRouterMessagesUrl('https://openrouter.ai/api/v1')).toBe('https://openrouter.ai/api/v1/messages');
  });
});

describe('buildComputerUseTool', () => {
  it('builds an OpenRouter custom computer tool for explicit version', () => {
    expect(buildComputerUseTool(1280, 720, COMPUTER_USE_VERSION_LATEST)).toEqual({
      type: 'custom',
      name: 'computer',
      description:
        'Interact with the browser viewport (1280x720px) using mouse, keyboard, scroll, and screenshot actions.',
      input_schema: expect.objectContaining({
        type: 'object',
        required: ['action'],
        properties: expect.objectContaining({
          action: expect.objectContaining({
            enum: expect.arrayContaining(['screenshot', 'zoom']),
          }),
        }),
      }),
    });
  });

  it('defaults to latest action schema when no version is provided', () => {
    const tool = buildComputerUseTool(1280, 720);
    expect(tool.type).toBe('custom');
    expect(tool.input_schema.properties.action.enum).toContain('zoom');
  });
});

describe('buildInitialUserMessage', () => {
  it('sends text-only user content when no screenshot is provided', () => {
    expect(buildInitialUserMessage('Search for shoes on amazon.de')).toEqual({
      role: 'user',
      content: expect.stringContaining('Search for shoes on amazon.de'),
    });
  });

  it('includes an image block when an initial screenshot is provided', () => {
    const message = buildInitialUserMessage('Open example.com', 'https://example.com', 'abc123');
    expect(message.role).toBe('user');
    expect(Array.isArray(message.content)).toBe(true);
    const blocks = message.content as Array<{ type: string; source?: { data?: string } }>;
    expect(blocks[0]?.type).toBe('text');
    expect(blocks[1]?.type).toBe('image');
    expect(blocks[1]?.source?.data).toBe('abc123');
  });
});

describe('buildCombinedToolResultsMessage', () => {
  it('combines multiple tool results into one user message', () => {
    const message = buildCombinedToolResultsMessage([
      { toolUseId: 'tool-1', screenshotBase64: 'shot-1', outputText: 'first' },
      { toolUseId: 'tool-2', screenshotBase64: 'shot-2', outputText: 'second' },
    ]);

    expect(message.role).toBe('user');
    expect(Array.isArray(message.content)).toBe(true);
    expect(message.content).toHaveLength(2);
    expect(message.content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'tool-1' });
    expect(message.content[1]).toMatchObject({ type: 'tool_result', tool_use_id: 'tool-2' });
  });
});

describe('messagesEndWithUser', () => {
  it('returns false when the last message is assistant', () => {
    expect(
      messagesEndWithUser([
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: [{ type: 'text', text: 'done' }] },
      ]),
    ).toBe(false);
  });
});

describe('buildMessagesRequestBody', () => {
  it('includes legacy computer tool for claude-4.5-sonnet', () => {
    const body = buildMessagesRequestBody(
      { modelName: 'anthropic/claude-4.5-sonnet', viewportWidth: 1280, viewportHeight: 720 },
      [{ role: 'user', content: 'hello' }],
    );

    expect(body.model).toBe('anthropic/claude-4.5-sonnet');
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].type).toBe('custom');
    expect(body.tools[0].name).toBe('computer');
    expect(body.tools[0].input_schema).toBeDefined();
    expect(body.system).toContain('1280x720');
    expect(body.provider).toEqual({ order: ['Anthropic'], allow_fallbacks: false });
    expect(body.messages).toHaveLength(1);
  });
});

describe('parseComputerToolUses', () => {
  it('extracts computer tool_use blocks from response', () => {
    const toolUses = parseComputerToolUses({
      content: [
        { type: 'text', text: 'Clicking' },
        {
          type: 'tool_use',
          id: 'toolu_123',
          name: 'computer',
          input: { action: 'left_click', coordinate: [100, 200] },
        },
      ],
    });

    expect(toolUses).toHaveLength(1);
    expect(toolUses[0].input.action).toBe('left_click');
    expect(toolUses[0].input.coordinate).toEqual([100, 200]);
  });
});

describe('extractAssistantTextFromResponse', () => {
  it('joins assistant text blocks', () => {
    const text = extractAssistantTextFromResponse({
      content: [
        { type: 'text', text: 'Summary line 1' },
        { type: 'text', text: 'Summary line 2' },
      ],
    });

    expect(text).toBe('Summary line 1\n\nSummary line 2');
  });
});

describe('computerActionLabels', () => {
  it('maps click and type actions to batch labels', () => {
    expect(formatComputerActionLabel({ action: 'left_click', coordinate: [10, 20] }).label).toBe('act_label_clicking');
    expect(formatComputerActionLabel({ action: 'type', text: 'hello' }).detail).toContain('hello');
  });

  it('builds batch items excluding screenshot actions', () => {
    const items = buildComputerBatchActionItems([{ action: 'screenshot' }, { action: 'type', text: 'shoes' }]);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('pending');
  });
});

describe('OpenRouterAnthropicClient', () => {
  it('rejects retired models before calling OpenRouter', async () => {
    const fetchImpl = vi.fn();
    const client = new OpenRouterAnthropicClient({
      config: {
        apiKey: 'test-key',
        baseUrl: 'https://openrouter.ai/api/v1',
        modelName: 'anthropic/claude-sonnet-4',
        viewportWidth: 1280,
        viewportHeight: 720,
      },
      fetchImpl,
    });

    await expect(client.createMessages([{ role: 'user', content: 'test' }])).rejects.toThrow(
      'no longer supports Anthropic Computer Use on OpenRouter',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends legacy computer-use beta header for claude-4.5-sonnet', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_abc',
            name: 'computer',
            input: { action: 'screenshot' },
          },
        ],
      }),
    });

    const client = new OpenRouterAnthropicClient({
      config: {
        apiKey: 'test-key',
        baseUrl: 'https://openrouter.ai/api/v1',
        modelName: 'anthropic/claude-4.5-sonnet',
        viewportWidth: 1280,
        viewportHeight: 720,
      },
      fetchImpl,
    });

    const response = await client.createMessages([{ role: 'user', content: 'test' }]);
    const toolUses = parseComputerToolUses(response);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(requestInit.headers).toMatchObject({
      Authorization: 'Bearer test-key',
      'anthropic-beta': 'computer-use-2025-01-24',
      'anthropic-version': '2023-06-01',
    });
    const requestBody = JSON.parse(requestInit.body as string);
    expect(requestBody.tools[0].type).toBe('custom');
    expect(requestBody.tools[0].input_schema).toBeDefined();
    expect(toolUses).toHaveLength(1);
    expect(toolUses[0].input.action).toBe('screenshot');
  });

  it('sends latest computer-use beta header for claude-4.6-sonnet', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stop_reason: 'tool_use',
        content: [],
      }),
    });

    const client = new OpenRouterAnthropicClient({
      config: {
        apiKey: 'test-key',
        baseUrl: 'https://openrouter.ai/api/v1',
        modelName: 'anthropic/claude-4.6-sonnet',
        viewportWidth: 1280,
        viewportHeight: 720,
      },
      fetchImpl,
    });

    await client.createMessages([{ role: 'user', content: 'test' }]);

    const [, requestInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(requestInit.headers).toMatchObject({
      'anthropic-beta': 'computer-use-2025-11-24',
      'anthropic-version': '2023-06-01',
    });
    const requestBody = JSON.parse(requestInit.body as string);
    expect(requestBody.tools[0].type).toBe('custom');
    expect(requestBody.tools[0].input_schema.properties.action.enum).toContain('zoom');
  });
});
