import { useEffect, useState } from 'react'

const C = { ink: '#0F172A', slate: '#475569', muted: '#94A3B8', border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF', green: '#047857', amber: '#B45309', red: '#B91C1C', primary: '#6366F1' }

type M = { key: string; label: string; unit: '$' | '%' | 'n' | 'min'; dir: 'up' | 'down'; hint: string; lead?: boolean }
const METRICS: M[] = [
  { key: 'revHH', label: 'Revenue / HH', unit: '$', dir: 'up', hint: 'North Star · ingreso ÷ horas-persona facturables', lead: true },
  { key: 'ingreso', label: 'Ingreso (terminadas)', unit: '$', dir: 'up', hint: 'Suma de Price de limpiezas Done' },
  { key: 'carga', label: 'Carga de rutas', unit: '%', dir: 'up', hint: 'HH limpiando ÷ (48 h × cleaners activos)' },
  { key: 'util', label: 'Utilización', unit: '%', dir: 'up', hint: 'Horas de turno pagadas ÷ (48 h × cleaners activos) · solo desde 30 oct' },
  { key: 'productivo', label: 'Tiempo productivo', unit: '%', dir: 'up', hint: 'HH limpiando ÷ horas de turno pagadas · solo desde 30 oct' },
  { key: 'traslado', label: 'Traslado entre casas', unit: 'min', dir: 'down', hint: 'Minutos promedio entre el fin de una casa y el inicio de la siguiente del mismo squad' },
  { key: 'ritmo', label: 'Ritmo vs estándar', unit: '%', dir: 'down', hint: 'HH reales ÷ Labor de la propiedad (100% = tiempo estándar)' },
  { key: 'onTime', label: 'On-time (≤15 min)', unit: '%', dir: 'up', hint: 'Inicio real vs Scheduled Time; tardanza > 15 min cuenta como tarde' },
  { key: 'cumplimiento', label: 'Cumplimiento', unit: '%', dir: 'up', hint: 'Terminadas ÷ programadas (hasta hoy)' },
  { key: 'incidentes', label: 'Incidentes / 100 limp.', unit: 'n', dir: 'down', hint: 'Incidents creados ÷ limpiezas terminadas × 100' },
  { key: 'retencion', label: 'Retención 90d→30d', unit: '%', dir: 'up', hint: 'Clientes de hace 31–90 días que volvieron en los últimos 30' },
  { key: 'margenHH', label: 'Margen / HH', unit: '$', dir: 'up', hint: '(ingreso − labor a Cost/Hour) ÷ HH' },
]

const fmt = (v: number | null | undefined, u: string) => v === null || v === undefined ? '--' : u === '$' ? `$${v.toFixed(2)}` : u === '%' ? `${Math.round(v)}%` : u === 'min' ? `${Math.round(v)} min` : String(Math.round(v * 10) / 10)
const iso = (d: Date) => d.toLocaleDateString('en-CA')
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const addDays = (d: string, n: number) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return iso(x) }
const sel: React.CSSProperties = { height: 38, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, background: C.white }

