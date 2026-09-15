import { useState } from 'react'
import { useDevToolsStore, type DOMNode } from '../../store/devtools-store'

interface ElementsPanelProps {
  tabId: string
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: DOMNode
  depth: number
  selectedPath: string
  onSelect: (path: string) => void
}): React.ReactElement | null {
  const [expanded, setExpanded] = useState(depth < 2)

  if (node.type === 'text') {
    if (!node.content) return null
    return (
      <div
        className="py-0.5 text-gray-500 dark:text-gray-400"
        style={{ paddingLeft: depth * 16 }}
      >
        &quot;{node.content.length > 120 ? node.content.slice(0, 120) + '...' : node.content}&quot;
      </div>
    )
  }

  if (!node.tag) return null

  const hasChildren = node.children && node.children.length > 0
  const selfPath = `${depth}-${node.tag}`

  return (
    <div>
      <div
        className="flex cursor-pointer items-start py-0.5 hover:bg-blue-50 dark:hover:bg-blue-950/30"
        style={{ paddingLeft: depth * 16 }}
        onClick={() => onSelect(selfPath)}
      >
        {/* Toggle */}
        <span
          className="mr-1 inline-block w-3 shrink-0 text-center text-[10px] text-gray-400"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
        >
          {hasChildren ? (expanded ? '\u25BC' : '\u25B6') : ' '}
        </span>

        {/* Tag opening */}
        <span className="whitespace-nowrap">
          <span className="text-purple-700 dark:text-purple-400">&lt;{node.tag}</span>
          {node.attrs &&
            Object.entries(node.attrs).map(([k, v]) => (
              <span key={k}>
                {' '}
                <span className="text-red-600 dark:text-red-400">{k}</span>=
                <span className="text-green-700 dark:text-green-400">
                  &quot;{v.length > 50 ? v.slice(0, 50) + '...' : v}&quot;
                </span>
              </span>
            ))}
          <span className="text-purple-700 dark:text-purple-400">&gt;</span>
        </span>

        {/* Inline content if no children */}
        {!hasChildren && node.content && (
          <span className="mx-1 truncate text-gray-600 dark:text-gray-400">
            {node.content.length > 60 ? node.content.slice(0, 60) + '...' : node.content}
          </span>
        )}
        {!hasChildren && (
          <span className="text-purple-700 dark:text-purple-400">
            &lt;/{node.tag}&gt;
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child, i) => (
            <TreeNode
              key={i}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
          <div style={{ paddingLeft: depth * 16 }}>
            <span className="ml-4 text-purple-700 dark:text-purple-400">
              &lt;/{node.tag}&gt;
            </span>
          </div>
        </div>
      )}

      {/* Collapsed hint */}
      {!expanded && hasChildren && (
        <span className="text-gray-400"> ... &lt;/{node.tag}&gt;</span>
      )}
    </div>
  )
}

export function ElementsPanel({ tabId }: ElementsPanelProps): React.ReactElement {
  const { elementsData, setElements } = useDevToolsStore()
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const tree = elementsData.get(tabId) ?? null

  const handleRefresh = async (): Promise<void> => {
    const wv = document.querySelector(
      `webview[data-tab-id="${tabId}"]`
    ) as Electron.WebviewTag | null
    if (!wv) return
    setLoading(true)
    try {
      const raw = await wv.executeJavaScript(`
        (function(){
          function serialize(node, depth) {
            if (depth > 12) return null;
            if (node.nodeType === 3) {
              var t = node.textContent.trim();
              return t ? {type:'text',content:t.slice(0,300)} : null;
            }
            if (node.nodeType !== 1) return null;
            var attrs = {};
            for (var i = 0; i < node.attributes.length; i++) {
              var a = node.attributes[i];
              if (a.name !== 'data-tab-id') attrs[a.name] = a.value;
            }
            var children = [];
            for (var j = 0; j < node.childNodes.length; j++) {
              var s = serialize(node.childNodes[j], depth + 1);
              if (s) children.push(s);
            }
            return {
              type: 'element',
              tag: node.tagName.toLowerCase(),
              attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
              children: children.length > 0 ? children : undefined,
              content: children.length === 0 && node.textContent.trim()
                ? node.textContent.trim().slice(0,200) : undefined
            };
          }
          return JSON.stringify(serialize(document.documentElement, 0));
        })()
      `)
      const parsed = JSON.parse(raw)
      setElements(tabId, parsed)
    } catch {
      setElements(tabId, null)
    } finally {
      setLoading(false)
    }
  }

  const handleGetStyles = async (): Promise<void> => {
    if (!selectedElement) return
    // Could expand to show computed styles for selected element
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-2 py-1 dark:border-gray-700">
        <span className="text-[11px] text-gray-500">DOM Tree</span>
        <div className="flex-1" />
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="rounded px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {!tree ? (
          <div className="p-3 text-gray-400">
            Click Refresh to load DOM tree.
          </div>
        ) : (
          <TreeNode
            node={tree}
            depth={0}
            selectedPath={selectedElement ?? ''}
            onSelect={setSelectedElement}
          />
        )}
      </div>

      {/* Selected element info */}
      {selectedElement && (
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-850">
          <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">
            Selected Element
          </div>
          <div className="mt-0.5 text-[11px] text-gray-500">{selectedElement}</div>
          <button
            onClick={handleGetStyles}
            className="mt-1 rounded bg-gray-200 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
          >
            Inspect Styles
          </button>
        </div>
      )}
    </div>
  )
}
