import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { ResearchEngine } from '../services/research/research-engine'
import { ResearchWorkbench } from '../services/research/research-workbench'
import type { ResearchResult } from '../services/research/research-engine'
import type { ModelRouter } from '../services/ai/router'

let researchEngine: ResearchEngine | null = null
let latestReport: ResearchResult | null = null
let workbench: ResearchWorkbench | null = null

export function registerResearchIpc(modelRouter: ModelRouter): void {
  researchEngine = new ResearchEngine(modelRouter)
  workbench = new ResearchWorkbench(modelRouter)

  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_EXECUTE,
    async (_event, topic: string, tabUrls: string[]): Promise<ResearchResult> => {
      if (!researchEngine) {
        throw new Error('Research engine not initialized')
      }
      const result = await researchEngine.research(topic, tabUrls)
      latestReport = result
      return result
    },
  )

  ipcMain.handle(IPC_CHANNELS.RESEARCH_REPORT, async (): Promise<ResearchResult | null> => {
    return latestReport
  })

  // ── Research Workbench ──

  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_PROJECT_CREATE,
    async (_event, name: string, topic: string) => {
      if (!workbench) throw new Error('Workbench not initialized')
      return workbench.createProject(name, topic)
    }
  )

  ipcMain.handle(IPC_CHANNELS.RESEARCH_PROJECT_LIST, async () => {
    if (!workbench) throw new Error('Workbench not initialized')
    return workbench.listProjects()
  })

  ipcMain.handle(IPC_CHANNELS.RESEARCH_PROJECT_GET, async (_event, id: string) => {
    if (!workbench) throw new Error('Workbench not initialized')
    return workbench.getProject(id)
  })

  ipcMain.handle(IPC_CHANNELS.RESEARCH_PROJECT_DELETE, async (_event, id: string) => {
    if (!workbench) throw new Error('Workbench not initialized')
    return workbench.deleteProject(id)
  })

  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_SOURCE_ADD,
    async (_event, projectId: string, url: string, title?: string, snippet?: string) => {
      if (!workbench) throw new Error('Workbench not initialized')
      return workbench.addSource(projectId, url, title, snippet)
    }
  )

  ipcMain.handle(IPC_CHANNELS.RESEARCH_SOURCE_REMOVE, async (_event, id: string) => {
    if (!workbench) throw new Error('Workbench not initialized')
    return workbench.removeSource(id)
  })

  ipcMain.handle(IPC_CHANNELS.RESEARCH_SYNTHESIZE, async (_event, projectId: string) => {
    if (!workbench) throw new Error('Workbench not initialized')
    return workbench.synthesizeNotes(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.RESEARCH_NOTES_EXPORT, async (_event, projectId: string) => {
    if (!workbench) throw new Error('Workbench not initialized')
    return workbench.exportNotes(projectId)
  })
}
