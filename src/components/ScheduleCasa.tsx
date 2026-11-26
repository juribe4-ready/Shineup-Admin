import { C, fmtDow } from './reports/shared'
import { ORIGIN, TYPE_STYLE, fmt12, toHM, type Origin } from './scheduleLib'
import type { Item } from './SchedulePage'

export interface Hist { name: string; total: number; n30: number; n90: number; last: string; daysSince: number; gap: number | null; first: string }
const norm = (s: string) => s.trim().toLowerCase()

export const aviso = (h: Hist | undefined): '' | 'Nueva' | 'Rara vez' => !h || h.total === 0 ? 'Nueva' : (h.gap === null && h.daysSince > 60) || (h.gap !== null && h.total < 3 && h.daysSince > 60) ? 'Rara vez' : ''
const pill = (t: string, bg: string, fg: string) => <span style={{ background: bg, color: fg, borderRadius: 999, padding: '1px 8px', fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap' }}>{t}</span>
const Badge = ({ o }: { o: Origin }) => <span style={{ width: 18, height: 18, borderRadius: 9, background: ORIGIN[o].color, color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{o}</span>

// Casas que suelen venir (>=3 limpiezas en el historial, cadencia conocida) y no estan esta semana
export function leToca(hist: Hist[], scheduled: Set<string>) {
  return hist.filter(h => !scheduled.has(norm(h.name)) && h.total >= 3 && h.gap !== null && h.daysSince >= h.gap).sort((a, b) => (b.daysSince - (b.gap || 0)) - (a.daysSince - (a.gap || 0)))
}

interface Props { items: Item[]; days: string[]; hist: Hist[]; mobile: boolean; groupBy: 'casa' | 'origen'; onOpen: (i: Item) => void; histErr: string; originOfHouse: (name: string) => Origin | null }
export default function ScheduleCasa({ items, days, hist, mobile, groupBy, onOpen, histErr, originOfHouse }: Props) {
  const H = new Map(hist.map(h => [norm(h.name), h]))
  const byHouse = new Map<string, Item[]>(); items.forEach(i => { const k = norm(i.property); byHouse.set(k, [...(byHouse.get(k) || []), i]) })
  const houses = [...byHouse.entries()].map(([k, list]) => ({ key: k, name: list[0].property, list, origin: list[0].origin })).sort((a, b) => a.name.localeCompare(b.name))
  const groups: { o: Origin | null; rows: typeof houses }[] = groupBy === 'origen'
    ? (['T', 'W', 'O'] as Origin[]).map(o => ({ o, rows: houses.filter(h => h.origin === o) })).filter(g => g.rows.length)
    : [{ o: null, rows: houses }]
  const sched = new Set(houses.map(h => h.key))
  const falta = leToca(hist, sched)
  const chip = (i: Item) => { const s = TYPE_STYLE[i.seg]; return <div key={i.key} onClick={() => onOpen(i)} style={{ cursor: 'pointer', background: s.bg, border: `1.5px ${i.st === 'launched' ? 'solid' : 'dashed'} ${s.bd}`, borderRadius: 8, padding: '3px 6px', fontSize: 11.5, fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>{fmt12(toHM(i.time)) || '·'}</div> }
  const stat = (h?: Hist) => ({ n30: h?.n30 ?? 0, n90: h?.n90 ?? 0, last: h && h.total ? `${h.daysSince} d` : '—', gap: h?.gap ? `${Math.round(h.gap)} d` : '—' })
  const av = (h?: Hist) => { const a = aviso(h); return a === 'Nueva' ? pill('Nueva', '#E0F2FE', '#0369A1') : a === 'Rara vez' ? pill('Rara vez', '#F1F5F9', '#475569') : null }
  const th: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: C.muted, textAlign: 'center', padding: '6px 4px' }
  const grid = `minmax(120px,1.4fr) repeat(7, minmax(62px,1fr)) 44px 44px 64px 64px 72px`

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    {histErr && <div style={{ background: C.amberBg, color: C.amber, borderRadius: 10, padding: 9, fontSize: 12 }}>No pude leer el historial ({histErr}). Se muestra solo lo programado.</div>}
    {groups.map((g, gi) => <div key={gi} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 10, overflowX: mobile ? 'visible' : 'auto' }}>
      {g.o && <div style={{ background: C.bg, borderRadius: 10, padding: '7px 10px', display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}><Badge o={g.o} />{ORIGIN[g.o].label} · {g.rows.length} casas · {g.rows.reduce((t, h) => t + h.list.length, 0)} limpiezas</div>}
      {!mobile && <div style={{ minWidth: 900 }}>
        <div style={{ display: 'grid', gridTemplateColumns: grid, borderBottom: `1px solid ${C.border}` }}><span />{days.map(d => <span key={d} style={th}>{fmtDow(d)}</span>)}<span style={th}>30 d</span><span style={th}>90 d</span><span style={th}>Última</span><span style={th}>Cada ~</span><span style={th}>Aviso</span></div>
        {g.rows.map(h => { const s = stat(H.get(h.key)); return <div key={h.key} style={{ display: 'grid', gridTemplateColumns: grid, alignItems: 'center', borderBottom: '1px solid #F1F5F9', padding: '3px 0' }}>
          <b style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>{groupBy === 'casa' && <Badge o={h.origin} />}{h.name}</b>
          {days.map(d => { const l = h.list.filter(i => i.date === d); return <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 3px' }}>{l.length ? l.map(chip) : <span style={{ textAlign: 'center', color: '#CBD5E1' }}>·</span>}</div> })}
          <b style={{ textAlign: 'center' }}>{s.n30}</b><span style={{ textAlign: 'center', color: C.slate }}>{s.n90}</span><span style={{ textAlign: 'center', color: C.slate, fontSize: 12.5 }}>{s.last}</span><span style={{ textAlign: 'center', color: C.slate, fontSize: 12.5 }}>{s.gap}</span><span style={{ textAlign: 'center' }}>{av(H.get(h.key))}</span>
        </div> })}
      </div>}
      {mobile && g.rows.map(h => { const s = stat(H.get(h.key)); return <div key={h.key} style={{ borderBottom: '1px solid #F1F5F9', padding: '8px 2px' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{groupBy === 'casa' && <Badge o={h.origin} />}<b style={{ fontSize: 14, flex: 1 }}>{h.name}</b>{av(H.get(h.key))}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>{h.list.map(i => <div key={i.key} style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ fontSize: 11, color: C.slate }}>{fmtDow(i.date)}</span>{chip(i)}</div>)}</div>
        <div style={{ fontSize: 11.5, color: C.slate }}>30 d: <b>{s.n30}</b> · 90 d: <b>{s.n90}</b> · última: <b>{s.last}</b> · cada ~<b>{s.gap}</b></div>
      </div> })}
    </div>)}
    {falta.length > 0 && <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 10 }}>
      <div style={{ background: C.redBg, color: C.red, borderRadius: 10, padding: '7px 10px', fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>Suelen venir y no están esta semana · {falta.length} casas</div>
      {falta.map(h => <div key={h.name} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #F1F5F9', padding: '6px 2px', fontSize: 13, flexWrap: 'wrap' }}>
        {originOfHouse(h.name) && <Badge o={originOfHouse(h.name)!} />}<b style={{ flex: 1, minWidth: 110 }}>{h.name}</b>
        <span style={{ color: C.slate, fontSize: 12 }}>30 d: <b>{h.n30}</b> · 90 d: <b>{h.n90}</b> · última hace <b>{h.daysSince} d</b> · cada ~<b>{Math.round(h.gap || 0)} d</b></span>{pill('Le toca', C.redBg, C.red)}</div>)}
    </div>}
    <div style={{ fontSize: 11.5, color: C.slate, background: C.primaryLight, borderRadius: 10, padding: 10 }}>Historial desde las limpiezas de Airtable por nombre de casa (sin canceladas): 30 d / 90 d = cuántas veces, <b>Última</b> = hace cuántos días, <b>Cada ~</b> = mediana de días entre visitas. <b>Le toca</b> = casa con ≥3 visitas cuyo último servicio ya pasó su cadencia normal y no está esta semana. <b>Nueva</b> = sin historial · <b>Rara vez</b> = casi no aparece.</div>
  </div>
}
