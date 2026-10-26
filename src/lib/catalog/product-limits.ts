// Shared by the editor and server validation so product copy fits the detail view.
export const PRODUCT_TEXT_LIMITS = {
  name: 60,
  short_description: 160,
  description: 240,
  size: 24,
  condition: 32,
  care_instructions: 240,
} as const;
