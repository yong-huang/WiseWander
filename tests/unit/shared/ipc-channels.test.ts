import { describe, it, expect } from 'vitest'
import { IPC_CHANNELS } from '../../../src/shared/ipc-channels'

describe('IPC_CHANNELS', () => {
  it('should have all required browser channels', () => {
    expect(IPC_CHANNELS.TAB_CREATE).toBeDefined()
    expect(IPC_CHANNELS.TAB_CLOSE).toBeDefined()
    expect(IPC_CHANNELS.TAB_ACTIVATE).toBeDefined()
    expect(IPC_CHANNELS.NAVIGATE).toBeDefined()
  })

  it('should have all AI channels', () => {
    expect(IPC_CHANNELS.AI_CHAT_SEND).toBeDefined()
    expect(IPC_CHANNELS.AI_CHAT_STREAM).toBeDefined()
    expect(IPC_CHANNELS.AI_SUMMARIZE).toBeDefined()
    expect(IPC_CHANNELS.AI_TRANSLATE).toBeDefined()
    expect(IPC_CHANNELS.AI_SMART_TAB_NAME).toBeDefined()
  })

  it('should have Ollama channels', () => {
    expect(IPC_CHANNELS.OLLAMA_STATUS).toBeDefined()
    expect(IPC_CHANNELS.OLLAMA_LIST_MODELS).toBeDefined()
    expect(IPC_CHANNELS.OLLAMA_SET_MODEL).toBeDefined()
  })

  it('should have agent channels', () => {
    expect(IPC_CHANNELS.AGENT_EXECUTE).toBeDefined()
    expect(IPC_CHANNELS.AGENT_STEP_UPDATE).toBeDefined()
  })

  it('should have bookmark and history channels', () => {
    expect(IPC_CHANNELS.BOOKMARK_ADD).toBeDefined()
    expect(IPC_CHANNELS.BOOKMARK_LIST).toBeDefined()
    expect(IPC_CHANNELS.HISTORY_ADD).toBeDefined()
    expect(IPC_CHANNELS.HISTORY_SEARCH).toBeDefined()
  })

  it('should have unique channel names', () => {
    const values = Object.values(IPC_CHANNELS)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('should have capability channels including md export', () => {
    expect(IPC_CHANNELS.CAPABILITY_ANALYZE_DESIGN).toBe('capability:analyze-design')
    expect(IPC_CHANNELS.CAPABILITY_EXPORT_TEMPLATE).toBe('capability:export-template')
    expect(IPC_CHANNELS.CAPABILITY_CRAWL_START).toBe('capability:crawl:start')
    expect(IPC_CHANNELS.CAPABILITY_CRAWL_CANCEL).toBe('capability:crawl:cancel')
    expect(IPC_CHANNELS.CAPABILITY_CRAWL_PROGRESS).toBe('capability:crawl:progress')
    expect(IPC_CHANNELS.CAPABILITY_CRAWL_EXPORT).toBe('capability:crawl:export')
    expect(IPC_CHANNELS.CAPABILITY_MD_EXPORT).toBe('capability:md-export')
  })
})
