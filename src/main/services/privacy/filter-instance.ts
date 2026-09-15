import { ContentFilter } from './content-filter'

/**
 * Process-wide content filter instance. Lives in its own module so both
 * the app bootstrap (session install) and IPC handlers (stats, toggles)
 * share the same instance without import cycles.
 */
export const contentFilter = new ContentFilter()
