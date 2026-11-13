import { useEffect, useMemo, useState } from 'react'
import { C, Card, Seg, Err, Loading, money, money1, pctS, hm, todayET, mondayOf, addDays, addMonths, monthStart, monthEnd, rangeLabel, fmtShort, api, useApi } from './shared'

type Mode = 'periodos' | 'property' | 'client'

function Periodos({ onDebug }: { onDebug: (d: any) => void }) {
  const [span, setSpan] = useState<'week' | 'month'>('week')
  const t = todayET()
  const from = span === 'week' ? mondayOf(t) : monthStart(t)
  const to = span === 'week' ? addDays(from, 6) : monthEnd(t)
  const pFrom = span === 'week' ? addDays(from, -7) : addMonths(from, -1)
  const pTo = span === 'week' ? addDays(from, -1) : monthEnd(pFrom)
  const cur = useApi('margin', { from, to }, [from, to], onDebug)
  const prv = useApi('margin', { from: pFrom, to: pTo }, [pFrom, pTo])
  const [sc, setSc] = useState<{ cur: any; prev: any } | null>(null)
  const [scErr, setScErr] = useState('')
  useEffect(() => {
    let live = true; setSc(null); setScErr('')
    const g = (a: string, b: string) => api('scorecard', { from: a, to: b, gran: 'month' }, { action: 'scorecard' })
    Promise.all([g(from, to), g(pFrom, pTo)]).then(([a, b]) => live && setSc({ cur: a.total, prev: b.total })).catch(e => live && setScErr(e.message))
    return () => { live = false }
  }, [from, to, pFrom, pTo])
  const a = cur.data?.total, b = prv.data?.total
  const ratio = (x: any, y: any) => (x === null || x === undefined || y === null || y === undefined) ? null : x - y
  const rows: { l: string; a: any; b: any; f: (n: any) => string; good: 'up' | 'down'; pts?: boolean }[] = [
    { l: 'Limpiezas', a: a?.limpiezas, b: b?.limpiezas, f: n => String(n ?? '—'), good: 'up' },
    { l: 'Cobrado', a: a?.cobrado, b: b?.cobrado, f: money, good: 'up' },
    { l: 'Pagado a cleaners', a: a?.costo, b: b?.costo, f: money, good: 'down' },
    { l: 'Margen', a: a?.margen, b: b?.margen, f: money, good: 'up' },
    { l: 'Margen %', a: a?.mgPct, b: b?.mgPct, f: pctS, good: 'up', pts: true },
    { l: 'Margen / HH', a: a?.mgHH, b: b?.mgHH, f: money1, good: 'up' },
    { l: 'Horas de trabajo', a: a?.horas, b: b?.horas, f: hm, good: 'up' },
    { l: 'Traslado prom. (min)', a: sc?.cur?.traslado, b: sc?.prev?.traslado, f: n => n === null || n === undefined ? '—' : n + ' min', good: 'down' },
    { l: 'A tiempo', a: sc?.cur?.onTime, b: sc?.prev?.onTime, f: n => n === null || n === undefined ? '—' : Math.round(n) + '%', good: 'up', pts: true },
    { l: 'Incidentes', a: sc?.cur?.nIncidentes, b: sc?.prev?.nIncidentes, f: n => String(n ?? '—'), good: 'down' },
  ]
  const bars = (cur.data?.days || []) as any[], pb = (prv.data?.days || []) as any[]
  const mx = Math.max(1, ...bars.map(d => d.margen), ...pb.map(d => d.margen))
  const n = Math.max(bars.length, pb.length)
  return <div>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
      <Seg items={[['week', 'Esta semana vs la pasada'], ['month', 'Este mes vs el pasado']]} value={span} onChange={v => setSpan(v as any)} />
      <span style={{ fontSize: 12, color: C.muted }}>{rangeLabel(from, to)} vs {rangeLabel(pFrom, pTo)}</span>
    </div>
    <Err msg={cur.err || prv.err} /><Loading on={cur.loading || prv.loading} />
    {scErr && <div style={{ fontSize: 12, color: C.amber, marginBottom: 8 }}>Traslado / a tiempo / incidentes no cargaron: {scErr}</div>}
    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead><tr>{['', 'Este periodo', 'Anterior', 'Cambio'].map(h => <th key={h} style={{ textAlign: h ? 'right' : 'left', padding: '9px 12px', fontSize: 10, color: C.muted, background: C.bg, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(r => { const d = ratio(r.a, r.b); const ok = d === null || Math.abs(d) < 0.005 ? null : (r.good === 'up' ? d > 0 : d < 0)
          const ds = d === null ? '—' : Math.abs(d) < 0.005 ? '=' : (d > 0 ? '▲ +' : '▼ −') + (r.pts ? Math.abs(Math.round(d)) + ' pts' : r.l.includes('Horas') ? Math.abs(Math.round(d * 10) / 10) + ' h' : r.f(Math.abs(d)))
          return <tr key={r.l} style={{ borderTop: '1px solid #F1F5F9' }}><td style={{ padding: '9px 12px', fontWeight: 600 }}>{r.l}</td><td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700 }}>{r.f(r.a)}</td><td style={{ padding: '9px 12px', textAlign: 'right', color: C.slate }}>{r.f(r.b)}</td>
            <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: ok === null ? C.muted : ok ? C.green : C.red }}>{ds}</td></tr> })}</tbody></table>
    </Card>
    <Card>
      <b style={{ fontSize: 14 }}>Margen por día · {span === 'week' ? 'esta semana vs la pasada' : 'este mes vs el pasado'}</b>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: n > 14 ? 2 : 10, height: 150, marginTop: 10, overflowX: 'auto' }}>
        {Array.from({ length: n }, (_, i) => <div key={i} style={{ flex: 1, minWidth: 8, display: 'flex', alignItems: 'flex-end', gap: 2, height: '100%' }}>
          <div title={pb[i] ? `${pb[i].date}: ${money(pb[i].margen)}` : ''} style={{ flex: 1, height: `${Math.max(1, (pb[i]?.margen || 0) / mx * 100)}%`, background: '#CBD5E1', borderRadius: 3 }} />
          <div title={bars[i] ? `${bars[i].date}: ${money(bars[i].margen)}` : ''} style={{ flex: 1, height: `${Math.max(1, (bars[i]?.margen || 0) / mx * 100)}%`, background: C.bar, borderRadius: 3 }} /></div>)}
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: C.slate, marginTop: 8 }}><span><i style={{ display: 'inline-block', width: 10, height: 10, background: C.bar, borderRadius: 2, marginRight: 4 }} />Este periodo</span><span><i style={{ display: 'inline-block', width: 10, height: 10, background: '#CBD5E1', borderRadius: 2, marginRight: 4 }} />Anterior</span></div>
    </Card>
  </div>
}

