/** Utilidades de fecha para las vistas de agenda del trainer. */

/** Formatea una Date como `YYYY-MM-DD` en hora local. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Devuelve el lunes de la semana que contiene `d` (a medianoche local). */
export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (r.getDay() + 6) % 7; // 0 = lunes
  r.setDate(r.getDate() - offset);
  return r;
}

/** Devuelve una nueva Date desplazada `n` días. */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** Agrupa sesiones por su día local (`YYYY-MM-DD` → sesiones de ese día). */
export function sessionsByDay<T extends { starts_at: string | null }>(
  sessions: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const s of sessions) {
    if (!s.starts_at) continue;
    const key = dateKey(new Date(s.starts_at));
    const bucket = map.get(key);
    if (bucket) bucket.push(s);
    else map.set(key, [s]);
  }
  return map;
}
