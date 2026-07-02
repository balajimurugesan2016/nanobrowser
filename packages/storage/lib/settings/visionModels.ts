import { ProviderTypeEnum } from './types';

/**
 * Built-in vision-capable models per provider.
 * Custom, Azure, and Ollama models are also checked via pattern matching.
 */
export const llmProviderVisionModelNames: Partial<Record<ProviderTypeEnum, string[]>> = {
  [ProviderTypeEnum.OpenAI]: [
    'gpt-5.1',
    'gpt-5',
    'gpt-5-pro',
    'gpt-5-mini',
    'gpt-5-chat-latest',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4o',
  ],
  [ProviderTypeEnum.Anthropic]: [
    'anthropic--claude-sonnet-latest',
    'anthropic--claude-haiku-latest',
    'anthropic--claude-opus-latest',
    'anthropic--claude-4.6-sonnet',
    'anthropic--claude-4.5-haiku',
    'anthropic--claude-4.5-sonnet',
    'anthropic--claude-4.6-opus',
    'anthropic--claude-4.7-opus',
  ],
  [ProviderTypeEnum.Gemini]: ['gemini-3-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  [ProviderTypeEnum.Grok]: ['grok-4', 'grok-3'],
  [ProviderTypeEnum.AzureOpenAI]: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o'],
  [ProviderTypeEnum.OpenRouter]: [
    'anthropic/claude-4.6-sonnet',
    'anthropic/claude-4.5-sonnet',
    'anthropic/claude-sonnet-4',
    'anthropic/claude-3.5-sonnet',
    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash',
    'openai/gpt-4o-2024-11-20',
    'openai/gpt-4.1',
  ],
};

/**
 * OpenRouter models known to support Anthropic Computer Use (tool and beta header versions vary by model).
 * Claude Sonnet 4 / Opus 4 computer use is retired on Anthropic's API (except Bedrock/GCP).
 */
export const llmProviderComputerUseModelNames: Partial<Record<ProviderTypeEnum, string[]>> = {
  [ProviderTypeEnum.OpenRouter]: [
    'anthropic/claude-4.6-sonnet',
    'anthropic/claude-4.5-sonnet',
    'anthropic/claude-4.5-opus',
    'anthropic/claude-4.6-opus',
    'anthropic/claude-4.7-opus',
  ],
};

/** Models that appear in OpenRouter but no longer support computer use via Anthropic. */
export const openRouterRetiredComputerUseModelNames = [
  'anthropic/claude-sonnet-4',
  'anthropic/claude-opus-4',
  'anthropic/claude-3.5-sonnet',
] as const;

const COMPUTER_USE_MODEL_PATTERNS = [
  /anthropic\/claude-4\.5-(sonnet|haiku|opus)/i,
  /anthropic\/claude-4\.6/i,
  /anthropic\/claude-4\.7/i,
];

const VISION_MODEL_PATTERNS = [
  /gpt-4o/i,
  /gpt-4\.1/i,
  /gpt-5/i,
  /claude/i,
  /gemini/i,
  /grok-[34](?!-fast)/i,
  /llava/i,
  /vision/i,
  /moondream/i,
  /bakllava/i,
  /qwen.*vl/i,
  /pixtral/i,
  /internvl/i,
  /minicpm-v/i,
];

const NON_VISION_MODEL_PATTERNS = [
  /deepseek/i,
  /llama-3\.3/i,
  /llama-4(?!.*vision)/i,
  /grok-.*-fast/i,
  /non-reasoning/i,
];

/**
 * Returns true when a model is expected to support image/vision inputs.
 */
export function isVisionCapableModel(providerType: ProviderTypeEnum | string | undefined, modelName: string): boolean {
  if (!modelName) {
    return false;
  }

  if (NON_VISION_MODEL_PATTERNS.some(pattern => pattern.test(modelName))) {
    return false;
  }

  if (providerType) {
    const knownVisionModels = llmProviderVisionModelNames[providerType as ProviderTypeEnum];
    if (knownVisionModels?.includes(modelName)) {
      return true;
    }
  }

  return VISION_MODEL_PATTERNS.some(pattern => pattern.test(modelName));
}

/**
 * Returns true when a model is expected to support Anthropic Computer Use via OpenRouter.
 */
export function isComputerUseCapableModel(
  providerType: ProviderTypeEnum | string | undefined,
  modelName: string,
): boolean {
  if (!modelName) {
    return false;
  }

  if (providerType !== ProviderTypeEnum.OpenRouter && providerType !== 'openrouter') {
    return false;
  }

  if (isRetiredOpenRouterComputerUseModel(modelName)) {
    return false;
  }

  const knownComputerUseModels = llmProviderComputerUseModelNames[ProviderTypeEnum.OpenRouter];
  if (knownComputerUseModels?.includes(modelName)) {
    return true;
  }

  return COMPUTER_USE_MODEL_PATTERNS.some(pattern => pattern.test(modelName));
}

/** Default replacement when a retired model was saved in Navigator settings. */
export const DEFAULT_OPENROUTER_COMPUTER_USE_NAVIGATOR_MODEL = 'anthropic/claude-4.6-sonnet';

export function getOpenRouterComputerUseReplacementModel(retiredModel: string): string {
  if (/opus/i.test(retiredModel)) {
    return 'anthropic/claude-4.6-opus';
  }
  return DEFAULT_OPENROUTER_COMPUTER_USE_NAVIGATOR_MODEL;
}

export function isRetiredOpenRouterComputerUseModel(modelName: string): boolean {
  const normalized = modelName.trim();
  return openRouterRetiredComputerUseModelNames.includes(
    normalized as (typeof openRouterRetiredComputerUseModelNames)[number],
  );
}
