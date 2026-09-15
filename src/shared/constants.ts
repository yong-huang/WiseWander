export const OLLAMA_DEFAULT_URL = 'http://localhost:11434'
export const DEFAULT_MODEL = 'llama3.2'
export const MAX_CONTEXT_CHARS = 8_000
export const SUMMARY_CONTEXT_CHARS = 12_000
export const MAX_RECENTLY_CLOSED = 20
export const OPENAI_COMPATIBLE_DEFAULT_URL = 'http://localhost:1234'
export const PROVIDERS_CONFIG_KEY = 'providers'
export const DB_NAME = 'data.db'
export const CONFIG_NAME = 'config.json'
export const RECOMMENDATION_RECOMPUTE_INTERVAL = 4 * 60 * 60 * 1000 // 4h
export const RECOMMENDATION_CACHE_TTL = 24 * 60 * 60 * 1000 // 24h
export const RECOMMENDATION_MIN_HISTORY_DELTA = 20
export const RECOMMENDATION_MAX_HISTORY_SAMPLE = 50
export const NEW_TAB_URL = 'wisewander://newtab'
export const BROWSER_ASSISTANT_ID = '__assistant__'

// Agent loop budgets (hard limits — see docs/AGENT_EVOLUTION.md §6.6)
export const AGENT_MAX_ITERATIONS = 15
export const AGENT_MAX_WALL_MS = 180_000
export const AGENT_MAX_PROMPT_CHARS = 160_000 // ≈40k tokens of cumulative prompt traffic
export const AGENT_PAGE_MAX_ELEMENTS = 120
export const AGENT_PAGE_TEXT_CHARS = 4_000
export const AGENT_PAGE_BUDGET_CHARS = 12_000
export const AGENT_OBSERVATION_CHARS = 1_500
export const AGENT_REPROMPT_LIMIT = 2
