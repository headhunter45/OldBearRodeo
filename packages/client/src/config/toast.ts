/// <reference types="vite/client" />

export const TOAST_DURATION_MS: number = (() => {
  const raw =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TOAST_DURATION_MS) ||
    (typeof process !== 'undefined' && (process.env?.VITE_TOAST_DURATION_MS || process.env?.TOAST_DURATION_MS));
  if (raw) {
    const parsed = parseInt(String(raw), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 4500;
})();
