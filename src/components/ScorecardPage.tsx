import { useEffect, useMemo, useState } from 'react'
import CascadaPage from './CascadaPage'
import { C, Card, Seg, selStyle, btn, Err, Loading, useIsMobile, todayET, addDays, mondayOf, rangeLabel } from './reports/shared'

type M = { key: string; label: string; unit: '$' | '$0' | '%' | 'n' | 'min'; dir: 'up' | 'down'; hint: string; lead?: boolean; sum?: boolean }
const METRICS: M[] = [
  { key: 'revHH', label: 'Revenue / HH', unit: '$', dir: 'up', hint: 'North Star · ingreso ÷ horas-persona facturables', lead: true },
  { key: 'ingreso', label: 'Ingreso (terminadas)', unit: '$0', dir: 'up', hint: 'Suma de Price de limpiezas Done', sum: true },
  { key: 'carga', label: 'Carga de rutas', unit: '%', dir: 'up', hint: 'HH limpiando ÷ (48 h × cleaners activos)' },
  { key: 'util', label: 'Utilización', unit: '%', dir: 'up', hint: 'Horas de turno pagadas ÷ (48 h × cleaners activos) · solo desde que hay Turnos' },
  { key: 'productivo', label: 'Tiempo productivo', unit: '%', dir: 'up', hint: 'HH limpiando ÷ horas de turno pagadas · solo desde que hay Turnos' },
  { key: 'traslado', label: 'Traslado entre casas', unit: 'min', dir: 'down', hint: 'Min promedio entre el fin de una casa y el inicio de la siguiente (mismo squad)' },
  { key: 'ritmo', label: 'Ritmo vs estándar', unit: '%', dir: 'down', hint: 'HH reales ÷ Labor de la propiedad (100% = estándar)' },
  { key: 'onTime', label: 'On-time (≤15 min)', unit: '%', dir: 'up', hint: 'Inicio real vs Scheduled Time; más de 15 min cuenta como tarde' },
  { key: 'cumplimiento', label: 'Cumplimiento', unit: '%', dir: 'up', hint: 'Terminadas ÷ programadas (hasta hoy)' },
  { key: 'incidentes', label: 'Incidentes / 100 limp.', unit: 'n', dir: 'down', hint: 'Incidents creados ÷ limpiezas terminadas × 100' },
  { key: 'retencion', label: 'Retención 90d→30d', unit: '%', dir: 'up', hint: 'Clientes de hace 31–90 días que volvieron en los últimos 30' },
  { key: 'margenHH', label: 'Margen / HH', unit: '$', dir: 'up', hint: '(ingreso − labor a Cost/Hour) ÷ HH' },
]

