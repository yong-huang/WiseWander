import type { DesignStyleData } from '../../shared/types'

/**
 * Extract design style data from the active webview for a given tab.
 * Follows the same pattern as extractPageContext in BrowserView.tsx.
 */
export async function extractDesignStyle(tabId: string): Promise<DesignStyleData | null> {
  const webview = document.querySelector(
    `webview[data-tab-id="${tabId}"]`
  ) as Electron.WebviewTag | null
  if (!webview) return null

  const script = `
  (function() {
    function frequency(arr) {
      const map = {};
      arr.forEach(v => { map[v] = (map[v] || 0) + 1; });
      return Object.entries(map).sort((a, b) => b[1] - a[1]).map(e => e[0]);
    }

    const elements = Array.from(document.querySelectorAll('*')).slice(0, 200);

    // CSS custom properties from :root
    const customProps = {};
    const rootStyles = getComputedStyle(document.documentElement);
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText === ':root') {
            const style = rule.style;
            for (let i = 0; i < style.length; i++) {
              const name = style[i];
              if (name.startsWith('--')) {
                customProps[name] = style.getPropertyValue(name).trim();
              }
            }
          }
        }
      } catch(e) { /* cross-origin stylesheet */ }
    }

    // Colors
    const bgColors = [], textColors = [], allColors = [];
    elements.forEach(el => {
      const s = getComputedStyle(el);
      bgColors.push(s.backgroundColor);
      textColors.push(s.color);
      allColors.push(s.backgroundColor, s.color);
    });

    // Fonts
    const families = [], sizes = [], weights = [];
    elements.forEach(el => {
      const s = getComputedStyle(el);
      families.push(s.fontFamily);
      sizes.push(s.fontSize);
      weights.push(s.fontWeight);
    });

    // Spacing
    const margins = [], paddings = [];
    elements.forEach(el => {
      const s = getComputedStyle(el);
      margins.push(s.marginTop);
      paddings.push(s.paddingTop);
    });

    // Borders
    const radii = [], borderWidths = [], borderColors = [];
    elements.forEach(el => {
      const s = getComputedStyle(el);
      radii.push(s.borderRadius);
      borderColors.push(s.borderColor);
    });

    // Shadows
    const boxShadows = [], textShadows = [];
    elements.forEach(el => {
      const s = getComputedStyle(el);
      if (s.boxShadow && s.boxShadow !== 'none') boxShadows.push(s.boxShadow);
      if (s.textShadow && s.textShadow !== 'none') textShadows.push(s.textShadow);
    });

    // Layout
    const displayTypes = {};
    let flexCount = 0, gridCount = 0;
    elements.forEach(el => {
      const d = getComputedStyle(el).display;
      displayTypes[d] = (displayTypes[d] || 0) + 1;
      if (d === 'flex' || d === 'inline-flex') flexCount++;
      if (d === 'grid' || d === 'inline-grid') gridCount++;
    });

    // Buttons (first 10)
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a[class*="btn"], [role="button"]')).slice(0, 10).map(el => {
      const s = getComputedStyle(el);
      return {
        text: (el.textContent || '').trim().slice(0, 50),
        backgroundColor: s.backgroundColor,
        color: s.color,
        borderRadius: s.borderRadius,
        padding: s.paddingTop + ' ' + s.paddingRight,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        fontFamily: s.fontFamily,
        border: s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderTopColor,
        boxShadow: s.boxShadow
      };
    });

    // Tables (first 5)
    const tables = Array.from(document.querySelectorAll('table')).slice(0, 5).map(table => {
      const s = getComputedStyle(table);
      const header = table.querySelector('th, thead td');
      let headerBackground = null, headerColor = null;
      if (header) {
        const hs = getComputedStyle(header);
        headerBackground = hs.backgroundColor;
        headerColor = hs.color;
      }
      return {
        borderCollapse: s.borderCollapse,
        headerBackground,
        headerColor
      };
    });

    // Form inputs (first 5)
    const forms = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select')).slice(0, 5).map(el => {
      const s = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        borderRadius: s.borderRadius,
        border: s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderTopColor,
        fontSize: s.fontSize,
        backgroundColor: s.backgroundColor
      };
    });

    // Images
    const imgs = Array.from(document.querySelectorAll('img'));
    let totalW = 0, totalH = 0;
    imgs.forEach(img => { totalW += img.naturalWidth || img.width; totalH += img.naturalHeight || img.height; });

    return JSON.stringify({
      url: location.href,
      title: document.title,
      cssCustomProperties: customProps,
      colors: {
        primary: frequency(allColors).slice(0, 5),
        backgrounds: frequency(bgColors).slice(0, 5),
        textColors: frequency(textColors).slice(0, 5)
      },
      fonts: {
        families: [...new Set(families)].slice(0, 5),
        sizes: [...new Set(sizes)].slice(0, 8),
        weights: [...new Set(weights)].slice(0, 5)
      },
      spacing: {
        margins: frequency(margins).slice(0, 5),
        paddings: frequency(paddings).slice(0, 5)
      },
      borders: {
        radii: frequency(radii).slice(0, 5),
        widths: frequency(borderWidths).slice(0, 5),
        colors: frequency(borderColors).slice(0, 5)
      },
      shadows: {
        box: [...new Set(boxShadows)].slice(0, 5),
        text: [...new Set(textShadows)].slice(0, 5)
      },
      layout: { displayTypes, flexCount, gridCount },
      buttons,
      tables,
      forms,
      images: {
        count: imgs.length,
        avgWidth: imgs.length ? Math.round(totalW / imgs.length) : 0,
        avgHeight: imgs.length ? Math.round(totalH / imgs.length) : 0
      }
    });
  })();
  `

  try {
    const raw = await webview.executeJavaScript(script)
    return JSON.parse(raw)
  } catch {
    return null
  }
}
