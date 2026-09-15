import { useState, useCallback, useEffect } from 'react'
import { ReportView } from './ReportView'
import { SourceList } from './SourceList'
import { useTabStore } from '../../store/tab-store'
import type { ResearchProject, ResearchSource, ResearchNote } from '../../../shared/types'

interface Source {
  url: string
  title: string
  snippet: string
}

interface ResearchReport {
  title: string
  sections: { heading: string; content: string; sources: string[] }[]
  createdAt: number
}

type MainView = 'quick' | 'workbench'

export function ResearchPanel(): React.ReactElement {
  const [mainView, setMainView] = useState<MainView>('quick')

  // ── Quick Research state ──
  const [topic, setTopic] = useState('')
  const [activeView, setActiveView] = useState<'report' | 'sources'>('report')
  const [isResearching, setIsResearching] = useState(false)
  const [report, setReport] = useState<ResearchReport | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [error, setError] = useState<string | null>(null)

  // ── Workbench state ──
  const [projects, setProjects] = useState<ResearchProject[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [, setProjectSources] = useState<ResearchSource[]>([])
  const [projectNotes, setProjectNotes] = useState<ResearchNote[]>([])
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectTopic, setNewProjectTopic] = useState('')
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)

  const tabs = useTabStore((state) => state.tabs)

  // ── Quick Research ──

  const handleResearch = useCallback(async (): Promise<void> => {
    const trimmed = topic.trim()
    if (!trimmed || isResearching) return

    setIsResearching(true)
    setError(null)
    setActiveView('report')

    const tabUrls = tabs
      .map((t) => t.url)
      .filter((url) => url && url !== 'about:blank' && url !== '')

    try {
      const result = await window.api.researchExecute(trimmed, tabUrls)
      setReport(result.report as ResearchReport)
      setSources(result.sources as Source[])
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setIsResearching(false)
    }
  }, [topic, isResearching, tabs])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleResearch()
    }
  }

  // ── Workbench ──

  const loadProjects = async (): Promise<void> => {
    try {
      const list = await window.api.researchProjectList() as ResearchProject[]
      setProjects(list)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (mainView === 'workbench') loadProjects()
  }, [mainView])

  const handleCreateProject = async (): Promise<void> => {
    if (!newProjectName.trim() || !newProjectTopic.trim()) return
    try {
      const project = await window.api.researchProjectCreate(newProjectName.trim(), newProjectTopic.trim()) as ResearchProject
      setProjects((prev) => [project, ...prev])
      setActiveProjectId(project.id)
      setNewProjectName('')
      setNewProjectTopic('')
      setShowNewProject(false)
    } catch {
      // ignore
    }
  }

  const handleAddSource = async (): Promise<void> => {
    if (!activeProjectId || !newSourceUrl.trim()) return
    try {
      const source = await window.api.researchSourceAdd(activeProjectId, newSourceUrl.trim()) as ResearchSource
      setProjectSources((prev) => [source, ...prev])
      setNewSourceUrl('')
    } catch {
      // ignore
    }
  }

  const handleSynthesize = async (): Promise<void> => {
    if (!activeProjectId) return
    setIsSynthesizing(true)
    try {
      const note = await window.api.researchSynthesize(activeProjectId) as ResearchNote
      setProjectNotes((prev) => [note, ...prev])
    } catch {
      // ignore
    }
    setIsSynthesizing(false)
  }

  const handleExportNotes = async (): Promise<void> => {
    if (!activeProjectId) return
    try {
      const markdown = await window.api.researchNotesExport(activeProjectId) as string
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'research-notes.md'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // ignore
    }
  }

  const handleDeleteProject = async (id: string): Promise<void> => {
    await window.api.researchProjectDelete(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
    if (activeProjectId === id) setActiveProjectId(null)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Main view toggle */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setMainView('quick')}
          className={`flex-1 px-3 py-2 text-xs font-medium ${
            mainView === 'quick'
              ? 'border-b-2 border-teal-600 text-teal-600'
              : 'text-gray-500'
          }`}
        >
          Quick Research
        </button>
        <button
          onClick={() => setMainView('workbench')}
          className={`flex-1 px-3 py-2 text-xs font-medium ${
            mainView === 'workbench'
              ? 'border-b-2 border-teal-600 text-teal-600'
              : 'text-gray-500'
          }`}
        >
          Workbench
        </button>
      </div>

      {/* Quick Research View */}
      {mainView === 'quick' && (
        <>
          <div className="border-b border-gray-200 p-3 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter research topic..."
                disabled={isResearching}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50
                  dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                onClick={() => void handleResearch()}
                disabled={isResearching || !topic.trim()}
                className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm text-white
                  hover:bg-teal-700 disabled:opacity-50"
              >
                {isResearching ? '...' : 'Research'}
              </button>
            </div>
            {tabs.length > 0 && (
              <p className="mt-1.5 text-[10px] text-gray-400">
                Using {tabs.filter((t) => t.url && t.url !== 'about:blank').length} open tab(s) as
                reference sources
              </p>
            )}
          </div>

          {error && (
            <div className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          )}

          {report && (
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {(['report', 'sources'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setActiveView(v)}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium capitalize ${
                    activeView === v
                      ? 'border-b-2 border-teal-600 text-teal-600'
                      : 'text-gray-500'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {activeView === 'report' ? (
              <ReportView report={report} isResearching={isResearching} />
            ) : (
              <SourceList sources={sources} />
            )}
          </div>
        </>
      )}

      {/* Workbench View */}
      {mainView === 'workbench' && (
        <div className="flex-1 overflow-y-auto">
          {/* Project List */}
          {!activeProjectId && (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Research Projects</h3>
                <button
                  onClick={() => setShowNewProject(true)}
                  className="rounded bg-teal-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-teal-600"
                >
                  + New
                </button>
              </div>

              {showNewProject && (
                <div className="rounded-lg border border-gray-200 p-2 space-y-1.5 dark:border-gray-700">
                  <input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs
                      dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                  <input
                    value={newProjectTopic}
                    onChange={(e) => setNewProjectTopic(e.target.value)}
                    placeholder="Topic"
                    className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs
                      dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                  <div className="flex gap-1">
                    <button onClick={handleCreateProject} className="rounded bg-teal-500 px-2 py-1 text-[10px] text-white hover:bg-teal-600">Create</button>
                    <button onClick={() => setShowNewProject(false)} className="rounded bg-gray-100 px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">Cancel</button>
                  </div>
                </div>
              )}

              {projects.length === 0 && !showNewProject && (
                <p className="text-[11px] text-gray-400 text-center py-4">No projects yet. Create one to get started.</p>
              )}

              <div className="space-y-1">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 cursor-pointer
                      hover:border-teal-300 dark:border-gray-700 dark:hover:border-teal-600"
                    onClick={() => setActiveProjectId(p.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{p.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{p.topic}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id) }}
                      className="text-[10px] text-gray-300 hover:text-red-500"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Project View */}
          {activeProjectId && (() => {
            const project = projects.find((p) => p.id === activeProjectId)
            return (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => setActiveProjectId(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&larr;</button>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{project?.name}</div>
                    <div className="text-[10px] text-gray-400 truncate">{project?.topic}</div>
                  </div>
                </div>

                {/* Add source */}
                <div className="flex gap-1">
                  <input
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    placeholder="Add source URL..."
                    className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs
                      dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
                  />
                  <button onClick={handleAddSource} className="rounded bg-teal-500 px-2 py-1 text-[10px] text-white hover:bg-teal-600">Add</button>
                </div>

                {/* Synthesize + Export */}
                <div className="flex gap-1">
                  <button
                    onClick={handleSynthesize}
                    disabled={isSynthesizing}
                    className="flex-1 rounded bg-teal-500 px-2 py-1.5 text-xs font-medium text-white hover:bg-teal-600 disabled:opacity-50"
                  >
                    {isSynthesizing ? 'Synthesizing...' : 'AI Synthesize'}
                  </button>
                  <button
                    onClick={handleExportNotes}
                    className="rounded bg-gray-100 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                  >
                    Export
                  </button>
                </div>

                {/* Notes */}
                {projectNotes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-semibold text-gray-500 uppercase">Notes</h4>
                    {projectNotes.map((note) => (
                      <div key={note.id} className="rounded-lg bg-gray-50 p-2 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300 whitespace-pre-wrap">
                        {note.content}
                      </div>
                    ))}
                  </div>
                )}

                {projectNotes.length === 0 && (
                  <p className="text-[11px] text-gray-400 text-center py-4">
                    Add sources and click "AI Synthesize" to generate notes.
                  </p>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
