import { useState } from 'react'
import { C, Card, Tile, Seg, Delta, Err, Loading, btn, selStyle, money, money1, pctS, todayET, mondayOf, addDays, addMonths, monthStart, monthEnd, weekLabel, fmtDow, useApi, useIsMobile } from './shared'

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function MarginChart({ days, prevDays, isMonth }: { days: any[]; prevDays: any[]; isMonth: boolean }) {
  const W = 1000, H = 280, L = 52, R = 56, T = 18, B = 34
  const pw = W - L - R, ph = H - T - B, n = Math.max(days.length, 1)
  const cum = (a: any[]) => { let s = 0; return a.map(d => (s += d.margen)) }
  const cur = cum(days), prv = cum(prevDays)
  const maxBar = Math.max(100, ...days.map(d => d.margen), ...prevDays.map(d => d.margen))
  const maxCum = Math.max(100, cur[cur.length - 1] || 0, prv[prv.length - 1] || 0)
  const barMax = Math.ceil(maxBar / 100) * 100 * 1.1
  const cumMax = maxCum * 1.1
  const X = (i: number) => L + pw * (i + 0.5) / n
  const Y = (v: number) => T + ph * (1 - Math.max(v, 0) / barMax)
  const YC = (v: number) => T + ph * (1 - v / cumMax)
  const bw = Math.min(46, pw / n * 0.62)
  const minIdx = days.reduce((m, d, i) => (d.limpiezas > 0 && (m < 0 || d.margen < days[m].margen) ? i : m), -1)
  const line = (a: number[]) => a.map((v, i) => `${X(i).toFixed(1)},${YC(v).toFixed(1)}`).join(' ')
  const labelEvery = n > 14 ? Math.ceil(n / 14) : 1
  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
    {[0, 1, 2, 3, 4].map(g => { const v = barMax * g / 4; return <g key={g}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#EEF2F7" /><text x={L - 6} y={Y(v) + 3} fontSize="10" fill="#94A3B8" textAnchor="end">${Math.round(v).toLocaleString('en-US')}</text><text x={W - R + 6} y={Y(v) + 3} fontSize="10" fill="#6366F1">${(cumMax * g / 4 / 1000).toFixed(1)}k</text></g> })}
    {days.map((d, i) => <g key={d.date}>
      <rect x={X(i) - bw / 2} y={Y(d.margen)} width={bw} height={Math.max(0, Y(0) - Y(d.margen))} rx="5" fill={i === minIdx ? '#F59E0B' : '#10B981'} opacity={d.limpiezas ? 1 : 0.25} />
      {n <= 14 && d.limpiezas > 0 && <text x={X(i)} y={Y(d.margen) - 6} fontSize="11" fontWeight="700" textAnchor="middle" fill="#0F172A">{money(d.margen)}</text>}
      {i % labelEvery === 0 && <text x={X(i)} y={H - 12} fontSize="11" fill="#475569" textAnchor="middle">{isMonth ? Number(d.date.slice(8)) : `${DOW[i]} ${Number(d.date.slice(8))}`}</text>}
    </g>)}
    {prv.length > 0 && <polyline points={line(prv.slice(0, n))} fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeDasharray="6 5" />}
    <polyline points={line(cur)} fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinejoin="round" />
    {cur.map((v, i) => <circle key={i} cx={X(i)} cy={YC(v)} r={n > 14 ? 2.5 : 4} fill="#fff" stroke="#6366F1" strokeWidth="2" />)}
    {cur.length > 0 && <text x={X(cur.length - 1) + 30} y={YC(cur[cur.length - 1]) - 10} fontSize="11" fontWeight="700" fill="#4F46E5" textAnchor="end">{money(cur[cur.length - 1])}</text>}
  </svg>
}

export default function MarginTab({ onDebug }: { onDebug: (d: any) => void }) {
  const mobile = useIsMobile()
  const [mode, setMode] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(todayET())
  const [client, setClient] = useState('')
  const [property, setProperty] = useState('')
  const from = mode === 'week' ? mondayOf(anchor) : monthStart(anchor)
  const to = mode === 'week' ? addDays(from, 6) : monthEnd(anchor)
  const { data, loading, err } = useApi('margin', { from, to, client, property }, [from, to, client, property], onDebug)
  const t = data?.total, p = data?.prevTotal
  const prevName = mode === 'week' ? 'sem. pasada' : 'mes pasado'
  const step = (n: number) => setAnchor(mode === 'week' ? addDays(from, 7 * n) : addMonths(from, n))
  const title = mode === 'week' ? weekLabel(from) : new Date(from + 'T12:00:00Z').toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return <div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
      <Seg items={[['week', 'Semana'], ['month', 'Mes']]} value={mode} onChange={v => setMode(v as any)} />
      <button style={btn()} onClick={() => step(-1)}>‹</button>
      <div style={{ ...btn(true), display: 'flex', alignItems: 'center', textTransform: 'capitalize' }}>{title}</div>
      <button style={btn()} onClick={() => step(1)}>›</button>
      <button style={btn()} onClick={() => setAnchor(todayET())}>Hoy</button>
      <select value={client} onChange={e => setClient(e.target.value)} style={selStyle}><option value="">Cliente: todos</option>{(data?.options?.clients || []).map((c: string) => <option key={c}>{c}</option>)}</select>
      <select value={property} onChange={e => setProperty(e.target.value)} style={selStyle}><option value="">Casa: todas</option>{(data?.options?.properties || []).map((c: string) => <option key={c}>{c}</option>)}</select>
    </div>
    <Err msg={err} /><Loading on={loading} />
    {t && p && <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <Tile label="Margen" value={money(t.margen)} color={t.margen >= 0 ? C.green : C.red} sub="Cobrado − pagado a cleaners"><Delta cur={t.margen} prev={p.margen} suffix={'vs ' + prevName} /></Tile>
        <Tile label="Margen %" value={pctS(t.mgPct)} sub="del cobrado"><Delta cur={t.mgPct} prev={p.mgPct} kind="pct" /></Tile>
        <Tile label="Cobrado" value={money(t.cobrado)} sub="limpiezas terminadas"><Delta cur={t.cobrado} prev={p.cobrado} /></Tile>
        <Tile label="Pagado a cleaners" value={money(t.costo)} sub={data.filtered ? 'horas limpiando × costo (est.)' : 'turnos × costo'}><Delta cur={t.costo} prev={p.costo} good="down" /></Tile>
        <Tile label="Limpiezas" value={String(t.limpiezas)} sub="terminadas"><Delta cur={t.limpiezas} prev={p.limpiezas} kind="num" /></Tile>
        <Tile label="Horas de trabajo" value={`${Math.round(t.horas)} h`} color={C.primaryDark} sub={`Margen/HH ${money1(t.mgHH)}`}><Delta cur={t.horas} prev={p.horas} kind="h" /></Tile>
      </div>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <b style={{ fontSize: 14 }}>Margen por día y acumulado</b>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748B' }}>
            <Dot c="#10B981" /> Margen del día &nbsp;<Dot c="#6366F1" /> Acumulado &nbsp;<Dot c="#CBD5E1" /> Acumulado {prevName}
          </span>
        </div>
        <MarginChart days={data.days} prevDays={data.prevDays} isMonth={data.isMonth} />
      </Card>
      <Card>
        <b style={{ fontSize: 14 }}>Detalle por día</b>
        <div style={{ overflowX: 'auto', marginTop: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: mobile ? 460 : 0 }}>
            <thead><tr>{['Día', 'Cobrado', 'Pagado', 'Margen', '%', 'Limp.', 'Costo'].map(h => <th key={h} style={{ textAlign: 'left', fontSize: 10, color: C.muted, letterSpacing: '.04em', padding: 8, background: C.bg, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>
              {data.days.map((d: any) => <tr key={d.date} style={{ borderTop: '1px solid #F1F5F9', opacity: d.limpiezas || d.costo ? 1 : 0.45 }}>
                <td style={{ padding: 8, fontWeight: 700, textTransform: 'capitalize' }}>{fmtDow(d.date)}</td><td style={{ padding: 8 }}>{money(d.cobrado)}</td><td style={{ padding: 8 }}>{money(d.costo)}</td>
                <td style={{ padding: 8, fontWeight: 700, color: d.margen >= 0 ? C.green : C.red }}>{money(d.margen)}</td><td style={{ padding: 8 }}>{d.cobrado > 0 ? pctS(d.margen / d.cobrado * 100) : '—'}</td><td style={{ padding: 8 }}>{d.limpiezas}</td>
                <td style={{ padding: 8, color: C.muted }}>{d.fuente}</td></tr>)}
              <tr style={{ background: C.bg, fontWeight: 700 }}><td style={{ padding: 8 }}>Total</td><td style={{ padding: 8 }}>{money(t.cobrado)}</td><td style={{ padding: 8 }}>{money(t.costo)}</td><td style={{ padding: 8, color: C.green }}>{money(t.margen)}</td><td style={{ padding: 8 }}>{pctS(t.mgPct)}</td><td style={{ padding: 8 }}>{t.limpiezas}</td><td /></tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Costo «turnos» = horas de turno pagadas × Cost/Hour. «est.» = horas limpiando × Cost/Hour de los asignados (días sin turnos o con filtros).</p>
      </Card>
    </>}
  </div>
}
const Dot = ({ c }: { c: string }) => <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, marginRight: 4 }} />
