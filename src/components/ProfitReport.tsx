import { Fragment, useEffect, useMemo, useState } from 'react'

const C = { ink: '#0F172A', slate: '#475569', muted: '#94A3B8', border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF', green: '#047857', red: '#B91C1C', amber: '#B45309', primary: '#6366F1' }
const money = (n: number | null | undefined) => n === null || n === undefined ? '—' : (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US')
const iso = (d: Date) => d.toLocaleDateString('en-CA')
const addDays = (d: string, n: number) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return iso(x) }
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000) + 1
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

interface Cl { id: string; date: string | null; property: string; clientName: string | null; price: number | null; status: string | null; hoursWorked: number | null; hoursTotal: number | null; laborCost: number | null; cleaningType: string | null }
interface Agg { key: string; n: number; houses: Set<string>; rev: number; labor: number; hh: number; withLabor: number; clients: Set<string> }

const aggregate = (cs: Cl[], by: 'client' | 'property') => {
  const m: Record<string, Agg> = {}
  for (const c of cs) {
    const key = by === 'client' ? (c.clientName || 'Sin cliente') : (c.property || 'Sin propiedad')
    const a = (m[key] ||= { key, n: 0, houses: new Set(), rev: 0, labor: 0, hh: 0, withLabor: 0, clients: new Set() })
    a.n++; a.houses.add(c.property || '—'); a.clients.add(c.clientName || '—'); a.rev += c.price || 0
    if (c.laborCost !== null && c.hoursTotal) { a.labor += c.laborCost; a.hh += c.hoursTotal; a.withLabor++ }
  }
  return m
}

