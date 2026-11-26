// Matematica de la Cascada (sin dependencias, probada con scripts/test)
// Identidad: RevPAH = Carga x Precio / Ritmo, con
//   Carga = HH facturadas / HH disponibles, Precio = ingreso / HH estandar, Ritmo = HH reales / HH estandar
export type SegKey = 'STR' | 'Relleno' | 'Deep'
export interface SegW { n: number; nDone: number; nMed: number; hh: number; rev: number; std: number; ingDay: number[]; pend: { n: number; price: number; std: number; hh: number; day: number[] } }
export interface WeekRaw { mon: string; cur: boolean; future: boolean; elapsed: number; cleaners: number; seg: Record<SegKey, SegW> }
export const SEGS: SegKey[] = ['STR', 'Relleno', 'Deep']
export const CAP_H = 48

export interface TypeM { hh: number; rev: number; std: number; n: number }
export interface WeekM { mon: string; cap: number; cleaners: number; byType: Record<SegKey, TypeM> }

// Semana -> medidas. La semana en curso se PROYECTA: lo terminado + lo programado que falta,
// con el ritmo (HH reales / estandar) que ya llevan las terminadas de cada tipo (100% si aun no hay).
// La capacidad es siempre la semana completa (cleaners x 48 h).
export interface Proj { seg: SegKey; ritmo: number; ritmoSupuesto: boolean; pendStd: number; pendPrice: number; pendN: number }
export function weekM(w: WeekRaw, info?: Proj[]): WeekM {
  const cap = w.cleaners * CAP_H
  const byType = {} as Record<SegKey, TypeM>
  for (const k of SEGS) {
    const g = w.seg[k]; let hh = g.hh, rev = g.rev, std = g.std, n = g.nMed
    if (w.cur) {
      const ritmo = g.std > 0 && g.hh > 0 ? g.hh / g.std : 1
      hh += g.pend.std * ritmo; rev += g.pend.price; std += g.pend.std; n += g.pend.n
      info?.push({ seg: k, ritmo, ritmoSupuesto: !(g.std > 0 && g.hh > 0), pendStd: g.pend.std, pendPrice: g.pend.price, pendN: g.pend.n })
    }
    byType[k] = { hh, rev, std, n }
  }
  return { mon: w.mon, cap, cleaners: w.cleaners, byType }
}
export function avgM(ws: WeekM[]): WeekM {
  const n = ws.length || 1; const byType = {} as Record<SegKey, TypeM>
  for (const k of SEGS) byType[k] = { hh: ws.reduce((t, w) => t + w.byType[k].hh, 0) / n, rev: ws.reduce((t, w) => t + w.byType[k].rev, 0) / n, std: ws.reduce((t, w) => t + w.byType[k].std, 0) / n, n: ws.reduce((t, w) => t + w.byType[k].n, 0) / n }
  return { mon: 'avg', cap: ws.reduce((t, w) => t + w.cap, 0) / n, cleaners: ws.reduce((t, w) => t + w.cleaners, 0) / n, byType }
}
export interface Sel { hh: number; rev: number; std: number; n: number; cap: number; cleaners: number; R: number | null; c: number | null; p: number | null; r: number | null }
export function sel(w: WeekM, segs: SegKey[]): Sel {
  const hh = segs.reduce((t, k) => t + w.byType[k].hh, 0), rev = segs.reduce((t, k) => t + w.byType[k].rev, 0), std = segs.reduce((t, k) => t + w.byType[k].std, 0), n = segs.reduce((t, k) => t + w.byType[k].n, 0)
  return { hh, rev, std, n, cap: w.cap, cleaners: w.cleaners, R: w.cap > 0 ? rev / w.cap : null, c: w.cap > 0 ? hh / w.cap : null, p: std > 0 ? rev / std : null, r: std > 0 ? hh / std : null }
}
const Lm = (a: number, b: number) => a === b ? a : (b - a) / (Math.log(b) - Math.log(a)) // media logaritmica
export interface Effect { key: 'carga' | 'mezcla' | 'precio' | 'ritmo'; label: string; val: number }
export interface Decomp { Ra: number; Rb: number; dR: number; effects: Effect[]; check: number; ok: boolean; note?: string }

