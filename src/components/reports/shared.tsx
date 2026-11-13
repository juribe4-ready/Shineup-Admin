import { useEffect, useState } from 'react'

export const C = { ink: '#0F172A', slate: '#475569', muted: '#94A3B8', border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF', primary: '#6366F1', primaryDark: '#4F46E5', primaryLight: '#EEF2FF', green: '#047857', greenBg: '#ECFDF5', red: '#B91C1C', redBg: '#FEE2E2', amber: '#B45309', amberBg: '#FEF3C7', bar: '#10B981' }

export const money = (n: number | null | undefined) => n === null || n === undefined ? '—' : (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US')
export const money1 = (n: number | null | undefined) => n === null || n === undefined ? '—' : '$' + n.toFixed(1)
export const pctS = (n: number | null | undefined) => n === null || n === undefined ? '—' : Math.round(n) + '%'
export const hm = (h: number | null | undefined) => { if (h === null || h === undefined) return '—'; const m = Math.round(h * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` }
export const iso = (d: Date) => d.toLocaleDateString('en-CA')
export const todayET = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
export const addDays = (d: string, n: number) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
export const mondayOf = (d: string) => { const x = new Date(d + 'T12:00:00Z'); return addDays(d, -((x.getUTCDay() + 6) % 7)) }
export const monthStart = (d: string) => d.slice(0, 7) + '-01'
export const monthEnd = (d: string) => { const x = new Date(monthStart(d) + 'T12:00:00Z'); x.setUTCMonth(x.getUTCMonth() + 1); x.setUTCDate(0); return x.toISOString().slice(0, 10) }
export const addMonths = (d: string, n: number) => { const x = new Date(monthStart(d) + 'T12:00:00Z'); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10) }
export const isoWeek = (d: string) => { const x = new Date(d + 'T12:00:00Z'); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day + 3); const j = new Date(Date.UTC(x.getUTCFullYear(), 0, 4)); return 1 + Math.round(((x.getTime() - j.getTime()) / 86400000 - 3 + ((j.getUTCDay() + 6) % 7)) / 7) }
export const fmtShort = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
export const fmtDow = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
export const rangeLabel = (a: string, b: string) => `${fmtShort(a)} – ${fmtShort(b)}`
export const weekLabel = (mon: string) => `W${isoWeek(mon)} · ${rangeLabel(mon, addDays(mon, 6))}`

export function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  return m
}

export async function api(kind: string, params: Record<string, string | number | undefined>, extra?: { action?: string }) {
  const q = new URLSearchParams({ action: extra?.action || 'reports', kind })
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)) })
  const r = await fetch('/api/getDashboard?' + q.toString())
  const text = await r.text()
  let j: any = null
  try { j = JSON.parse(text) } catch { /* ignore */ }
  if (!r.ok) throw new Error((j && j.error) || `Error ${r.status}: ${text.slice(0, 120)}`)
  return j
}

export function useApi<T = any>(kind: string | null, params: Record<string, string | number | undefined>, deps: any[], onDebug?: (d: any) => void) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!kind) return
    let live = true
    setLoading(true); setErr('')
    api(kind, params).then(j => { if (live) { setData(j); onDebug?.({ kind, params, ...(j.debug || {}) }) } }).catch(e => { if (live) { setErr(e.message); onDebug?.({ kind, params, error: e.message }) } }).finally(() => live && setLoading(false))
    return () => { live = false }
    // eslint-disable-next-line
  }, deps)
  return { data, loading, err, setData }
}

export function Delta({ cur, prev, kind = 'money', good = 'up', suffix }: { cur: number | null | undefined; prev: number | null | undefined; kind?: 'money' | 'pct' | 'num' | 'h'; good?: 'up' | 'down'; suffix?: string }) {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 3 }}>sin periodo anterior</div>
  const d = cur - prev
  if (Math.abs(d) < 0.005) return <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginTop: 3 }}>= igual</div>
  const up = d > 0, ok = good === 'up' ? up : !up
  const fmt = kind === 'money' ? money(Math.abs(d)) : kind === 'pct' ? Math.abs(Math.round(d * 10) / 10) + ' pts' : kind === 'h' ? Math.abs(Math.round(d * 10) / 10) + ' h' : String(Math.abs(Math.round(d * 10) / 10))
  return <div style={{ fontSize: 11, color: ok ? C.green : C.red, fontWeight: 700, marginTop: 3 }}>{up ? '▲ +' : '▼ −'}{fmt}{suffix ? ' ' + suffix : ''}</div>
}

export const Card = ({ children, style }: { children: any; style?: React.CSSProperties }) => <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px', ...style }}>{children}</div>

export function Tile({ label, value, sub, color, children, w }: { label: string; value: string; sub?: string; color?: string; children?: any; w?: number }) {
  return <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px', flex: `1 1 ${w || 150}px`, minWidth: 0 }}>
    <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', color: color || C.ink, lineHeight: 1.25 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>}
    {children}
  </div>
}

export function Seg({ items, value, onChange }: { items: [string, string][]; value: string; onChange: (v: string) => void }) {
  return <div style={{ display: 'inline-flex', border: `1.5px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: C.white }}>
    {items.map(([k, t]) => <button key={k} onClick={() => onChange(k)} style={{ padding: '0 14px', height: 35, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: value === k ? C.primary : C.white, color: value === k ? 'white' : C.slate }}>{t}</button>)}
  </div>
}

export const btn = (on = false): React.CSSProperties => ({ height: 38, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${on ? C.primary : C.border}`, background: on ? C.primaryLight : C.white, color: on ? C.primaryDark : C.ink, fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap' })
export const selStyle: React.CSSProperties = { height: 38, padding: '0 10px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.white, fontSize: 13, color: C.ink, maxWidth: 200 }
export const Err = ({ msg }: { msg: string }) => msg ? <div style={{ background: C.redBg, color: C.red, borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 10 }}>Error: {msg}</div> : null
export const Loading = ({ on }: { on: boolean }) => on ? <div style={{ fontSize: 12, color: C.muted, margin: '6px 0' }}>Cargando…</div> : null
