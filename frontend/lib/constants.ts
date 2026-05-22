/**
 * Centralized application constants.
 *
 * WhatsApp number should match the business contact configured in SiteSettings.
 * Update WHATSAPP_NUMBER when the real business number is provided.
 */

export const WHATSAPP_NUMBER = '+573014645272';
export const WHATSAPP_URL = 'https://api.whatsapp.com/send/?phone=%2B573014645272&text&type=phone_number&app_absent=0';

/**
 * Bloques de comida — etiqueta, hora (formato 24h) y orden cronológico.
 * Fuente única para la vista del cliente (my-nutrition) y la del entrenador
 * (ClientNutritionTab). Debe coincidir con el backend:
 * core_app/views/nutrition_plan_views.py → MEAL_BLOCK_META.
 */
export type MealBlock = { key: string; label: string; time: string };

export const MEAL_BLOCKS: MealBlock[] = [
  { key: 'desayuno',     label: 'Desayuno',     time: '07:00' },
  { key: 'media_manana', label: 'Media mañana', time: '10:30' },
  { key: 'almuerzo',     label: 'Almuerzo',     time: '13:00' },
  { key: 'merienda',     label: 'Merienda',     time: '16:30' },
  { key: 'cena',         label: 'Cena',         time: '20:00' },
];

/** meal_block → índice cronológico, para ordenar listas de comidas. */
export const MEAL_BLOCK_ORDER: Record<string, number> = Object.fromEntries(
  MEAL_BLOCKS.map((b, i) => [b.key, i]),
);
