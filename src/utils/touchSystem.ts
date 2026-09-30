// Lightweight Momentary Touch & Click Animation System
// Excludes File Manager completely (File Manager maintains its own internal selection logic)

export function initGlobalTouchSystem() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const handlePointerDown = (e: Event) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    // EXCLUDE File Manager completely
    if (
      target.closest('[data-file-manager]') ||
      target.closest('table') ||
      target.closest('[data-component="file-manager"]') ||
      target.closest('.monaco-editor') ||
      target.closest('.vscode-editor-container')
    ) {
      return;
    }

    // Find interactive container
    const interactiveTarget = target.closest<HTMLElement>(
      'button, a, [role="button"], .glass-card, .cursor-pointer, input[type="button"], input[type="submit"], [role="tab"], [role="menuitem"], li.cursor-pointer, span, p, label, h1, h2, h3, h4, svg'
    );

    if (interactiveTarget) {
      interactiveTarget.classList.add('click-active');
      setTimeout(() => {
        interactiveTarget.classList.remove('click-active');
      }, 160);
    }
  };

  const eventTypes = ['pointerdown', 'touchstart', 'mousedown'];
  for (const evt of eventTypes) {
    document.addEventListener(evt, handlePointerDown, { passive: true, capture: true });
  }
}

export function clearActiveTouchSelection() {
  // Clean up any lingering active elements
  const activeEls = document.querySelectorAll('.click-active, [data-touch-active]');
  activeEls.forEach((el) => {
    el.classList.remove('click-active');
    el.removeAttribute('data-touch-active');
  });
}

export function setActiveTouchElement(_element: HTMLElement | null) {
  // No-op for persistent touch element
}
