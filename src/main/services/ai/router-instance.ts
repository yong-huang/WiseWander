import { configStore } from '../../store/config'
import { OllamaClient } from './ollama-client'
import { CloudClient } from './cloud-client'
import { ModelRouter } from './router'

/**
 * Process-wide AI singletons. Lives outside `ipc/` so that services
 * (e.g. agent tools) can depend on the router without creating a
 * services → ipc dependency cycle.
 */
export const ollamaClient = new OllamaClient()
export const cloudClient = new CloudClient()
export const modelRouter = new ModelRouter(ollamaClient, cloudClient, configStore)
