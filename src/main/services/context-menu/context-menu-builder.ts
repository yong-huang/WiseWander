import { Menu, clipboard, webContents, type MenuItemConstructorOptions, type WebContents } from 'electron'
import type { WebviewContextParams, ContextMenuAction } from '../../../shared/types.js'
import { IPC_CHANNELS } from '../../../shared/ipc-channels.js'

export function buildWebviewContextMenu(
  params: WebviewContextParams,
  mainWindowWebContents: WebContents,
): Menu {
  const items: MenuItemConstructorOptions[] = []
  const { linkURL, mediaType, srcURL, selectionText, isEditable, editFlags, pageURL, pageTitle } = params

  // ── Editable field operations (before link/media/selection) ──
  if (isEditable) {
    if (editFlags.canUndo) items.push({ label: 'Undo', role: 'undo' })
    if (editFlags.canRedo) items.push({ label: 'Redo', role: 'redo' })
    if (items.length > 0) items.push({ type: 'separator' })
    if (editFlags.canCut) items.push({ label: 'Cut', role: 'cut' })
    if (editFlags.canCopy) items.push({ label: 'Copy', role: 'copy' })
    if (editFlags.canPaste) items.push({ label: 'Paste', role: 'paste' })
    if (editFlags.canDelete) items.push({ label: 'Delete', role: 'delete' })
    if (items.length > (editFlags.canUndo || editFlags.canRedo ? 3 : 0)) {
      items.push({ type: 'separator' })
    }
    if (editFlags.canSelectAll) items.push({ label: 'Select All', role: 'selectAll' })
  }

  // ── Link operations ──
  if (linkURL) {
    items.push(
      { label: 'Open Link', click: () => { webContents.fromId(params.webContentsId)?.loadURL(linkURL) } },
      {
        label: 'Open Link in New Tab',
        click: () => sendAction(mainWindowWebContents, { type: 'open-link-new-tab', url: linkURL }),
      },
      { type: 'separator' },
      {
        label: 'Copy Link Address',
        click: () => { clipboard.writeText(linkURL) },
      },
    )
  }

  // ── Image operations ──
  if (mediaType === 'image' && srcURL) {
    items.push(
      {
        label: 'Open Image in New Tab',
        click: () => sendAction(mainWindowWebContents, { type: 'open-link-new-tab', url: srcURL }),
      },
      {
        label: 'Copy Image URL',
        click: () => { clipboard.writeText(srcURL) },
      },
      {
        label: 'Save Image As…',
        click: () => {
          const wc = webContents.fromId(params.webContentsId)
          wc?.downloadURL(srcURL)
        },
      },
    )
  }

  // ── Selection operations ──
  if (selectionText && !isEditable) {
    if (items.length > 0) items.push({ type: 'separator' })
    items.push(
      {
        label: 'Copy',
        click: () => { clipboard.writeText(selectionText) },
      },
      {
        label: 'Search with Google',
        click: () => sendAction(mainWindowWebContents, { type: 'search-selection', text: selectionText }),
      },
      { type: 'separator' },
      {
        label: 'Summarize Selection',
        click: () => sendAction(mainWindowWebContents, { type: 'ai-summarize-selection', text: selectionText }),
      },
      {
        label: 'Translate Selection',
        click: () => sendAction(mainWindowWebContents, { type: 'ai-translate-selection', text: selectionText }),
      },
    )
  }

  // ── Page-level operations (always available unless link/image/selection shown items) ──
  if (!linkURL && mediaType === 'none' && !selectionText && !isEditable) {
    items.push(
      { label: 'Back', click: () => { webContents.fromId(params.webContentsId)?.goBack() } },
      { label: 'Forward', click: () => { webContents.fromId(params.webContentsId)?.goForward() } },
      { label: 'Reload', click: () => { webContents.fromId(params.webContentsId)?.reload() } },
      { type: 'separator' },
      {
        label: 'Bookmark This Page',
        click: () => sendAction(mainWindowWebContents, { type: 'bookmark-page', title: pageTitle, url: pageURL }),
      },
      { type: 'separator' },
      {
        label: 'View Page Source',
        click: () => mainWindowWebContents.loadURL(`view-source:${pageURL}`),
      },
    )
  }

  // ── Always add Inspect Element at the end ──
  items.push({ type: 'separator' })
  items.push({
    label: 'Inspect Element',
    click: () => {
      webContents.fromId(params.webContentsId)?.inspectElement(params.x, params.y)
    },
  })

  return Menu.buildFromTemplate(items)
}

function sendAction(wc: WebContents, action: ContextMenuAction): void {
  wc.send(IPC_CHANNELS.CONTEXT_MENU_ACTION, action)
}
