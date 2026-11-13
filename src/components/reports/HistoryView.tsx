import { useMemo, useState } from 'react'
import { C, Card, Delta, Err, Loading, btn, selStyle, money, money1, pctS, hm, todayET, addDays, mondayOf, monthStart, monthEnd, addMonths, fmtShort, useApi, useIsMobile, useNames } from './shared'

export type Nav = { from: string; to: string; property?: string; client?: string }
const PRESETS: [string, string][] = [['today', 'Hoy'], ['yest', 'Ayer'], ['week', 'Esta semana'], ['lweek', 'Semana pasada'], ['month', 'Este mes'], ['lmonth', 'Mes pasado'], ['90', '90 días'], ['year', 'Este año'], ['all', 'Todo']]
export function presetRange(k: string): { from: string; to: string } {
  const t = todayET()
  switch (k) {
    case 'today': return { from: t, to: t }
    case 'yest': return { from: addDays(t, -1), to: addDays(t, -1) }
    case 'week': return { from: mondayOf(t), to: addDays(mondayOf(t), 6) }
    case 'lweek': return { from: addDays(mondayOf(t), -7), to: addDays(mondayOf(t), -1) }
    case 'month': return { from: monthStart(t), to: monthEnd(t) }
    case 'lmonth': return { from: addMonths(t, -1), to: monthEnd(addMonths(t, -1)) }
    case '90': return { from: addDays(t, -89), to: addDays(t, 30) }
    case 'year': return { from: t.slice(0, 4) + '-01-01', to: t.slice(0, 4) + '-12-31' }
    default: return { from: '2024-01-01', to: addDays(t, 60) }
  }
}
const tm = (t: string | null) => t ? new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).replace(' ', '').toLowerCase() : ''
const dow = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')
const isVideo = (u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u)

