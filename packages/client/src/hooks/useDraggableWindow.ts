import { useState, useRef, useEffect, useCallback } from 'react';

interface UseDraggableOptions {
  initialX?: number;
  initialY?: number;
  storageKey?: string;
}

export function useDraggableWindow(options: UseDraggableOptions = {}) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    if (options.storageKey) {
      try {
        const saved = localStorage.getItem(options.storageKey);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    if (options.initialX !== undefined && options.initialY !== undefined) {
      return { x: options.initialX, y: options.initialY };
    }
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Disable drag on mobile/narrow screens
    if (typeof window !== 'undefined' && window.innerWidth <= 768) return;

    // Don't drag if clicking buttons, inputs, links, or elements with no-drag class
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a, .no-drag')) {
      return;
    }

    const rect = windowRef.current?.getBoundingClientRect();
    const currentX = rect ? rect.left : (position?.x ?? 0);
    const currentY = rect ? rect.top : (position?.y ?? 0);

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: currentX,
      startY: currentY,
    };
    setIsDragging(true);
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      const rect = windowRef.current?.getBoundingClientRect();
      const winW = rect?.width || 320;

      const newX = Math.max(0, Math.min(window.innerWidth - winW, dragStartRef.current.startX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 50, dragStartRef.current.startY + dy));

      const newPos = { x: newX, y: newY };
      setPosition(newPos);

      if (options.storageKey) {
        try {
          localStorage.setItem(options.storageKey, JSON.stringify(newPos));
        } catch {}
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, options.storageKey]);

  return {
    windowRef,
    position,
    setPosition,
    isDragging,
    handleMouseDown,
  };
}