// Una sola unidad (STR, Relleno o Deep): 3 efectos (LMDI)
export function decompOne(a: Sel, b: Sel): Decomp | null {
  if (!a.R || !b.R || !a.c || !b.c || !a.p || !b.p || !a.r || !b.r) return null
  const dR = b.R - a.R, k = dR === 0 ? 0 : dR / Math.log(b.R / a.R)
  const ef = (key: Effect['key'], label: string, f: number): Effect => ({ key, label, val: dR === 0 ? 0 : k * Math.log(f) })
  const effects = [ef('carga', 'Carga', b.c / a.c), ef('precio', 'Precio por HH estándar', b.p / a.p), ef('ritmo', 'Ritmo', a.r / b.r)]
  const sum = effects.reduce((t, e) => t + e.val, 0)
  return { Ra: a.R, Rb: b.R, dR, effects, check: sum - dR, ok: Math.abs(sum - dR) < 1e-6 }
}
// Todos: 4 efectos (Carga, Mezcla, Precio, Ritmo) con LMDI por tipo. Precio y Ritmo se miden dentro de cada tipo.
export function decompAll(wa: WeekM, wb: WeekM): Decomp | null {
  const t = (w: WeekM, k: SegKey) => { const x = w.byType[k]; const L = w.cap > 0 ? x.hh / w.cap : 0; const R = w.cap > 0 ? x.rev / w.cap : 0; return { L, R, p: x.std > 0 ? x.rev / x.std : 0, r: x.std > 0 ? x.hh / x.std : 0 } }
  const A = SEGS.map(k => t(wa, k)), B = SEGS.map(k => t(wb, k))
  const Ra = A.reduce((s, x) => s + x.R, 0), Rb = B.reduce((s, x) => s + x.R, 0)
  const La = A.reduce((s, x) => s + x.L, 0), Lb = B.reduce((s, x) => s + x.L, 0)
  if (!(Ra > 0) || !(Rb > 0) || !(La > 0) || !(Lb > 0)) return null
  let carga = 0, mezcla = 0, precio = 0, ritmo = 0, special = 0
  SEGS.forEach((_, i) => {
    const a = A[i], b = B[i], dRi = b.R - a.R
    if (a.R > 0 && b.R > 0 && a.p > 0 && b.p > 0 && a.r > 0 && b.r > 0) {
      const w = Lm(a.R, b.R)
      carga += w * Math.log(Lb / La); mezcla += w * Math.log((b.L / Lb) / (a.L / La)); precio += w * Math.log(b.p / a.p); ritmo += w * Math.log(a.r / b.r)
    } else special += dRi // tipo que aparece o desaparece: todo su cambio va a Mezcla
  })
  mezcla += special
  const effects: Effect[] = [{ key: 'carga', label: 'Carga', val: carga }, { key: 'mezcla', label: 'Mezcla', val: mezcla }, { key: 'precio', label: 'Precio', val: precio }, { key: 'ritmo', label: 'Ritmo', val: ritmo }]
  const dR = Rb - Ra, sum = carga + mezcla + precio + ritmo
  return { Ra, Rb, dR, effects, check: sum - dR, ok: Math.abs(sum - dR) < 1e-6, note: special ? 'Hay un tipo que aparece/desaparece: su cambio completo va a Mezcla' : undefined }
}
export function decomp(wa: WeekM, wb: WeekM, segs: SegKey[]): Decomp | null {
  return segs.length === 3 ? decompAll(wa, wb) : decompOne(sel(wa, segs), sel(wb, segs))
}

// Curva acumulada de ingreso por dia (real + proyeccion de lo programado)
export function curve(w: WeekRaw, segs: SegKey[], todayIdx: number | null) {
  const real: number[] = [], proj: number[] = []; let acc = 0
  for (let d = 0; d < 7; d++) {
    const done = segs.reduce((t, k) => t + w.seg[k].ingDay[d], 0)
    const pend = segs.reduce((t, k) => t + w.seg[k].pend.day[d], 0)
    // dias pasados: solo lo hecho; hoy y futuro: hecho + por hacer
    const include = todayIdx === null || d < todayIdx ? done : done + pend
    acc += include; real.push(acc); proj.push(acc)
  }
  return { cum: real, closeAt: acc }
}
export const segLabel = (k: SegKey | 'Todos') => k === 'Relleno' ? 'Relleno' : k
