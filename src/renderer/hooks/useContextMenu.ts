import { useState, useCallback } from 'react'
import type { ContextMenuEntry } from '../components/common/ContextMenu'

export function useContextMenu() {
  const [menuVisible, setMenuVisible] = useState(false)
  const [menuX, setMenuX] = useState(0)
  const [menuY, setMenuY] = useState(0)
  const [menuItems, setMenuItems] = useState<ContextMenuEntry[]>([])

  const showMenu = useCallback((e: React.MouseEvent, items: ContextMenuEntry[]) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuItems(items)
    setMenuX(e.clientX)
    setMenuY(e.clientY)
    setMenuVisible(true)
  }, [])

  const hideMenu = useCallback(() => {
    setMenuVisible(false)
  }, [])

  return { menuVisible, menuX, menuY, menuItems, showMenu, hideMenu }
}
