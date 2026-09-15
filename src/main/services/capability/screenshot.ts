import { nativeImage, type NativeImage } from 'electron'
import type { ScreenshotProgress } from '../../../shared/types'

const SCROLL_DELAY_MS = 150

function getWebContents(wcId: number): Electron.WebContents {
  const wc = require('electron').webContents.getAllWebContents().find((w: Electron.WebContents) => w.id === wcId)
  if (!wc) throw new Error(`WebContents with id ${wcId} not found`)
  return wc
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function hideStickyElements(wc: Electron.WebContents): Promise<void> {
  await wc.executeJavaScript(`
    (function() {
      if (window.__wiseWanderScreenshotHidden) return;
      window.__wiseWanderScreenshotHidden = true;
      const els = document.querySelectorAll('*');
      const toHide = [];
      for (const el of els) {
        const style = getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          toHide.push(el);
        }
      }
      window.__wiseWanderHiddenEls = toHide;
      for (const el of toHide) {
        el.style.setProperty('--ww-screenshot-vis', el.style.visibility);
        el.style.visibility = 'hidden';
      }
    })()
  `)
}

async function restoreStickyElements(wc: Electron.WebContents): Promise<void> {
  await wc.executeJavaScript(`
    (function() {
      if (!window.__wiseWanderScreenshotHidden) return;
      window.__wiseWanderScreenshotHidden = false;
      const toRestore = window.__wiseWanderHiddenEls || [];
      for (const el of toRestore) {
        const orig = el.style.getPropertyValue('--ww-screenshot-vis');
        el.style.visibility = orig || '';
        el.style.removeProperty('--ww-screenshot-vis');
      }
      delete window.__wiseWanderHiddenEls;
    })()
  `)
}

export class ScreenshotCapturer {
  async captureVisible(wcId: number): Promise<NativeImage> {
    const wc = getWebContents(wcId)
    const { width, height, devicePixelRatio } = await wc.executeJavaScript(`
      ({
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1
      })
    `)

    const image = await wc.capturePage({
      x: 0,
      y: 0,
      width: Math.round(width * devicePixelRatio),
      height: Math.round(height * devicePixelRatio),
    })
    return image
  }

  async captureFullPage(
    wcId: number,
    onProgress?: (progress: ScreenshotProgress) => void,
  ): Promise<NativeImage> {
    const wc = getWebContents(wcId)

    const pageInfo = await wc.executeJavaScript(`
      ({
        width: window.innerWidth,
        height: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        scrollY: window.scrollY,
        devicePixelRatio: window.devicePixelRatio || 1
      })
    `)

    const { width, height, scrollHeight, scrollY, devicePixelRatio } = pageInfo
    const dpr = devicePixelRatio || 1
    const captureHeight = Math.round(height * dpr)
    const captureWidth = Math.round(width * dpr)
    const totalScrollHeight = Math.round(scrollHeight * dpr)

    if (totalScrollHeight <= captureHeight) {
      return this.captureVisible(wcId)
    }

    const originalScrollY = scrollY

    try {
      await hideStickyElements(wc)

      // Scroll to top first
      await wc.executeJavaScript(`window.scrollTo(0, 0)`)
      await sleep(SCROLL_DELAY_MS)

      const sections: NativeImage[] = []
      const sectionCount = Math.ceil(totalScrollHeight / captureHeight)

      for (let i = 0; i < sectionCount; i++) {
        onProgress?.({
          status: 'capturing',
          currentSection: i + 1,
          totalSections: sectionCount,
        })

        const yOffset = i * captureHeight
        const sectionCaptureHeight = Math.min(captureHeight, totalScrollHeight - yOffset)

        // Scroll to capture position
        await wc.executeJavaScript(`window.scrollTo(0, ${yOffset / dpr})`)
        await sleep(SCROLL_DELAY_MS)

        const image = await wc.capturePage({
          x: 0,
          y: 0,
          width: captureWidth,
          height: sectionCaptureHeight,
        })
        sections.push(image)
      }

      onProgress?.({ status: 'stitching', currentSection: sectionCount, totalSections: sectionCount })

      return this.stitchImages(sections, captureWidth, totalScrollHeight)
    } finally {
      await restoreStickyElements(wc)
      await wc.executeJavaScript(`window.scrollTo(0, ${originalScrollY})`)
    }
  }

  private stitchImages(sections: NativeImage[], width: number, totalHeight: number): NativeImage {
    // Each NativeImage.toBitmap() returns BGRA pixel data
    const rowBytes = width * 4
    const buffer = Buffer.alloc(totalHeight * rowBytes)

    let currentY = 0
    for (const section of sections) {
      const bitmap = section.toBitmap()
      const sectionHeight = bitmap.length / rowBytes
      bitmap.copy(buffer, currentY * rowBytes, 0, Math.min(bitmap.length, buffer.length - currentY * rowBytes))
      currentY += sectionHeight
    }

    return nativeImage.createFromBitmap(buffer, { width, height: totalHeight })
  }
}
