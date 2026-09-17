export interface ColorOption {
  name: string;
  value: string;
}

/**
 * Configure all available colors used for:
 * - Player pointers and laser trail
 * - Player avatar background and rings
 * - Token borders and ring color selection
 * - Custom drawing markers
 */
export const AVAILABLE_COLORS: ColorOption[] = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Rose Red', value: '#ef4444' },
  { name: 'Emerald Green', value: '#10b981' },
  { name: 'Amber Gold', value: '#f59e0b' },
  { name: 'Sky Blue', value: '#0ea5e9' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Violet', value: '#a855f7' },
  { name: 'Crisp White', value: '#ffffff' },
];

export const COLOR_VALUES = AVAILABLE_COLORS.map((c) => c.value);