function Photo({ u, i }: { u: string; i: number }) {
  const [bad, setBad] = useState(false)
  const tile: React.CSSProperties = { height: 84, borderRadius: 9, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#475569', textDecoration: 'none', overflow: 'hidden' }
  if (isVideo(u) || bad) return <a href={u} target="_blank" rel="noreferrer" style={tile}>{isVideo(u) ? 'Video' : 'Foto'} {i + 1}</a>
  return <a href={u} target="_blank" rel="noreferrer" style={tile}><img src={u} alt={`foto ${i + 1}`} loading="lazy" onError={() => setBad(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></a>
}

function totals(vs: any[]) {
  const done = vs.filter(v => v.status === 'Done')
  const w = done.filter(v => v.margen !== null)
  const ing = done.reduce((t, v) => t + v.price, 0), lab = w.reduce((t, v) => t + v.cost, 0)
  const hh = w.reduce((t, v) => t + (v.dur || 0) * (v.n || 1), 0)
  const mg = ing - lab
  return { n: done.length, ing, lab, mg, pct: ing > 0 ? mg / ing * 100 : null, hh, mgHH: hh > 0 ? mg / hh : null, dur: w.length ? w.reduce((t, v) => t + v.dur, 0) / w.length : null, photos: vs.filter(v => v.photos.length).length }
}

export default function HistoryView({ init, onBack, onDebug, backLabel }: { init: Nav; onBack: () => void; onDebug: (d: any) => void; backLabel: string }) {
  const mobile = useIsMobile()
  const [from, setFrom] = useState(init.from), [to, setTo] = useState(init.to)
  const [preset, setPreset] = useState(() => PRESETS.find(([k]) => { const r = presetRange(k); return r.from === init.from && r.to === init.to })?.[0] || 'custom')
  const [property, setProperty] = useState(init.property || '')
  const [client, setClient] = useState(init.client || '')
  const [status, setStatus] = useState<'all' | 'done' | 'sched' | 'photos'>('all')
  const [selId, setSelId] = useState<string | null>(null)
  const [pg, setPg] = useState(1)
  const per = 25
  const span = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
  const hn = useNames('property')
  const cur = useApi('visits', { from, to, property, client }, [from, to, property, client], onDebug)
  const showPrev = span <= 120 && preset !== 'all'
  const prev = useApi(showPrev ? 'visits' : null, { from: addDays(from, -span), to: addDays(from, -1), property, client }, [from, to, property, client, showPrev])
  const houses: { name: string; client: string }[] = hn.names
  const clients = useMemo(() => [...new Set(houses.map(h => h.client).filter(Boolean))].sort(), [houses])
  const propOpts = useMemo(() => houses.filter(h => !client || h.client === client).map(h => h.name), [houses, client])
  const all: any[] = cur.data?.visits || []
  const rows = all.filter(v => status === 'all' || (status === 'done' && v.status === 'Done') || (status === 'sched' && v.status !== 'Done') || (status === 'photos' && v.photos.length))
  const T = totals(rows), P = prev.data ? totals(prev.data.visits) : null
  const pages = Math.max(1, Math.ceil(rows.length / per)); const page = Math.min(pg, pages)
  const shown = rows.slice((page - 1) * per, page * per)
  const sel = rows.find(v => v.id === selId) || null
  const byHouse = useMemo(() => { const m: Record<string, any[]> = {}; rows.forEach(v => { if (v.property) (m[v.property] ||= []).push(v) }); return Object.entries(m).map(([name, vs]) => ({ name, t: totals(vs), last: vs.filter(v => v.status === 'Done').map(v => v.date).sort().pop() || null })).sort((a, b) => b.t.mg - a.t.mg) }, [rows])
  const pick = (k: string) => { setPreset(k); if (k !== 'custom') { const r = presetRange(k); setFrom(r.from); setTo(r.to); setPg(1) } }
  const title = property || client || 'Todas las casas'
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 10, color: C.muted, padding: '7px 8px', background: C.bg, textTransform: 'uppercase', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '7px 8px', whiteSpace: 'nowrap' }
  const mgc = (n: number | null) => n === null ? C.muted : n < 0 ? C.red : C.green

  return <div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
      <button onClick={onBack} style={{ ...btn(), color: C.primaryDark, fontWeight: 700 }}>‹ {backLabel}</button>
      <div style={{ fontSize: 19, fontWeight: 800 }}>{title}</div>
      <span style={{ color: C.muted, fontSize: 12 }}>{from === to ? fmtShort(from) : `${fmtShort(from)} – ${fmtShort(to)}`}</span>
    </div>
    <Card style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map(([k, t]) => <button key={k} style={{ ...btn(preset === k), height: 32, fontSize: 12 }} onClick={() => pick(k)}>{t}</button>)}
        <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreset('custom'); setPg(1) }} style={{ ...selStyle, height: 32 }} />
        <span style={{ color: C.muted }}>→</span>
        <input type="date" value={to} onChange={e => { setTo(e.target.value); setPreset('custom'); setPg(1) }} style={{ ...selStyle, height: 32 }} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <select value={client} onChange={e => { setClient(e.target.value); setProperty(''); setPg(1) }} style={selStyle}><option value="">Cliente: todos</option>{clients.map(c => <option key={c}>{c}</option>)}</select>
        <select value={property} onChange={e => { setProperty(e.target.value); setPg(1) }} style={selStyle}><option value="">Casa: todas</option>{propOpts.map(c => <option key={c}>{c}</option>)}</select>
        <select value={status} onChange={e => { setStatus(e.target.value as any); setPg(1) }} style={selStyle}><option value="all">Todas</option><option value="done">Terminadas</option><option value="sched">Programadas</option><option value="photos">Con fotos</option></select>
      </div>
    </Card>
    <Err msg={cur.err} /><Loading on={cur.loading} />
    {cur.data && <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        {[
          { l: 'Limpiezas', v: String(T.n), d: P ? <Delta cur={T.n} prev={P.n} kind="num" /> : null },
          { l: 'Ingresos', v: money(T.ing), d: P ? <Delta cur={T.ing} prev={P.ing} /> : null },
          { l: 'Labor', v: money(T.lab), d: P ? <Delta cur={T.lab} prev={P.lab} good="down" /> : null, s: 'estimado por horas' },
          { l: 'Margen', v: money(T.mg), c: mgc(T.mg), d: P ? <Delta cur={T.mg} prev={P.mg} /> : null },
          { l: 'Margen %', v: pctS(T.pct), d: P && P.pct !== null && T.pct !== null ? <Delta cur={T.pct} prev={P.pct} kind="pct" /> : null },
          { l: 'Mg / HH', v: money1(T.mgHH) }, { l: 'Duración prom.', v: hm(T.dur), d: P ? <Delta cur={T.dur} prev={P.dur} kind="h" good="down" /> : null },
        ].map(x => <div key={x.l} style={{ flex: '1 1 120px', minWidth: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '10px 12px' }}>
          <div style={{ fontSize: 12, color: '#64748B' }}>{x.l}</div><div style={{ fontSize: 21, fontWeight: 700, color: (x as any).c || C.ink, letterSpacing: '-.02em' }}>{x.v}</div>{(x as any).s && <div style={{ fontSize: 10, color: C.muted }}>{(x as any).s}</div>}{x.d}</div>)}
      </div>
      {showPrev && <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Comparado con el periodo anterior de la misma duración ({span === 1 ? fmtShort(addDays(from, -1)) : `${fmtShort(addDays(from, -span))} – ${fmtShort(addDays(from, -1))}`}).</div>}

      {!property && byHouse.length > 1 && <Card style={{ marginBottom: 10 }}>
        <b style={{ fontSize: 14 }}>Por casa</b> <span style={{ fontSize: 12, color: C.muted }}>· toca una casa para ver solo sus limpiezas</span>
        <div style={{ overflowX: 'auto', marginTop: 6 }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr>{['Casa', 'Limp.', 'Ingresos', 'Labor', 'Margen', 'Mg %', 'Mg/HH', 'Última'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{byHouse.slice(0, 15).map(h => <tr key={h.name} onClick={() => { setProperty(h.name); setPg(1) }} style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer' }}>
            <td style={{ ...td, fontWeight: 700, color: C.primaryDark }}>{h.name}</td><td style={td}>{h.t.n}</td><td style={td}>{money(h.t.ing)}</td><td style={td}>{money(h.t.lab)}</td><td style={{ ...td, fontWeight: 700, color: mgc(h.t.mg) }}>{money(h.t.mg)}</td><td style={td}>{pctS(h.t.pct)}</td><td style={td}>{money1(h.t.mgHH)}</td><td style={td}>{h.last ? fmtShort(h.last) : '—'}</td></tr>)}</tbody></table></div>
        {byHouse.length > 15 && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Mostrando las 15 con más margen de {byHouse.length}.</div>}
      </Card>}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px 4px' }}><b style={{ fontSize: 14 }}>Limpiezas</b> <span style={{ fontSize: 12, color: C.muted }}>· {rows.length} en total{cur.data.total > all.length ? ` (se muestran las ${all.length} más recientes)` : ''}. Toca una fila para ver fotos.</span></div>
        {rows.length === 0 && <div style={{ padding: 16, fontSize: 13, color: C.muted }}>No hay limpiezas con este filtro. Cambia el periodo (arriba) o quita filtros.</div>}
        {mobile ? <div>{shown.map(v => <div key={v.id} onClick={() => setSelId(v.id === selId ? null : v.id)} style={{ padding: '10px 14px', borderTop: '1px solid #F1F5F9', background: v.id === selId ? C.primaryLight : 'transparent' }}>
          <div style={{ display: 'flex', gap: 8 }}><b style={{ textTransform: 'capitalize' }}>{dow(v.date)} {fmtShort(v.date)}</b><span style={{ flex: 1, color: C.primaryDark, fontWeight: 700 }}>{v.property}</span><b style={{ color: mgc(v.margen) }}>{v.margen === null ? '—' : money(v.margen)}</b></div>
          <div style={{ fontSize: 11.5, color: C.muted }}>{[v.squad, v.dur ? hm(v.dur) : '', `Ing ${money(v.price)}`, v.margen !== null ? `Labor ${money(v.cost)}` : '', v.photos.length ? `${v.photos.length}` : ''].filter(Boolean).join(' · ')}</div></div>)}</div>
          : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr>{['Fecha', 'Casa', 'Cliente', 'Cleaners', '#', 'Horario', 'Duración', 'Ingresos', 'Labor', 'Margen', 'Mg %', 'Mg/HH', 'Fotos', 'Estado'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{shown.map(v => { const on = v.id === selId; const hh = v.margen !== null && v.dur ? v.dur * (v.n || 1) : 0
              return <tr key={v.id} onClick={() => setSelId(on ? null : v.id)} style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer', background: on ? C.primaryLight : v.margen !== null && v.margen < 0 ? '#FEF2F2' : 'transparent' }}>
                <td style={{ ...td, fontWeight: 700 }}><span style={{ textTransform: 'capitalize' }}>{dow(v.date)}</span> {fmtShort(v.date)}</td><td style={{ ...td, fontWeight: 700, color: C.primaryDark }}>{v.property}</td><td style={{ ...td, color: C.slate }}>{v.client || '—'}</td>
                <td style={td}>{v.squad || '—'}</td><td style={td}>{v.n}</td><td style={td}>{v.start ? `${tm(v.start)}–${tm(v.end)}` : tm(v.sched) || '—'}</td><td style={td}>{v.dur ? hm(v.dur) : '—'}</td>
                <td style={td}>{money(v.price)}</td><td style={td}>{v.margen === null ? '—' : money(v.cost)}</td><td style={{ ...td, fontWeight: 700, color: mgc(v.margen) }}>{v.margen === null ? '—' : money(v.margen)}</td>
                <td style={td}>{v.margen === null || !v.price ? '—' : pctS(v.margen / v.price * 100)}</td><td style={td}>{hh ? money1(v.margen / hh) : '—'}</td><td style={td}>{v.photos.length ? `${v.photos.length}` : '—'}</td>
                <td style={td}><span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: v.status === 'Done' ? C.greenBg : C.amberBg, color: v.status === 'Done' ? C.green : C.amber }}>{v.status === 'Done' ? 'Terminada' : v.status}</span></td></tr> })}
              {rows.length > 0 && <tr style={{ background: C.bg, fontWeight: 700 }}><td style={td} colSpan={7}>Total ({T.n} terminadas)</td><td style={td}>{money(T.ing)}</td><td style={td}>{money(T.lab)}</td><td style={{ ...td, color: mgc(T.mg) }}>{money(T.mg)}</td><td style={td}>{pctS(T.pct)}</td><td style={td}>{money1(T.mgHH)}</td><td colSpan={2} /></tr>}</tbody></table></div>}
        {pages > 1 && <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: 10, flexWrap: 'wrap' }}>{Array.from({ length: Math.min(pages, 12) }, (_, i) => i + 1).map(n => <button key={n} onClick={() => setPg(n)} style={{ ...btn(page === n), height: 28, padding: '0 10px' }}>{n}</button>)}{pages > 12 && <span style={{ fontSize: 12, color: C.muted, alignSelf: 'center' }}>… {pages}</span>}</div>}
      </Card>
      {sel && <Card style={{ marginTop: 10, borderColor: '#C7D2FE' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ fontSize: 14 }}>{sel.property} · {fmtShort(sel.date)}</b><span style={{ fontSize: 12, color: C.muted }}>{[sel.squad, sel.type, sel.dur ? hm(sel.dur) : ''].filter(Boolean).join(' · ')}</span><button onClick={() => setSelId(null)} style={{ ...btn(), marginLeft: 'auto', height: 30 }}>Cerrar ✕</button></div>
        {sel.photos.length > 0 ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 6, marginTop: 8 }}>{sel.photos.map((u: string, i: number) => <Photo key={u + i} u={u} i={i} />)}</div> : <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>Esta limpieza no tiene fotos guardadas.</div>}
      </Card>}
      <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Labor = horas limpiando × costo/hora de los cleaners asignados (estimado por limpieza). Fila roja = labor mayor que el ingreso.</div>
    </>}
  </div>
}
