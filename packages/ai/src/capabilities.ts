export const AICapability = {
  TEXT: "TEXT",
  STRUCTURED_OUTPUT: "STRUCTURED_OUTPUT",
  VISION: "VISION",
  EMBEDDINGS: "EMBEDDINGS",
  STREAMING: "STREAMING",
  TOOL_CALLING: "TOOL_CALLING",
} as const;

export type AICapability = (typeof AICapability)[keyof typeof AICapability];

export const AI_CAPABILITIES: readonly AICapability[] = Object.values(AICapability);
