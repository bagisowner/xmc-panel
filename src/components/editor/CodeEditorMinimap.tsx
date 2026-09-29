import React, { useRef, useEffect, useCallback } from 'react';
import { EditorView } from '@codemirror/view';

interface CodeEditorMinimapProps {
  view: EditorView | null;
  content: string;
}

export const CodeEditorMinimap: React.FC<CodeEditorMinimapProps> = ({ view, content }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  // Render miniature document onto canvas
  const renderMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = container.clientWidth || 72;
    const height = container.clientHeight || 400;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#080517';
    ctx.fillRect(0, 0, width, height);

    const lines = content.split('\n');
    const totalLines = Math.max(lines.length, 1);
    const lineHeight = Math.max(height / Math.max(totalLines, 30), 2);

    // Render miniature lines
    for (let i = 0; i < totalLines; i++) {
      const line = lines[i] || '';
      const trimmed = line.trim();
      if (!trimmed) continue;

      const y = i * lineHeight;
      if (y > height) break;

      const indent = line.search(/\S/);
      const startX = Math.min(indent * 2 + 6, width - 10);
      const lineWidth = Math.min(trimmed.length * 1.2, width - startX - 4);

      if (trimmed.startsWith('#') || trimmed.startsWith('!')) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.45)'; // Comment
      } else if (trimmed.includes('=') || trimmed.includes(':')) {
        ctx.fillStyle = 'rgba(192, 132, 252, 0.65)'; // Key-value
      } else {
        ctx.fillStyle = 'rgba(241, 245, 249, 0.4)'; // General
      }

      ctx.fillRect(startX, y, Math.max(lineWidth, 3), Math.max(lineHeight - 0.6, 1));
    }

    // Render active visible viewport rectangle if editor view is ready
    if (view && view.scrollDOM) {
      const scrollDOM = view.scrollDOM;
      const scrollHeight = scrollDOM.scrollHeight || 1;
      const clientHeight = scrollDOM.clientHeight || 1;
      const scrollTop = scrollDOM.scrollTop || 0;

      const scrollRatioTop = scrollTop / scrollHeight;
      const scrollRatioHeight = clientHeight / scrollHeight;

      const rectY = scrollRatioTop * height;
      const rectH = Math.max(scrollRatioHeight * height, 16);

      // Viewport highlight
      ctx.fillStyle = 'rgba(168, 85, 247, 0.16)';
      ctx.fillRect(0, rectY, width, rectH);

      // Viewport border
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, rectY + 0.5, width - 1, rectH - 1);
    }
  }, [content, view]);

  // Update canvas on content change or editor scroll
  useEffect(() => {
    renderMinimap();

    if (!view || !view.scrollDOM) return;
    const scrollDOM = view.scrollDOM;

    const handleScroll = () => {
      renderMinimap();
    };

    scrollDOM.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', renderMinimap, { passive: true });

    return () => {
      scrollDOM.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', renderMinimap);
    };
  }, [view, content, renderMinimap]);

  // Handle clicking or dragging on minimap to scroll editor
  const scrollToMinimapPos = (clientY: number) => {
    if (!view || !view.scrollDOM || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const ratio = Math.max(0, Math.min(relativeY / rect.height, 1));

    const scrollDOM = view.scrollDOM;
    const targetScroll = ratio * (scrollDOM.scrollHeight - scrollDOM.clientHeight);
    scrollDOM.scrollTop = targetScroll;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    scrollToMinimapPos(e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isDraggingRef.current) {
        scrollToMinimapPos(moveEvent.clientY);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const [isDesktop, setIsDesktop] = React.useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1280 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1280);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isDesktop) return null;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      className="hidden xl:block w-16 lg:w-20 shrink-0 h-full border-l border-purple-500/20 bg-[#080517] relative select-none cursor-pointer overflow-hidden"
      title="Minimap - Click or drag to navigate"
    >
      <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />
    </div>
  );
};