export default function ProfitReport({ by }: { by: 'client' | 'property' }) {
  const t = today()
  const [from, setFrom] = useState(t.slice(0, 8) + '01')
  const [to, setTo] = useState(t)
  const [type, setType] = useState('all')
  const [cur, setCur] = useState<Cl[]>([])
  const [prev, setPrev] = useState<Cl[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: 'rev', dir: -1 })
  const [open, setOpen] = useState<string | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number; key: string } | null>(null)
  const [showDebug, setShowDebug] = useState(false)

  const len = daysBetween(from, to)
  const pFrom = addDays(from, -len), pTo = addDays(from, -1)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr('')
    ;(async () => {
      try {
        const [a, b] = await Promise.all([
          fetch(`/api/getReports?type=billing&dateFrom=${from}&dateTo=${to}`),
          fetch(`/api/getReports?type=billing&dateFrom=${pFrom}&dateTo=${pTo}`),
        ])
        if (!a.ok) throw new Error(`HTTP ${a.status}`)
        const ja = await a.json(); const jb = b.ok ? await b.json() : { cleanings: [] }
        if (!alive) return
        setCur(ja.cleanings || []); setPrev(jb.cleanings || [])
      } catch (e: any) { if (alive) setErr(e.message) } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [from, to])

  const types = useMemo(() => [...new Set(cur.map(c => c.cleaningType).filter(Boolean))].sort() as string[], [cur])
  const keep = (c: Cl) => c.status === 'Done' && (type === 'all' || c.cleaningType === type)
  const curF = useMemo(() => cur.filter(keep), [cur, type])
  const prevF = useMemo(() => prev.filter(keep), [prev, type])
  const A = useMemo(() => aggregate(curF, by), [curF, by])
  const P = useMemo(() => aggregate(prevF, by), [prevF, by])

  const rows = useMemo(() => Object.values(A).map(a => {
    const p = P[a.key]
    const avgLabor = a.withLabor ? a.labor / a.withLabor : null
    const margin = a.withLabor ? a.rev - a.labor : null // sobre las limpiezas con labor
    const revWith = curF.filter(c => (by === 'client' ? (c.clientName || 'Sin cliente') : (c.property || 'Sin propiedad')) === a.key && c.laborCost !== null && c.hoursTotal).reduce((t, c) => t + (c.price || 0), 0)
    const mg = a.withLabor ? revWith - a.labor : null
    return { key: a.key, n: a.n, houses: a.houses.size, rev: a.rev, avg: a.n ? a.rev / a.n : 0, avgLabor, avgMargin: mg !== null && a.withLabor ? mg / a.withLabor : null,
      pct: mg !== null && revWith > 0 ? mg / revWith * 100 : null, mhh: mg !== null && a.hh > 0 ? mg / a.hh : null, margin,
      dRev: p && p.rev > 0 ? (a.rev - p.rev) / p.rev * 100 : null, prev: p ? { n: p.n, rev: p.rev, pct: (() => { const pw = prevF.filter(c => (by === 'client' ? (c.clientName || 'Sin cliente') : (c.property || 'Sin propiedad')) === a.key && c.laborCost !== null && c.hoursTotal); const r = pw.reduce((t, c) => t + (c.price || 0), 0), l = pw.reduce((t, c) => t + (c.laborCost || 0), 0); return r > 0 ? (r - l) / r * 100 : null })() } : null }
  }).sort((x: any, y: any) => ((x[sort.k] ?? -Infinity) - (y[sort.k] ?? -Infinity)) * sort.dir), [A, P, curF, prevF, sort, by])

  const tot = useMemo(() => {
    const rev = curF.reduce((s, c) => s + (c.price || 0), 0)
    const w = curF.filter(c => c.laborCost !== null && c.hoursTotal)
    const labor = w.reduce((s, c) => s + (c.laborCost || 0), 0), revW = w.reduce((s, c) => s + (c.price || 0), 0), hh = w.reduce((s, c) => s + (c.hoursTotal || 0), 0)
    return { rev, labor, margin: revW - labor, pct: revW > 0 ? (revW - labor) / revW * 100 : null, mhh: hh > 0 ? (revW - labor) / hh : null, n: curF.length, withLabor: w.length }
  }, [curF])

  const setQuick = (k: string) => {
    const now = today(); const first = now.slice(0, 8) + '01'
    if (k === 'mtd') { setFrom(first); setTo(now) }
    else if (k === 'last') { const lp = new Date(first + 'T12:00:00'); lp.setDate(0); setTo(iso(lp)); lp.setDate(1); setFrom(iso(lp)) }
    else if (k === '28') { setFrom(addDays(now, -27)); setTo(now) }
    else if (k === '90') { setFrom(addDays(now, -89)); setTo(now) }
  }
  const th = (k: string, label: string, right = true) => (
    <th onClick={() => setSort(s => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))} style={{ textAlign: right ? 'right' : 'left', fontSize: 10, color: C.muted, letterSpacing: '.04em', padding: '8px', background: C.bg, textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}{sort.k === k ? (sort.dir === -1 ? ' ▼' : ' ▲') : ''}</th>
  )
  const mc = (p: number | null) => p === null ? C.muted : p < 40 ? C.red : p < 50 ? C.amber : C.green
  const exportCSV = () => {
    const head = [by === 'client' ? 'Cliente' : 'Casa', 'Limpiezas', 'Casas', 'Ingreso', 'Prom/limp', 'Labor prom', 'Margen prom', 'Margen %', 'Margen/HH', 'Δ ingreso %']
    const lines = rows.map(r => [r.key, r.n, r.houses, r.rev.toFixed(2), r.avg.toFixed(2), r.avgLabor?.toFixed(2) ?? '', r.avgMargin?.toFixed(2) ?? '', r.pct?.toFixed(1) ?? '', r.mhh?.toFixed(2) ?? '', r.dRev?.toFixed(1) ?? ''].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' }); const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `${by}-${from}_${to}.csv`; a.click()
  }
  const sel: React.CSSProperties = { height: 38, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, background: C.white }
  const tipRow = tip ? rows.find(r => r.key === tip.key) : null
  const Tile = ({ l, v, s, c }: { l: string; v: string; s?: string; c?: string }) => <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}><p style={{ fontSize: 12, color: '#64748B' }}>{l}</p><p style={{ fontSize: 22, fontWeight: 700, color: c || C.ink, letterSpacing: '-0.02em' }}>{loading ? '…' : v}</p>{s && <p style={{ fontSize: 11, color: C.muted }}>{s}</p>}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={from} onChange={e => e.target.value && setFrom(e.target.value)} style={sel} />
        <span style={{ color: C.muted }}>—</span>
        <input type="date" value={to} onChange={e => e.target.value && setTo(e.target.value)} style={sel} />
        <select defaultValue="mtd" onChange={e => setQuick(e.target.value)} style={sel}>
          <option value="mtd">Este mes</option><option value="last">Mes pasado</option><option value="28">Últimas 4 semanas</option><option value="90">Últimos 90 días</option>
        </select>
        <select value={type} onChange={e => setType(e.target.value)} style={sel}>
          <option value="all">Todos los servicios</option>{types.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <button onClick={exportCSV} style={{ ...sel, borderColor: '#10B981', background: '#D1FAE5', color: C.green, fontWeight: 600, cursor: 'pointer' }}>Exportar CSV</button>
      </div>
      {err && <p style={{ color: C.red, fontSize: 13 }}>Error: {err}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Tile l="Ingreso" v={money(tot.rev)} s={`${tot.n} limpiezas terminadas`} />
        <Tile l="Labor (estimado)" v={money(tot.labor)} s="horas de cada limpieza × Cost/Hour" />
        <Tile l="Margen" v={money(tot.margin)} c={tot.margin >= 0 ? C.green : C.red} s={`sobre ${tot.withLabor} limpiezas con tiempo`} />
        <Tile l="Margen %" v={tot.pct === null ? '—' : `${Math.round(tot.pct)}%`} c={mc(tot.pct)} />
        <Tile l="Margen / HH" v={tot.mhh === null ? '—' : `$${tot.mhh.toFixed(0)}`} />
      </div>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse' }}>
          <thead><tr>
            {th('key', by === 'client' ? 'Cliente' : 'Casa', false)}{th('n', 'Limp.')}{by === 'client' && th('houses', 'Casas')}{th('rev', 'Ingreso')}{th('avg', 'Prom./limp.')}{th('avgLabor', 'Labor prom.')}{th('avgMargin', 'Margen prom.')}{th('pct', 'Margen %')}{th('mhh', 'Margen/HH')}{th('dRev', 'Δ ingreso')}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={10} style={{ padding: 16, color: C.muted, fontSize: 13 }}>Cargando…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={10} style={{ padding: 16, color: C.muted, fontSize: 13 }}>Sin limpiezas terminadas en el rango.</td></tr>}
            {rows.map(r => {
              const isOpen = open === r.key && by === 'client'
              const td: React.CSSProperties = { padding: '8px', borderTop: '1px solid #F1F5F9', fontSize: 12.5, textAlign: 'right' }
              return (
                <Fragment key={r.key}>
                  <tr onClick={() => by === 'client' && setOpen(isOpen ? null : r.key)} onMouseMove={e => setTip({ x: e.clientX, y: e.clientY, key: r.key })} onMouseLeave={() => setTip(null)} style={{ cursor: by === 'client' ? 'pointer' : 'default' }}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 600, color: C.ink }}>{by === 'client' ? (isOpen ? '▾ ' : '▸ ') : ''}{r.key}</td>
                    <td style={td}>{r.n}</td>{by === 'client' && <td style={td}>{r.houses}</td>}
                    <td style={td}>{money(r.rev)}</td><td style={td}>{money(r.avg)}</td><td style={td}>{money(r.avgLabor)}</td><td style={td}>{money(r.avgMargin)}</td>
                    <td style={{ ...td, fontWeight: 700, color: mc(r.pct) }}>{r.pct === null ? '—' : `${Math.round(r.pct)}%`}</td>
                    <td style={td}>{r.mhh === null ? '—' : `$${r.mhh.toFixed(0)}`}</td>
                    <td style={{ ...td, color: r.dRev === null ? C.muted : r.dRev >= 0 ? C.green : C.red }}>{r.dRev === null ? '—' : `${r.dRev >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(r.dRev))}%`}</td>
                  </tr>
                  {isOpen && Object.values(aggregate(curF.filter(c => (c.clientName || 'Sin cliente') === r.key), 'property')).sort((a, b) => b.rev - a.rev).map(h => (
                    <tr key={r.key + h.key} style={{ background: C.bg }}>
                      <td style={{ ...td, textAlign: 'left', paddingLeft: 28, color: C.slate }}>{h.key}</td><td style={td}>{h.n}</td><td style={td} /><td style={td}>{money(h.rev)}</td><td style={td}>{money(h.n ? h.rev / h.n : 0)}</td>
                      <td style={td}>{h.withLabor ? money(h.labor / h.withLabor) : '—'}</td><td style={td}>{h.withLabor ? money((h.rev - h.labor) / h.withLabor) : '—'}</td><td style={td} /><td style={td} /><td style={td} />
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {tip && tipRow && (
        <div style={{ position: 'fixed', left: Math.min(tip.x + 14, window.innerWidth - 270), top: tip.y + 14, background: C.ink, color: '#fff', borderRadius: 10, padding: '10px 12px', fontSize: 11.5, lineHeight: 1.5, width: 250, zIndex: 50, pointerEvents: 'none', boxShadow: '0 8px 24px rgba(15,23,42,.3)' }}>
          <b>{tipRow.key}</b><br />
          Ahora ({from.slice(5)}→{to.slice(5)}): {tipRow.n} limp. · {money(tipRow.rev)} · margen {tipRow.pct === null ? '—' : Math.round(tipRow.pct) + '%'}<br />
          Antes ({pFrom.slice(5)}→{pTo.slice(5)}): {tipRow.prev ? `${tipRow.prev.n} limp. · ${money(tipRow.prev.rev)} · margen ${tipRow.prev.pct === null ? '—' : Math.round(tipRow.prev.pct) + '%'}` : 'sin limpiezas'}
        </div>
      )}
      <p style={{ fontSize: 11, color: C.muted }}>Solo limpiezas terminadas. Labor = horas de la limpieza × Cost/Hour de quienes la hicieron (si no hay cleaners asignados no se calcula). Margen rojo &lt; 40%, ámbar &lt; 50%. Δ y tooltip comparan contra el periodo anterior de igual duración.{by === 'client' ? ' Clic en un cliente para ver sus casas.' : ''}</p>
      <button onClick={() => setShowDebug(v => !v)} style={{ alignSelf: 'flex-start', fontSize: 12, color: C.slate, background: 'none', border: 'none', cursor: 'pointer' }}>{showDebug ? '▾' : '▸'} Debug</button>
      {showDebug && <pre style={{ background: C.ink, color: '#E2E8F0', padding: 12, borderRadius: 10, fontSize: 12, overflowX: 'auto' }}>{JSON.stringify({ rango: [from, to], previo: [pFrom, pTo], leidas: cur.length, terminadas: curF.length, conLabor: tot.withLabor, sinTiempo: curF.length - tot.withLabor, previas: prev.length }, null, 2)}</pre>}
    </div>
  )
}