function Entidades({ entity, onDebug }: { entity: 'property' | 'client'; onDebug: (d: any) => void }) {
  const [picked, setPicked] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [days, setDays] = useState('30')
  const to = addDays(todayET(), -1), from = addDays(to, -(Number(days) - 1))
  const list = useApi(entity === 'property' ? 'houses' : 'rank', entity === 'property' ? {} : { entity: 'client', from, to }, [entity], onDebug)
  const opts: string[] = useMemo(() => entity === 'property' ? (list.data?.houses || []).map((h: any) => h.name) : (list.data?.rows || []).map((r: any) => r.name), [list.data, entity])
  const hits = q.trim() ? opts.filter(o => o.toLowerCase().includes(q.trim().toLowerCase()) && !picked.includes(o)).slice(0, 6) : []
  const cmp = useApi(picked.length ? 'compare' : null, { entity, names: picked.join('|'), from, to }, [entity, picked.join('|'), from, to], onDebug)
  useEffect(() => { setPicked([]); setQ('') }, [entity])
  const items = (picked.length ? cmp.data?.items : null) as any[] | null
  const metrics: { l: string; k: string; f: (n: any) => string; good: 'max' | 'min' }[] = [
    { l: 'Limpiezas', k: 'limpiezas', f: n => String(n), good: 'max' }, { l: 'Cobrado', k: 'ingreso', f: money, good: 'max' }, { l: 'Costo (est.)', k: 'costo', f: money, good: 'min' },
    { l: 'Margen', k: 'margen', f: money, good: 'max' }, { l: 'Margen %', k: 'mgPct', f: pctS, good: 'max' }, { l: 'Margen / HH', k: 'mgHH', f: money1, good: 'max' },
    { l: 'Duración prom.', k: 'durProm', f: hm, good: 'min' }, { l: 'A tiempo', k: 'onTime', f: n => n === null || n === undefined ? '—' : Math.round(n) + '%', good: 'max' },
  ]
  return <div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
      <Seg items={[['30', '30 días'], ['90', '90 días']]} value={days} onChange={setDays} />
      <span style={{ fontSize: 12, color: C.muted }}>Elige hasta 6 {entity === 'property' ? 'casas' : 'clientes'}</span>
    </div>
    <div style={{ position: 'relative', marginBottom: 10 }}>
      <input value={q} onChange={e => setQ(e.target.value)} disabled={picked.length >= 6} placeholder={`🔍 Agregar ${entity === 'property' ? 'casa' : 'cliente'}…`} style={{ width: '100%', height: 44, borderRadius: 12, border: `1.5px solid ${C.border}`, padding: '0 14px', fontSize: 14, boxSizing: 'border-box' }} />
      {hits.length > 0 && <Card style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: 48, padding: 4 }}>{hits.map(h => <div key={h} onClick={() => { setPicked(p => [...p, h]); setQ('') }} style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 14 }}>{h}</div>)}</Card>}
    </div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>{picked.map(p => <span key={p} style={{ background: C.primaryLight, color: C.primaryDark, borderRadius: 999, padding: '5px 6px 5px 12px', fontSize: 13, fontWeight: 600 }}>{p} <button onClick={() => setPicked(x => x.filter(y => y !== p))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.primaryDark, fontSize: 14 }}>✕</button></span>)}</div>
    <Err msg={cmp.err} /><Loading on={cmp.loading} />
    {!picked.length && <Card><div style={{ fontSize: 13, color: C.muted }}>Busca y agrega {entity === 'property' ? 'casas' : 'clientes'} para verlos lado a lado. Lo mejor de cada fila sale en verde.</div></Card>}
    {items && <Card style={{ padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 120 + items.length * 120 }}>
        <thead><tr><th style={{ background: C.bg, padding: 10 }} />{items.map(i => <th key={i.name} style={{ textAlign: 'right', padding: 10, background: C.bg, fontSize: 13 }}>{i.name}<div style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>{i.last ? 'última ' + fmtShort(i.last) : ''}</div></th>)}</tr></thead>
        <tbody>{metrics.map(m => { const vals = items.map(i => i[m.k]).filter(v => v !== null && v !== undefined); const best = vals.length > 1 ? (m.good === 'max' ? Math.max(...vals) : Math.min(...vals.filter(v => v > 0).length ? vals.filter(v => v > 0) : vals)) : null
          return <tr key={m.k} style={{ borderTop: '1px solid #F1F5F9' }}><td style={{ padding: 10, fontWeight: 600 }}>{m.l}</td>{items.map(i => { const v = i[m.k]; const isBest = best !== null && v === best
            return <td key={i.name} style={{ padding: 10, textAlign: 'right', fontWeight: isBest ? 800 : 500, color: isBest ? C.green : C.ink, background: isBest ? C.greenBg : 'transparent' }}>{v === null || v === undefined ? '—' : m.f(v)}</td> })}</tr> })}</tbody></table>
    </Card>}
    {items && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Costo estimado = horas limpiando × costo/hora de los cleaners asignados.</div>}
  </div>
}

export default function CompareTab({ onDebug }: { onDebug: (d: any) => void }) {
  const [mode, setMode] = useState<Mode>('periodos')
  return <div>
    <div style={{ marginBottom: 12 }}><Seg items={[['periodos', 'Periodos'], ['property', 'Casas'], ['client', 'Clientes']]} value={mode} onChange={v => setMode(v as Mode)} /></div>
    {mode === 'periodos' ? <Periodos onDebug={onDebug} /> : <Entidades entity={mode} onDebug={onDebug} />}
  </div>
}
