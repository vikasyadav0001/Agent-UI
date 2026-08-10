export const MODELS = [
  // Groq
  {
    name: "Qwen 3.6 27B",
    value: "qwen/qwen3.6-27b",
    icon: "/icons/groq.svg",
    disabled: false,
    contextWindow: 131_072,
  },
  // Mistral
  {
    name: "Mistral 3",
    value: "mistral-small-2506",
    icon: "/icons/mistral.svg",
    disabled: false,
    contextWindow: 128_000,
  },
] as const;

export type Model = (typeof MODELS)[number];
export type KnownModelId = Model["value"];

const DEFAULT_MODEL = MODELS[0];
export const DEFAULT_MODEL_ID: KnownModelId = DEFAULT_MODEL.value;
export const DEFAULT_CONTEXT_WINDOW = DEFAULT_MODEL.contextWindow;

export function getContextWindow(modelId: string): number {
  const model = MODELS.find((m) => m.value === modelId);
  return model?.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
}

const ACTIVE_MODELS = MODELS.filter((m) => !m.disabled);
const AVAILABLE_MODEL_IDS = new Set<KnownModelId>(
  ACTIVE_MODELS.map((m) => m.value),
);

export function isAvailableModelId(id: string): id is KnownModelId {
  return AVAILABLE_MODEL_IDS.has(id as KnownModelId);
}

export function resolveModelId(input: string | undefined): KnownModelId {
  const raw = typeof input === "string" ? input.trim() : "";
  return raw && isAvailableModelId(raw) ? raw : DEFAULT_MODEL_ID;
}
