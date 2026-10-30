// Reparte las horas de turno de una persona en tres grupos:
//  · limpiando  = dentro de sus limpiezas (Start Time → End Time)
//  · traslado   = hueco entre limpiezas (o antes de la 1ª / después de la última), hasta TRAVEL_CAP_MIN por hueco
//  · tiempo muerto = lo que exceda ese tope en cada hueco
export const TRAVEL_CAP_MIN = 45
export interface Split { total: number; clean: number; travel: number; dead: number } // en milisegundos
export function splitShift(startMs: number, endMs: number, intervals: { s: number; e: number }[], capMin = TRAVEL_CAP_MIN): Split {
  const S = startMs, E = Math.max(endMs, startMs)
  const iv = intervals.map(i => ({ s: Math.max(S, i.s), e: Math.min(E, i.e) })).filter(i => i.e > i.s).sort((a, b) => a.s - b.s)
  const merged: { s: number; e: number }[] = []
  for (const i of iv) { const l = merged[merged.length - 1]; if (l && i.s <= l.e) l.e = Math.max(l.e, i.e); else merged.push({ ...i }) }
  const clean = merged.reduce((t, i) => t + (i.e - i.s), 0)
  const cap = capMin * 60000
  let travel = 0, dead = 0, cur = S
  const gap = (a: number, b: number) => { const g = Math.max(0, b - a); travel += Math.min(g, cap); dead += Math.max(0, g - cap) }
  for (const i of merged) { gap(cur, i.s); cur = i.e }
  gap(cur, E)
  return { total: E - S, clean, travel, dead }
}
export const fmtH = (ms: number) => { const m = Math.round(ms / 60000); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` }
