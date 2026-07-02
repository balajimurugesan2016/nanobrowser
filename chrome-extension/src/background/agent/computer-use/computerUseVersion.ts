export const COMPUTER_USE_TOOL_NAME = 'computer';

export const COMPUTER_USE_VERSION_LEGACY = {
  toolType: 'computer_20250124',
  betaHeader: 'computer-use-2025-01-24',
} as const;

export const COMPUTER_USE_VERSION_LATEST = {
  toolType: 'computer_20251124',
  betaHeader: 'computer-use-2025-11-24',
} as const;

export type ComputerUseVersion = typeof COMPUTER_USE_VERSION_LEGACY | typeof COMPUTER_USE_VERSION_LATEST;

const LEGACY_COMPUTER_USE_MODEL_PATTERNS = [
  /anthropic\/claude-sonnet-4(?:$|\/)/i,
  /anthropic\/claude-opus-4(?:$|\/)/i,
  /anthropic\/claude-3\.5-sonnet/i,
  /anthropic\/claude-4\.5-sonnet/i,
  /anthropic\/claude-4\.5-haiku/i,
  /anthropic\/claude-opus-4\.1/i,
];

export function resolveComputerUseVersion(modelName: string): ComputerUseVersion {
  const normalized = modelName.trim();
  if (LEGACY_COMPUTER_USE_MODEL_PATTERNS.some(pattern => pattern.test(normalized))) {
    return COMPUTER_USE_VERSION_LEGACY;
  }
  return COMPUTER_USE_VERSION_LATEST;
}
