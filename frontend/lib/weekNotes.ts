export type WeekState = 'done' | 'active' | 'locked';

export type WeekSlot = { week: number; state: WeekState };

/**
 * Calcula el estado de las 4 semanas de un ciclo a partir de las notas guardadas.
 * - done:   la semana tiene contenido no vacío.
 * - active: la semana está vacía y (es la 1 o la anterior tiene contenido).
 * - locked: la semana está vacía y la anterior también.
 */
export function computeWeekStates(notesByWeek: Record<number, string>): WeekSlot[] {
  const hasContent = (w: number) => {
    const value = notesByWeek[w];
    return !!(value && value.trim());
  };
  return [1, 2, 3, 4].map((week) => {
    if (hasContent(week)) return { week, state: 'done' as WeekState };
    if (week === 1 || hasContent(week - 1)) return { week, state: 'active' as WeekState };
    return { week, state: 'locked' as WeekState };
  });
}
