const STYLE_ID = 'wisewander-css-editor-injection'

/**
 * Inject CSS into a webview for live preview.
 * Returns true if injection succeeded.
 */
export async function injectCss(tabId: string, selector: string, css: string): Promise<boolean> {
  const webview = document.querySelector(`webview[data-tab-id="${tabId}"]`) as Electron.WebviewTag | null
  if (!webview) return false

  const escapedCss = css.replace(/`/g, '\\`').replace(/\\/g, '\\\\')
  const escapedSelector = selector.replace(/`/g, '\\`').replace(/'/g, "\\'")

  const script = `
    (function() {
      let styleEl = document.getElementById('${STYLE_ID}');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = '${STYLE_ID}';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = '${escapedSelector} { ${escapedCss} }';
    })();
  `

  await webview.executeJavaScript(script)
  return true
}

/**
 * Remove previously injected CSS from a webview.
 */
export async function removeInjectedCss(tabId: string): Promise<boolean> {
  const webview = document.querySelector(`webview[data-tab-id="${tabId}"]`) as Electron.WebviewTag | null
  if (!webview) return false

  const script = `
    (function() {
      const styleEl = document.getElementById('${STYLE_ID}');
      if (styleEl) styleEl.remove();
    })();
  `

  await webview.executeJavaScript(script)
  return true
}

/**
 * Get the current computed CSS for an element matching a selector.
 */
export async function getElementCss(tabId: string, selector: string): Promise<string> {
  const webview = document.querySelector(`webview[data-tab-id="${tabId}"]`) as Electron.WebviewTag | null
  if (!webview) return ''

  const escapedSelector = selector.replace(/`/g, '\\`').replace(/'/g, "\\'")

  const script = `
    (function() {
      const el = document.querySelector('${escapedSelector}');
      if (!el) return '';
      const computed = window.getComputedStyle(el);
      const props = ['background', 'color', 'font-size', 'font-weight', 'font-family',
        'padding', 'margin', 'border', 'border-radius', 'box-shadow', 'display',
        'width', 'height', 'line-height', 'text-align', 'opacity', 'transform'];
      return props.map(p => p + ': ' + computed.getPropertyValue(p)).join('; ');
    })();
  `

  return (await webview.executeJavaScript(script)) as string
}
