import Store from 'electron-store'
import type { Tab } from '../../../shared/types'

interface WorkspaceTab {
  id: string
  url: string
  title: string
}

interface WorkspaceData {
  [workspaceName: string]: WorkspaceTab[]
}

interface WorkspaceStoreSchema {
  workspaces: WorkspaceData
}

const WORKSPACE_KEY = 'workspaces'

export class WorkspaceService {
  private store: Store<WorkspaceStoreSchema>

  constructor(store?: Store<WorkspaceStoreSchema>) {
    this.store = store ?? new Store<WorkspaceStoreSchema>({
      name: 'workspaces',
      defaults: { workspaces: {} },
    })
  }

  /**
   * Save the current set of tabs under a workspace name.
   * Only serialises id, url, and title for each tab.
   */
  save(workspaceName: string, tabs: Tab[]): void {
    const data = this.store.get(WORKSPACE_KEY, {})
    data[workspaceName] = tabs.map((t) => ({
      id: t.id,
      url: t.url,
      title: t.title,
    }))
    this.store.set(WORKSPACE_KEY, data)
  }

  /**
   * Restore a previously saved workspace.
   * Returns the array of tab snapshots or an empty array if not found.
   */
  restore(workspaceName: string): WorkspaceTab[] {
    const data = this.store.get(WORKSPACE_KEY, {})
    return data[workspaceName] ?? []
  }

  /**
   * List all saved workspace names.
   */
  list(): string[] {
    const data = this.store.get(WORKSPACE_KEY, {})
    return Object.keys(data)
  }

  /**
   * Delete a saved workspace.
   */
  delete(workspaceName: string): boolean {
    const data = this.store.get(WORKSPACE_KEY, {})
    if (!(workspaceName in data)) return false
    delete data[workspaceName]
    this.store.set(WORKSPACE_KEY, data)
    return true
  }
}
