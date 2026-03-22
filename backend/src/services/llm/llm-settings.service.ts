import { z } from "zod";
import { env } from "../../core/config/env";
import { query } from "../../core/db/pool";
import { logger } from "../../core/logger";

const SETTINGS_KEY = "llm";

const llmFallbackModeSchema = z.enum(["disabled", "deterministic"]);

const nullableTrimmedString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  },
  z.string().min(1).nullable().optional()
);

export const llmSettingsPatchSchema = z
  .object({
    apiKey: nullableTrimmedString,
    baseUrl: z.preprocess(
      (value) => {
        if (typeof value !== "string") {
          return value;
        }
        const trimmed = value.trim();
        return trimmed.length === 0 ? null : trimmed;
      },
      z.string().url().nullable().optional()
    ),
    model: z.string().min(1).max(128).optional(),
    modelVersion: z.string().min(1).max(128).optional(),
    taskName: z.string().min(1).max(128).optional(),
    promptVersion: z.string().min(1).max(64).optional(),
    timeoutMs: z.coerce.number().int().positive().max(120000).optional(),
    retries: z.coerce.number().int().min(0).max(10).optional(),
    retryBackoffMs: z.coerce.number().int().positive().max(60000).optional(),
    circuitBreakerThreshold: z.coerce.number().int().positive().max(50).optional(),
    circuitBreakerCooldownMs: z.coerce.number().int().positive().max(600000).optional(),
    fallbackMode: llmFallbackModeSchema.optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one setting field must be provided"
  });

type LlmSettingsPatch = z.infer<typeof llmSettingsPatchSchema>;

const llmSettingsPersistedSchema = z.object({
  apiKey: z.string().min(1).nullable().optional(),
  baseUrl: z.string().url().nullable().optional(),
  model: z.string().min(1).max(128).optional(),
  modelVersion: z.string().min(1).max(128).optional(),
  taskName: z.string().min(1).max(128).optional(),
  promptVersion: z.string().min(1).max(64).optional(),
  timeoutMs: z.number().int().positive().max(120000).optional(),
  retries: z.number().int().min(0).max(10).optional(),
  retryBackoffMs: z.number().int().positive().max(60000).optional(),
  circuitBreakerThreshold: z.number().int().positive().max(50).optional(),
  circuitBreakerCooldownMs: z.number().int().positive().max(600000).optional(),
  fallbackMode: llmFallbackModeSchema.optional()
});

type LlmSettingsPersisted = z.infer<typeof llmSettingsPersistedSchema>;

interface PersistedReadResult {
  settings: LlmSettingsPersisted;
  updatedAt: string | null;
}

const maskApiKey = (apiKey: string | undefined) => {
  if (!apiKey) {
    return null;
  }

  if (apiKey.length <= 6) {
    return "***";
  }

  return `${apiKey.slice(0, 3)}***${apiKey.slice(-3)}`;
};

const applySettingsToEnv = (settings: LlmSettingsPersisted) => {
  if (Object.prototype.hasOwnProperty.call(settings, "apiKey")) {
    (env as { LLM_API_KEY?: string }).LLM_API_KEY = settings.apiKey ?? undefined;
  }

  if (Object.prototype.hasOwnProperty.call(settings, "baseUrl")) {
    (env as { LLM_API_URL?: string }).LLM_API_URL = settings.baseUrl ?? undefined;
  }

  if (settings.model !== undefined) {
    env.LLM_MODEL = settings.model;
  }

  if (settings.modelVersion !== undefined) {
    env.LLM_MODEL_VERSION = settings.modelVersion;
  }

  if (settings.taskName !== undefined) {
    env.LLM_TASK_NAME = settings.taskName;
  }

  if (settings.promptVersion !== undefined) {
    env.LLM_PROMPT_VERSION = settings.promptVersion;
  }

  if (settings.timeoutMs !== undefined) {
    env.LLM_TIMEOUT_MS = settings.timeoutMs;
  }

  if (settings.retries !== undefined) {
    env.LLM_MAX_RETRIES = settings.retries;
  }

  if (settings.retryBackoffMs !== undefined) {
    env.LLM_RETRY_BACKOFF_MS = settings.retryBackoffMs;
  }

  if (settings.circuitBreakerThreshold !== undefined) {
    env.LLM_CIRCUIT_BREAKER_THRESHOLD = settings.circuitBreakerThreshold;
  }

  if (settings.circuitBreakerCooldownMs !== undefined) {
    env.LLM_CIRCUIT_BREAKER_COOLDOWN_MS = settings.circuitBreakerCooldownMs;
  }

  if (settings.fallbackMode !== undefined) {
    env.LLM_FALLBACK_MODE = settings.fallbackMode;
  }
};

