import { describe, it, expect } from 'vitest';
import { buildComputerUseSystemPrompt, buildOpenRouterComputerUseTool } from '../computerUseToolSchema';
import { COMPUTER_USE_VERSION_LEGACY, COMPUTER_USE_VERSION_LATEST } from '../computerUseVersion';

describe('computerUseToolSchema', () => {
  it('builds legacy custom tool without zoom action', () => {
    const tool = buildOpenRouterComputerUseTool(1024, 768, COMPUTER_USE_VERSION_LEGACY);
    expect(tool.type).toBe('custom');
    expect(tool.input_schema.properties.action.enum).not.toContain('zoom');
  });

  it('builds latest custom tool with zoom action', () => {
    const tool = buildOpenRouterComputerUseTool(1024, 768, COMPUTER_USE_VERSION_LATEST);
    expect(tool.input_schema.properties.action.enum).toContain('zoom');
  });

  it('includes viewport dimensions in system prompt', () => {
    expect(buildComputerUseSystemPrompt(1280, 720)).toContain('1280x720');
  });
});