export default function ScorecardPage() {
  const [gran, setGran] = useState<'week' | 'day' | 'month'>('week')
  const [from, setFrom] = useState('2026-10-01')
  const [to, setTo] = useState('2026-10-31')
  const [fSquad, setFSquad] = useState('')
  const [fClient, setFClient] = useState('')
  const [fProp, setFProp] = useState('')
  const [fType, setFType] = useState('')
  const [data, setData] = useState<any>(null)
  const [opts, setOpts] = useState<any>({ clients: [], properties: [], types: [], squads: [] })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDebug, setShowDebug] = useState(true)

  const load = async () => {
    setLoading(true); setErr('')
    try {
      const q = new URLSearchParams({ action: 'scorecard', from, to, gran })
      if (fSquad) q.set('squad', fSquad); if (fClient) q.set('client', fClient); if (fProp) q.set('property', fProp); if (fType) q.set('type', fType)
      const r = await fetch(`/api/getDashboard?${q}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setData(j); if (j.options) setOpts(j.options)
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { if (from && to && from <= to) load() }, [from, to, gran, fSquad, fClient, fProp, fType])

  const quick = (k: string) => {
    const t = todayStr(); const first = t.slice(0, 8) + '01'
    if (k === 'oct') { setFrom('2026-10-01'); setTo('2026-10-31'); setGran('week') }
    else if (k === 'mtd') { setFrom(first); setTo(t); setGran('week') }
    else if (k === 'last') { const d = new Date(first + 'T12:00:00'); d.setDate(0); setTo(iso(d)); d.setDate(1); setFrom(iso(d)); setGran('week') }
    else if (k === '8w') { setFrom(addDays(t, -55)); setTo(t); setGran('week') }
    else if (k === '30d') { setFrom(addDays(t, -29)); setTo(t); setGran('day') }
    else if (k === '6m') { setFrom(addDays(t, -182)); setTo(t); setGran('month') }
  }

  const color = (m: M, v: number | null) => {
    const s = data?.suggested?.[m.key]
    if (v === null || !s || s.median === null) return C.ink
    return (m.dir === 'up' ? v >= s.median : v <= s.median) ? C.green : C.red
  }
  const GR: [typeof gran, string][] = [['week', 'Semanas'], ['day', 'Días'], ['month', 'Meses']]
  const cols: any[] = data?.weeks || []

  return (
    <div style={{ padding: 0, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', border: `1.5px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {GR.map(([k, t]) => <button key={k} onClick={() => setGran(k)} style={{ padding: '0 14px', height: 35, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: gran === k ? C.primary : C.white, color: gran === k ? 'white' : C.slate }}>{t}</button>)}
        </div>
        <input type="date" value={from} onChange={e => e.target.value && setFrom(e.target.value)} style={sel} />
        <span style={{ color: C.muted }}>—</span>
        <input type="date" value={to} onChange={e => e.target.value && setTo(e.target.value)} style={sel} />
        <select defaultValue="" onChange={e => { if (e.target.value) quick(e.target.value); e.target.value = '' }} style={sel}>
          <option value="">Rango rápido…</option><option value="oct">Octubre 2026</option><option value="mtd">Este mes</option><option value="last">Mes pasado</option><option value="8w">Últimas 8 semanas</option><option value="30d">Últimos 30 días (por día)</option><option value="6m">Últimos 6 meses</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={fSquad} onChange={e => setFSquad(e.target.value)} style={sel}><option value="">Squad: todos</option>{(opts.squads || []).map((x: any) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
        <select value={fClient} onChange={e => setFClient(e.target.value)} style={sel}><option value="">Cliente: todos</option>{opts.clients.map((x: string) => <option key={x} value={x}>{x}</option>)}</select>
        <select value={fProp} onChange={e => setFProp(e.target.value)} style={sel}><option value="">Casa: todas</option>{opts.properties.map((x: string) => <option key={x} value={x}>{x}</option>)}</select>
        <select value={fType} onChange={e => setFType(e.target.value)} style={sel}><option value="">Servicio: todos</option>{opts.types.map((x: string) => <option key={x} value={x}>{x}</option>)}</select>
        {(fSquad || fClient || fProp || fType) && <button onClick={() => { setFSquad(''); setFClient(''); setFProp(''); setFType('') }} style={{ ...sel, cursor: 'pointer', color: C.muted }}>× Limpiar</button>}
        <button onClick={load} style={{ ...sel, cursor: 'pointer' }}>Recargar</button>
      </div>

      {loading && <p style={{ color: C.muted, fontSize: 13 }}>Calculando con datos reales de Airtable… (puede tardar unos segundos)</p>}
      {err && <p style={{ color: C.red, fontSize: 13 }}>Error: {err}</p>}

      {data && (
        <>
          <div style={{ overflowX: 'auto', background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, opacity: loading ? .5 : 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr style={{ background: C.bg, color: C.slate }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', position: 'sticky', left: 0, background: C.bg, minWidth: 150 }}>Medida</th>
                  {cols.map(w => <th key={w.start} style={{ padding: '10px 8px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: 12, opacity: w.future ? .4 : 1 }}>{w.label}{w.partial ? '*' : ''}</th>)}
                  <th style={{ padding: '10px 8px', textAlign: 'right', color: C.ink }}>Periodo</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Meta sugerida</th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map(m => {
                  const s = data.suggested?.[m.key]
                  return (
                    <tr key={m.key} style={{ borderTop: `1px solid ${C.border}`, background: m.lead ? '#EEF2FF' : undefined }}>
                      <td style={{ padding: '9px 12px', position: 'sticky', left: 0, background: m.lead ? '#EEF2FF' : C.white }} title={m.hint}>
                        <div style={{ fontWeight: 600, color: C.ink }}>{m.label}</div>
                        <div style={{ fontSize: 10.5, color: C.muted, maxWidth: 200 }}>{m.hint}</div>
                      </td>
                      {cols.map((w, i) => {
                        const prev = i > 0 ? cols[i - 1][m.key] : null
                        return <td key={w.start} title={i > 0 ? `Anterior (${cols[i - 1].label}): ${fmt(prev, m.unit)}` : ''} style={{ textAlign: 'right', padding: '9px 8px', color: w.future ? C.muted : color(m, w[m.key]) }}>{w.future ? '' : fmt(w[m.key], m.unit)}</td>
                      })}
                      <td style={{ textAlign: 'right', padding: '9px 8px', fontWeight: 700 }}>{fmt(data.total[m.key], m.unit)}</td>
                      <td style={{ textAlign: 'right', padding: '9px 8px', color: C.slate, whiteSpace: 'nowrap' }} title={s ? `rango ${fmt(s.min, m.unit)}–${fmt(s.max, m.unit)} · ${s.weeks} periodos` : ''}>
                        {s?.median != null ? fmt(s.median, m.unit) : '--'}
                        {m.key === 'revHH' && <div style={{ fontSize: 10.5, color: C.muted }}>V/TO: $50</div>}
                        {m.key === 'traslado' && <div style={{ fontSize: 10.5, color: C.muted }}>V/TO: ~5 min</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>* periodo parcial (recortado al rango). Pasa el cursor sobre una celda para ver el periodo anterior. Meta sugerida = mediana de los periodos completos; verde/rojo = mejor/peor que esa mediana. Tú ajustas las metas.</p>

          {data.warnings?.length > 0 && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 12, marginTop: 10, fontSize: 13, color: C.amber }}>
              {data.warnings.map((w: string, i: number) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}
          <button onClick={() => setShowDebug(!showDebug)} style={{ marginTop: 12, fontSize: 12, color: C.slate, background: 'none', border: 'none', cursor: 'pointer' }}>{showDebug ? '▾' : '▸'} Debug</button>
          {showDebug && (
            <pre style={{ background: C.ink, color: '#E2E8F0', padding: 12, borderRadius: 10, fontSize: 12, overflowX: 'auto' }}>
{JSON.stringify({ debug: data.debug, periodo: { limpiezas: data.total.limpiezas, terminadas: data.total.terminadas, conTiempo: data.total.conTiempo, cleaners: data.total.cleaners, hhFact: data.total.hhFact, capacidadH: data.total.capacidadH, turnoH: data.total.turnoH, nTraslados: data.total.nTraslados, conHora: data.total.conHora, retBase: data.total.retBase } }, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  )
}