const readPersistedLlmSettings = async (): Promise<PersistedReadResult> => {
  const result = await query<{ value: unknown; updated_at: string }>(
    "SELECT value, updated_at FROM system_settings WHERE key = $1 LIMIT 1",
    [SETTINGS_KEY]
  );

  if (result.rowCount === 0) {
    return { settings: {}, updatedAt: null };
  }

  const parsed = llmSettingsPersistedSchema.safeParse(result.rows[0].value);

  if (!parsed.success) {
    logger.warn("invalid llm settings payload in system_settings, ignoring persisted values", {
      issues: parsed.error.issues
    });
    return { settings: {}, updatedAt: result.rows[0].updated_at ?? null };
  }

  return {
    settings: parsed.data,
    updatedAt: result.rows[0].updated_at ?? null
  };
};

const upsertPersistedLlmSettings = async (settings: LlmSettingsPersisted): Promise<string> => {
  const result = await query<{ updated_at: string }>(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
     RETURNING updated_at`,
    [SETTINGS_KEY, JSON.stringify(settings)]
  );

  return result.rows[0]?.updated_at ?? new Date().toISOString();
};

const buildLlmConfigView = (updatedAt: string | null) => {
  return {
    baseUrl: env.LLM_API_URL ?? null,
    model: env.LLM_MODEL,
    modelVersion: env.LLM_MODEL_VERSION,
    taskName: env.LLM_TASK_NAME,
    promptVersion: env.LLM_PROMPT_VERSION,
    timeoutMs: env.LLM_TIMEOUT_MS,
    retries: env.LLM_MAX_RETRIES,
    retryBackoffMs: env.LLM_RETRY_BACKOFF_MS,
    circuitBreakerThreshold: env.LLM_CIRCUIT_BREAKER_THRESHOLD,
    circuitBreakerCooldownMs: env.LLM_CIRCUIT_BREAKER_COOLDOWN_MS,
    fallbackMode: env.LLM_FALLBACK_MODE,
    hasApiKey: Boolean(env.LLM_API_KEY),
    apiKeyMasked: maskApiKey(env.LLM_API_KEY),
    updatedAt,
    persistence: "database"
  };
};

export const getLlmSettings = async () => {
  const persisted = await readPersistedLlmSettings();
  if (Object.keys(persisted.settings).length > 0) {
    applySettingsToEnv(persisted.settings);
  }
  return buildLlmConfigView(persisted.updatedAt);
};

export const updateLlmSettings = async (input: unknown) => {
  const patch = llmSettingsPatchSchema.parse(input);
  const current = await readPersistedLlmSettings();

  const merged: LlmSettingsPersisted = {
    ...current.settings,
    ...patch
  };

  const updatedAt = await upsertPersistedLlmSettings(merged);
  applySettingsToEnv(merged);

  return buildLlmConfigView(updatedAt);
};

export const loadLlmSettingsOnStartup = async () => {
  try {
    const persisted = await readPersistedLlmSettings();

    if (Object.keys(persisted.settings).length === 0) {
      return;
    }

    applySettingsToEnv(persisted.settings);

    logger.info("loaded llm settings from database", {
      updated_at: persisted.updatedAt,
      has_api_key: Object.prototype.hasOwnProperty.call(persisted.settings, "apiKey")
    });
  } catch (error) {
    logger.warn("failed to load llm settings from database, fallback to env", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