const fmt = (v: number | null | undefined, u: string, k = false) => {
  if (v === null || v === undefined) return '—'
  if (u === '$') return k && Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(Math.abs(v) >= 1000 ? 0 : 2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
  if (u === '$0') return k && Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${Math.round(v).toLocaleString('en-US')}`
  if (u === '%') return `${Math.round(v)}%`
  if (u === 'min') return `${Math.round(v)} min`
  return String(Math.round(v * 10) / 10)
}

// caché corto en memoria (mismos filtros → no se vuelve a pedir a Airtable)
const cache = new Map<string, { t: number; d: any }>()
async function get(q: Record<string, string>) {
  const key = JSON.stringify(q)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.t < 180000) return hit.d
  const r = await fetch(`/api/getDashboard?${new URLSearchParams(q)}`)
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
  cache.set(key, { t: Date.now(), d: j })
  return j
}

function Spark({ vals }: { vals: (number | null)[] }) {
  const v = vals.filter((x): x is number => x !== null)
  if (v.length < 2) return null
  const mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1
  const pts = v.map((x, i) => `${(i * 56 / (v.length - 1)).toFixed(1)},${(18 - (x - mn) / r * 16).toFixed(1)}`).join(' ')
  return <svg width="60" height="20"><polyline fill="none" stroke={C.primary} strokeWidth="1.6" points={pts} /></svg>
}

const PILL = { g: { bg: C.greenBg, c: C.green }, a: { bg: C.amberBg, c: C.amber }, r: { bg: C.redBg, c: C.red } }
function Val({ m, v, goal, plain }: { m: M; v: number | null | undefined; goal: number | null | undefined; plain?: boolean }) {
  const txt = fmt(v, m.unit)
  if (v === null || v === undefined) return <span style={{ color: C.muted }}>—</span>
  if (plain || goal === null || goal === undefined || (goal === 0 && m.key !== 'incidentes')) return <span style={{ fontWeight: 600, color: C.slate }}>{txt}</span>
  const ok = m.dir === 'up' ? v >= goal : v <= goal
  const near = Math.abs(v - goal) <= Math.abs(goal) * 0.05
  const p = PILL[ok ? 'g' : near ? 'a' : 'r']
  return <span style={{ background: p.bg, color: p.c, fontWeight: 700, fontSize: 12.5, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{txt}</span>
}

function ScorecardTable() {
  const mobile = useIsMobile()
  const today = todayET()
  const curMon = mondayOf(today)
  const lastSun = addDays(curMon, -1)
  const [gran, setGran] = useState<'week' | 'day' | 'month'>('week')
  const [from, setFrom] = useState(addDays(curMon, -28))
  const [to, setTo] = useState(today > curMon ? today : lastSun)
  const [fSquad, setFSquad] = useState('')
  const [fClient, setFClient] = useState('')
  const [fProp, setFProp] = useState('')
  const [fType, setFType] = useState('')
  const [data, setData] = useState<any>(null)
  const [sum, setSum] = useState<any>(null)
  const [opts, setOpts] = useState<any>({ clients: [], properties: [], types: [], squads: [] })
  const [err, setErr] = useState('')
  const [sumErr, setSumErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDebug, setShowDebug] = useState(true)

  // semanas: la que sigue en curso no entra al total del periodo (solo semanas completas)
  const fullTo = gran === 'week' && to > lastSun ? lastSun : to
  const filters = useMemo(() => { const q: Record<string, string> = {}; if (fSquad) q.squad = fSquad; if (fClient) q.client = fClient; if (fProp) q.property = fProp; if (fType) q.type = fType; return q }, [fSquad, fClient, fProp, fType])

  const load = async (fresh = false) => {
    if (fresh) cache.clear()
    setLoading(true); setErr('')
    try {
      const j = await get({ action: 'scorecard', from, to, gran, fullTo, ...filters })
      setData(j); if (j.options) setOpts(j.options)
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { if (from && to && from <= to) load() }, [from, to, gran, fullTo, filters])

  // mes y año a la fecha: se piden aparte (más pesado) y llegan después
  useEffect(() => {
    let alive = true
    setSum(null); setSumErr('')
    get({ action: 'scorecard', from: today.slice(0, 4) + '-01-01', to: today, gran: 'month', summary: '1', ...filters })
      .then(j => { if (alive) setSum(j) }).catch(e => { if (alive) setSumErr(e.message) })
    return () => { alive = false }
  }, [filters])

  const quick = (k: string) => {
    if (k === '4w') { setGran('week'); setFrom(addDays(curMon, -28)); setTo(today > curMon ? today : lastSun) }
    else if (k === '8w') { setGran('week'); setFrom(addDays(curMon, -56)); setTo(today > curMon ? today : lastSun) }
    else if (k === 'lm') { const d = new Date(today.slice(0, 7) + '-01T12:00:00Z'); d.setUTCDate(0); const e = d.toISOString().slice(0, 10); setGran('week'); setTo(e); setFrom(e.slice(0, 7) + '-01') }
    else if (k === '30d') { setGran('day'); setFrom(addDays(today, -29)); setTo(today) }
    else if (k === '6m') { setGran('month'); setFrom(addDays(today, -182)); setTo(today) }
  }
  const shift = (dir: number) => { const n = gran === 'day' ? 30 : gran === 'month' ? 90 : 28; setFrom(addDays(from, dir * n)); setTo(addDays(to, dir * n)) }

  const cols: any[] = data?.weeks || []
  const goal = (k: string) => data?.suggested?.[k]?.median ?? null
  const mtd = sum?.weeks?.find((w: any) => w.start.slice(0, 7) === today.slice(0, 7)) || null
  const ytd = sum?.total || null
  const nFull = cols.filter(w => !w.partial && !w.future && (gran !== 'week' || w.end <= fullTo)).length
  const periodLabel = gran === 'week' ? `${nFull} sem.` : 'Periodo'
  const isLive = (w: any) => gran === 'week' && w.end > fullTo

  const weeksElapsed = Math.max(1, (new Date(today + 'T12:00:00Z').getTime() - new Date(today.slice(0, 4) + '-01-01T12:00:00Z').getTime()) / 86400000 / 7)
  const pct = (a: number | null | undefined, b: number | null | undefined) => a && b ? (a - b) / b * 100 : null
  const dTag = (p: number | null, good = true) => p === null ? null : <div style={{ fontSize: 12, fontWeight: 700, color: (p >= 0) === good ? C.green : C.red, marginTop: 2 }}>{p >= 0 ? '▲ +' : '▼ −'}{Math.abs(p).toFixed(1)}%</div>

  const revM = METRICS[0], otM = METRICS[7]
  const goalDelta = (m: M, v: number | null | undefined) => { const g = goal(m.key); if (v === null || v === undefined || g === null) return null; const d = v - g; const ok = m.dir === 'up' ? d >= 0 : d <= 0; return <div style={{ fontSize: 12, fontWeight: 700, color: ok ? C.green : C.red, marginTop: 2 }}>{d >= 0 ? '▲ +' : '▼ −'}{m.unit === '$' ? `$${Math.abs(d).toFixed(2)}` : m.unit === '%' ? `${Math.abs(Math.round(d))} pts` : `${Math.abs(Math.round(d))} ${m.unit}`} vs meta</div> }
  const lab: React.CSSProperties = { fontSize: 11, color: C.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }
  const big: React.CSSProperties = { fontSize: 24, fontWeight: 700, margin: '4px 0 0', color: C.ink }
  const sub: React.CSSProperties = { fontSize: 11.5, color: C.slate, marginTop: 2 }

  const th: React.CSSProperties = { padding: '10px 10px', textAlign: 'right', fontSize: 11, color: C.slate, fontWeight: 600, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}` }
  const thSub = (t: string) => <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 500, marginTop: 2 }}>{t}</div>
  const grp: React.CSSProperties = { background: '#FAFAFF' }
  const dash = <span style={{ color: C.muted }}>…</span>
  const sumCell = (m: M, src: any) => sumErr ? <span style={{ color: C.muted }} title={sumErr}>—</span> : !src ? dash : <Val m={m} v={src[m.key]} goal={goal(m.key)} plain={m.sum} />

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <Seg items={[['week', 'Semanas'], ['day', 'Días'], ['month', 'Meses']]} value={gran} onChange={v => setGran(v as any)} />
        <button onClick={() => shift(-1)} style={btn()}>‹</button>
        <input type="date" value={from} onChange={e => e.target.value && setFrom(e.target.value)} style={selStyle} />
        <span style={{ color: C.muted }}>—</span>
        <input type="date" value={to} onChange={e => e.target.value && setTo(e.target.value)} style={selStyle} />
        <button onClick={() => shift(1)} style={btn()}>›</button>
        <select defaultValue="" onChange={e => { if (e.target.value) quick(e.target.value); e.target.value = '' }} style={selStyle}>
          <option value="">Rango rápido…</option><option value="4w">Últimas 4 semanas</option><option value="8w">Últimas 8 semanas</option><option value="lm">Mes pasado</option><option value="30d">Últimos 30 días (por día)</option><option value="6m">Últimos 6 meses</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={fSquad} onChange={e => setFSquad(e.target.value)} style={selStyle}><option value="">Squad: todos</option>{(opts.squads || []).map((x: any) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
        <select value={fClient} onChange={e => setFClient(e.target.value)} style={selStyle}><option value="">Cliente: todos</option>{opts.clients.map((x: string) => <option key={x} value={x}>{x}</option>)}</select>
        <select value={fProp} onChange={e => setFProp(e.target.value)} style={selStyle}><option value="">Casa: todas</option>{opts.properties.map((x: string) => <option key={x} value={x}>{x}</option>)}</select>
        <select value={fType} onChange={e => setFType(e.target.value)} style={selStyle}><option value="">Servicio: todos</option>{opts.types.map((x: string) => <option key={x} value={x}>{x}</option>)}</select>
        {(fSquad || fClient || fProp || fType) && <button onClick={() => { setFSquad(''); setFClient(''); setFProp(''); setFType('') }} style={btn()}>× Limpiar</button>}
        <button onClick={() => load(true)} style={btn()}>Recargar</button>
      </div>

      <Loading on={loading} />
      <Err msg={err} />

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginBottom: 12, opacity: loading ? .5 : 1 }}>
            <Card><div style={lab}>Revenue / HH · {periodLabel}</div><div style={big}>{fmt(data.total.revHH, '$')}</div>{goalDelta(revM, data.total.revHH)}<div style={sub}>Meta {fmt(goal('revHH'), '$')} · V/TO $50</div></Card>
            <Card><div style={lab}>Ingreso · mes a la fecha</div><div style={big}>{mtd ? fmt(mtd.ingreso, '$', true) : sumErr ? '—' : '…'}</div>{mtd && sum?.mtdPrev && dTag(pct(mtd.ingreso, sum.mtdPrev.ingreso))}<div style={sub}>{sum?.mtdPrev ? `Mes anterior a esta fecha: ${fmt(sum.mtdPrev.ingreso, '$', true)}` : ' '}</div></Card>
            <Card><div style={lab}>Ingreso · año a la fecha</div><div style={big}>{ytd ? fmt(ytd.ingreso, '$', true) : sumErr ? '—' : '…'}</div><div style={sub}>{ytd ? `Promedio ${fmt(ytd.ingreso / weeksElapsed, '$', true)} por semana` : ' '}</div></Card>
            <Card><div style={lab}>On-time · {periodLabel}</div><div style={big}>{fmt(data.total.onTime, '%')}</div>{goalDelta(otM, data.total.onTime)}<div style={sub}>Meta {fmt(goal('onTime'), '%')}</div></Card>
          </div>
          {sumErr && <Err msg={`Mes/año a la fecha: ${sumErr}`} />}

          {mobile ? (
            <div style={{ opacity: loading ? .5 : 1 }}>
              {METRICS.map(m => {
                const last = [...cols].reverse().find(w => !w.future)
                return (
                  <Card key={m.key} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div><div style={lab}>{m.label}</div><div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{m.hint}</div></div>
                      <Spark vals={cols.map(w => w[m.key])} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                      <span style={{ fontSize: 21, fontWeight: 700 }}>{fmt(data.total[m.key], m.unit, true)}</span><span style={sub}>{periodLabel}</span>
                      <span style={{ marginLeft: 'auto' }}><Val m={m} v={data.total[m.key]} goal={goal(m.key)} plain={m.sum} /></span>
                    </div>
                    <div style={{ fontSize: 11.5, color: C.slate, marginTop: 4 }}>Mes a la fecha {mtd ? fmt(mtd[m.key], m.unit, true) : '…'} · Año {ytd ? fmt(ytd[m.key], m.unit, true) : '…'} · Meta {fmt(goal(m.key), m.unit)}{last && isLive(last) ? ` · en curso ${fmt(last[m.key], m.unit, true)}` : ''}</div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, opacity: loading ? .5 : 1 }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, minWidth: 760 }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, background: C.bg, minWidth: 220 }}>Medida</th>
                    {cols.map(w => <th key={w.start} style={{ ...th, opacity: w.future ? .4 : 1 }}>{w.label.split(' · ')[0]}{isLive(w) && <span style={{ marginLeft: 4, fontSize: 9.5, fontWeight: 700, background: C.primaryLight, color: C.primaryDark, borderRadius: 6, padding: '1px 6px' }}>en curso</span>}{thSub(gran === 'week' ? rangeLabel(w.start, w.end) : w.label.split(' · ')[1] || '')}</th>)}
                    <th style={th}>Tendencia</th>
                    <th style={{ ...th, ...grp, color: C.primaryDark }}>{periodLabel}{thSub(rangeLabel(from, fullTo))}</th>
                    <th style={{ ...th, ...grp, color: C.primaryDark }}>Mes a la fecha{thSub(rangeLabel(today.slice(0, 7) + '-01', today))}</th>
                    <th style={{ ...th, ...grp, color: C.primaryDark }}>Año a la fecha{thSub(rangeLabel(today.slice(0, 4) + '-01-01', today))}</th>
                    <th style={th}>Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map(m => {
                    const s = data.suggested?.[m.key]
                    const bg = m.lead ? '#F5F6FF' : C.white
                    const td: React.CSSProperties = { textAlign: 'right', padding: '10px 10px', borderBottom: `1px solid ${C.bg}`, background: bg, fontVariantNumeric: 'tabular-nums' }
                    return (
                      <tr key={m.key}>
                        <td style={{ ...td, textAlign: 'left', position: 'sticky', left: 0 }} title={m.hint}>
                          <div style={{ fontWeight: 700, color: C.ink }}>{m.label}</div>
                          <div style={{ fontSize: 10.5, color: C.muted, maxWidth: 230 }}>{m.hint}</div>
                        </td>
                        {cols.map(w => <td key={w.start} style={td}>{w.future ? '' : <Val m={m} v={w[m.key]} goal={goal(m.key)} plain={isLive(w)} />}</td>)}
                        <td style={td}><Spark vals={cols.filter(w => !isLive(w) && !w.future).map(w => w[m.key])} /></td>
                        <td style={{ ...td, ...grp, fontWeight: 700 }}><Val m={m} v={data.total[m.key]} goal={goal(m.key)} plain={m.sum} /></td>
                        <td style={{ ...td, ...grp, fontWeight: 700 }}>{sumCell(m, mtd)}</td>
                        <td style={{ ...td, ...grp, fontWeight: 700 }}>{sumCell(m, ytd)}</td>
                        <td style={{ ...td, color: C.slate, whiteSpace: 'nowrap' }} title={s ? `rango ${fmt(s.min, m.unit)}–${fmt(s.max, m.unit)} · ${s.weeks} periodos` : ''}>
                          {m.sum ? <span style={{ color: C.muted }}>{s?.median != null ? `${fmt(s.median, m.unit)} /sem` : '—'}</span> : s?.median != null ? fmt(s.median, m.unit) : '—'}
                          {m.key === 'revHH' && <div style={{ fontSize: 10.5, color: C.muted }}>V/TO: $50</div>}
                          {m.key === 'traslado' && <div style={{ fontSize: 10.5, color: C.muted }}>V/TO: ~5 min</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>La semana en curso va en gris y no entra al total del periodo. Verde = cumple la meta, ámbar = a menos de 5%, rojo = fuera. Meta = mediana de los periodos completos (tú la ajustas). Ingreso en las columnas moradas es un total, no se pinta contra la meta semanal. Utilización y Tiempo productivo se miden solo desde que existen Turnos{data.turnoStart ? ` (${data.turnoStart})` : ''}.</p>

          {data.warnings?.length > 0 && (
            <div style={{ background: C.amberBg, border: '1px solid #FDE68A', borderRadius: 10, padding: 12, marginTop: 10, fontSize: 13, color: C.amber }}>
              {data.warnings.map((w: string, i: number) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}
          <button onClick={() => setShowDebug(!showDebug)} style={{ marginTop: 12, fontSize: 12, color: C.slate, background: 'none', border: 'none', cursor: 'pointer' }}>{showDebug ? '▾' : '▸'} Debug</button>
          {showDebug && (
            <pre style={{ background: C.ink, color: '#E2E8F0', padding: 12, borderRadius: 10, fontSize: 12, overflowX: 'auto' }}>
{JSON.stringify({ debug: data.debug, turnoStart: data.turnoStart, rango: { from, to, fullTo }, periodo: { limpiezas: data.total.limpiezas, terminadas: data.total.terminadas, conTiempo: data.total.conTiempo, cleaners: data.total.cleaners, hhFact: data.total.hhFact, capacidadH: data.total.capacidadH, turnoH: data.total.turnoH, nTraslados: data.total.nTraslados, conHora: data.total.conHora, retBase: data.total.retBase }, anio: sum ? { debug: sum.debug, terminadas: sum.total?.terminadas, util: sum.total?.util, productivo: sum.total?.productivo, mtdPrev: sum.mtdPrev ? { from: sum.mtdPrev.from, to: sum.mtdPrev.to, ingreso: sum.mtdPrev.ingreso } : null } : (sumErr || 'cargando…') }, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  )
}

export default function ScorecardPage() {
  const [tab, setTab] = useState<'cascada' | 'tabla'>('cascada')
  return <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Seg items={[['cascada', 'Cascada'], ['tabla', 'Tabla']]} value={tab} onChange={v => setTab(v as any)} />
    {tab === 'cascada' ? <CascadaPage /> : <ScorecardTable />}
  </div>
}
