// Dynamic Context-Aware Global Touch & Click Selection System
// Excludes File Manager completely (File Manager maintains its own internal selection logic)

let activeElement: HTMLElement | null = null;

function getElementThemeColors(el: HTMLElement) {
  const classStr = (el.className && typeof el.className === 'string' ? el.className : '') + ' ' + (el.parentElement?.className && typeof el.parentElement?.className === 'string' ? el.parentElement.className : '');
  const lowerClasses = classStr.toLowerCase();

  // 1. Red / Rose / Danger / Stop / Kill / Delete
  if (
    lowerClasses.includes('rose') ||
    lowerClasses.includes('red') ||
    lowerClasses.includes('danger') ||
    lowerClasses.includes('delete') ||
    lowerClasses.includes('trash') ||
    lowerClasses.includes('kill') ||
    lowerClasses.includes('stop')
  ) {
    return {
      bg: 'rgba(244, 63, 94, 0.28)',
      shadow: '0 0 16px rgba(244, 63, 94, 0.40)',
      textBg: 'rgba(244, 63, 94, 0.24)',
      textBorder: 'none'
    };
  }

  // 2. Green / Emerald / Success / Play / Start / Online
  if (
    lowerClasses.includes('emerald') ||
    lowerClasses.includes('green') ||
    lowerClasses.includes('start') ||
    lowerClasses.includes('running') ||
    lowerClasses.includes('online') ||
    lowerClasses.includes('success')
  ) {
    return {
      bg: 'rgba(16, 185, 129, 0.28)',
      shadow: '0 0 16px rgba(16, 185, 129, 0.40)',
      textBg: 'rgba(16, 185, 129, 0.24)',
      textBorder: 'none'
    };
  }

  // 3. Amber / Yellow / Orange / Warning / Restart
  if (
    lowerClasses.includes('amber') ||
    lowerClasses.includes('orange') ||
    lowerClasses.includes('yellow') ||
    lowerClasses.includes('restart') ||
    lowerClasses.includes('warning')
  ) {
    return {
      bg: 'rgba(245, 158, 11, 0.28)',
      shadow: '0 0 16px rgba(245, 158, 11, 0.40)',
      textBg: 'rgba(245, 158, 11, 0.24)',
      textBorder: 'none'
    };
  }

  // 4. Blue / Sky / Cyan / Info
  if (
    lowerClasses.includes('sky') ||
    lowerClasses.includes('cyan') ||
    lowerClasses.includes('blue') ||
    lowerClasses.includes('info')
  ) {
    return {
      bg: 'rgba(14, 165, 233, 0.28)',
      shadow: '0 0 16px rgba(14, 165, 233, 0.40)',
      textBg: 'rgba(14, 165, 233, 0.24)',
      textBorder: 'none'
    };
  }

  // 5. Purple / Fuchsia / Violet
  if (
    lowerClasses.includes('purple') ||
    lowerClasses.includes('fuchsia') ||
    lowerClasses.includes('violet')
  ) {
    return {
      bg: 'rgba(168, 85, 247, 0.26)',
      shadow: '0 0 16px rgba(168, 85, 247, 0.35)',
      textBg: 'rgba(168, 85, 247, 0.22)',
      textBorder: 'none'
    };
  }

  // 6. Dynamic check from computed color, background or border
  try {
    const computed = window.getComputedStyle(el);
    const colorsToTest = [computed.color, computed.backgroundColor, computed.borderColor];
    for (const colorStr of colorsToTest) {
      if (colorStr && colorStr.startsWith('rgb') && !colorStr.startsWith('rgba(0, 0, 0, 0)')) {
        const match = colorStr.match(/\d+/g);
        if (match && match.length >= 3) {
          const [r, g, b] = match.map(Number);
          const isColored = Math.abs(r - g) > 20 || Math.abs(g - b) > 20 || Math.abs(r - b) > 20;
          if (isColored && !(r < 30 && g < 30 && b < 30) && !(r > 240 && g > 240 && b > 240)) {
            return {
              bg: `rgba(${r}, ${g}, ${b}, 0.26)`,
              shadow: `0 0 16px rgba(${r}, ${g}, ${b}, 0.35)`,
              textBg: `rgba(${r}, ${g}, ${b}, 0.22)`,
              textBorder: 'none'
            };
          }
        }
      }
    }
  } catch {}

  // 7. Dark / Neutral / Default clean highlight (No outline, natural soft background fill & glow)
  return {
    bg: 'rgba(255, 255, 255, 0.18)',
    shadow: '0 0 14px rgba(255, 255, 255, 0.15)',
    textBg: 'rgba(255, 255, 255, 0.16)',
    textBorder: 'none'
  };
}

function clearElementHighlight(el: HTMLElement) {
  el.removeAttribute('data-touch-active');
  el.classList.remove('global-touch-active');
  el.style.removeProperty('--touch-highlight-bg');
  el.style.removeProperty('--touch-highlight-shadow');
  el.style.removeProperty('--touch-text-bg');
  el.style.removeProperty('--touch-text-border');
}

function applyElementHighlight(el: HTMLElement) {
  const theme = getElementThemeColors(el);
  el.style.setProperty('--touch-highlight-bg', theme.bg);
  el.style.setProperty('--touch-highlight-shadow', theme.shadow);
  el.style.setProperty('--touch-text-bg', theme.textBg);
  el.style.setProperty('--touch-text-border', theme.textBorder);
  el.setAttribute('data-touch-active', 'true');
  el.classList.add('global-touch-active');
}

export function initGlobalTouchSystem() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const handleInteraction = (targetElement: HTMLElement | null) => {
    if (!targetElement) return;

    // EXCLUDE File Manager completely: let File Manager handle its own internal selection
    if (
      targetElement.closest('[data-file-manager]') ||
      targetElement.closest('table') ||
      targetElement.closest('[data-component="file-manager"]') ||
      targetElement.closest('.monaco-editor') ||
      targetElement.closest('.vscode-editor-container')
    ) {
      return;
    }

    // Find the closest interactive container or element
    const interactiveTarget = targetElement.closest<HTMLElement>(
      'button, a, [role="button"], .glass-card, .cursor-pointer, input[type="button"], input[type="submit"], select, [data-interactive], .touch-target, [role="tab"], [role="menuitem"], li.cursor-pointer, .interactive-item, span, p, label, h1, h2, h3, h4, h5, h6, svg'
    );

    if (interactiveTarget) {
      // If we tapped the same element, keep it active
      if (activeElement === interactiveTarget) {
        return;
      }

      // Remove active state from previous element
      if (activeElement && activeElement !== interactiveTarget) {
        clearElementHighlight(activeElement);
      }

      // Apply dynamic matching highlight to newly selected target
      applyElementHighlight(interactiveTarget);
      activeElement = interactiveTarget;
    }
  };

  // Pointerdown / touchstart / click capture
  document.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      handleInteraction(target);
    },
    { passive: true, capture: true }
  );

  document.addEventListener(
    'click',
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      handleInteraction(target);
    },
    { passive: true, capture: true }
  );
}

export function clearActiveTouchSelection() {
  if (activeElement) {
    clearElementHighlight(activeElement);
    activeElement = null;
  }
}

export function setActiveTouchElement(element: HTMLElement | null) {
  if (activeElement && activeElement !== element) {
    clearElementHighlight(activeElement);
  }
  activeElement = element;
  if (activeElement) {
    applyElementHighlight(activeElement);
  }
}

