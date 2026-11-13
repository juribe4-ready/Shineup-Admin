import { useState } from 'react'
import { C, Card, Seg, Err, Loading, btn, selStyle, money, money1, pctS, todayET, mondayOf, addDays, addMonths, monthStart, monthEnd, weekLabel, fmtDow, fmtShort, useApi, useIsMobile } from './shared'

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const sumK = (a: any[], k: string, n: number) => a.slice(0, n).reduce((t, d) => t + (d[k] || 0), 0)
const kfmt = (v: number) => Math.abs(v) >= 1000 ? (v < 0 ? '−' : '') + '$' + (Math.abs(v) / 1000).toFixed(1) + 'k' : money(v)
const cumul = (a: number[]) => { let s = 0; return a.map(v => (s += v)) }

export function Spark({ cur, prev, proj, k, good = true }: { cur: number[]; prev: number[]; proj?: number[]; k: number; good?: boolean }) {
  const W = 160, H = 38, n = Math.max(cur.length, prev.length, 2)
  const all = [...cur.slice(0, k), ...prev, ...(proj || [])]
  const mx = Math.max(1, ...all), mn = Math.min(0, ...all)
  const X = (i: number) => 3 + i * (W - 6) / (n - 1), Y = (v: number) => H - 4 - (v - mn) / (mx - mn || 1) * (H - 8)
  const pts = (a: number[], from = 0) => a.map((v, i) => `${X(i + from).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 38, display: 'block', marginTop: 4 }} preserveAspectRatio="none">
    <polyline points={pts(prev)} fill="none" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
    {proj && proj.length > 0 && <polyline points={pts(proj, k - 1)} fill="none" stroke="#6366F1" strokeWidth="2" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
    <polyline points={pts(cur.slice(0, k))} fill="none" stroke={good ? '#6366F1' : '#6366F1'} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
  </svg>
}

export function MarginChart({ days, prevDays, isMonth, k }: { days: any[]; prevDays: any[]; isMonth: boolean; k: number }) {
  const W = 1000, H = 300, L = 52, R = 56, T = 22, B = 34
  const pw = W - L - R, ph = H - T - B, n = Math.max(days.length, 1)
  const pj = days.map(d => d.proy?.margen || 0)
  const cum = cumul(days.map((d, i) => (i < k ? d.margen : 0))).slice(0, k)
  const prv = cumul(prevDays.map(d => d.margen))
  const startP = Math.max(0, k - 1)
  const projCum: number[] = []; { let s = cum[startP] ?? 0; for (let i = startP; i < n; i++) { s += pj[i]; projCum.push(s) } }
  const hasProj = pj.some((_v, i) => i >= startP && days[i].proy)
  const barMax0 = Math.max(100, ...days.map((d, i) => d.margen + Math.max(0, pj[i])), ...prevDays.map(d => d.margen)) * 1.12
  const barNeg0 = Math.max(0, ...days.map(d => -d.margen))
  const cumMax0 = Math.max(100, ...cum, ...prv, ...projCum) * 1.1
  const cumNeg0 = Math.max(0, ...cum.map(v => -v), ...prv.map(v => -v))
  const f = Math.max(barNeg0 / (barMax0 + barNeg0), cumNeg0 / (cumMax0 + cumNeg0))
  const barNeg = f > 0 ? f * barMax0 / (1 - f) : 0, cumNeg = f > 0 ? f * cumMax0 / (1 - f) : 0
  const Yb = (v: number) => T + ph * (1 - (v + barNeg) / (barMax0 + barNeg))
  const Yc = (v: number) => T + ph * (1 - (v + cumNeg) / (cumMax0 + cumNeg))
  const X = (i: number) => L + pw * (i + 0.5) / n, bw = Math.min(46, pw / n * 0.62), z = Yb(0)
  const line = (a: number[], from = 0) => a.map((v, i) => `${X(i + from).toFixed(1)},${Yc(v).toFixed(1)}`).join(' ')
  const every = n > 16 ? Math.ceil(n / 16) : 1
  const ticks = [0, 1, 2, 3, 4].map(g => -barNeg + (barMax0 + barNeg) * g / 4)
  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
    {ticks.map((v, g) => <g key={g}><line x1={L} x2={W - R} y1={Yb(v)} y2={Yb(v)} stroke="#EEF2F7" /><text x={L - 6} y={Yb(v) + 3} fontSize="10" fill="#94A3B8" textAnchor="end">{money(v)}</text>
      <text x={W - R + 6} y={Yc(v * (cumMax0 + cumNeg) / (barMax0 + barNeg)) + 3} fontSize="10" fill="#6366F1">{kfmt(v * (cumMax0 + cumNeg) / (barMax0 + barNeg))}</text></g>)}
    <line x1={L} x2={W - R} y1={z} y2={z} stroke="#94A3B8" />
    {days.map((d, i) => {
      const fut = i >= k, v = d.margen, p = pj[i]
      return <g key={d.date}>
        {!fut && <rect x={X(i) - bw / 2} y={v >= 0 ? Yb(v) : z} width={bw} height={Math.abs(Yb(v) - z)} rx="4" fill={v < 0 ? '#EF4444' : '#10B981'} />}
        {d.proy && <rect x={X(i) - bw / 2} y={Yb(Math.max(0, fut ? 0 : v) + Math.max(0, p))} width={bw} height={Math.max(0, z - Yb(Math.max(0, p)))} rx="4" fill="#A7F3D0" fillOpacity="0.6" stroke="#10B981" strokeDasharray="4 3" />}
        {!fut && d.limpiezas > 0 && n <= 14 && <text x={X(i)} y={v >= 0 ? Yb(v) - 6 : z + 13} fontSize="11" fontWeight="700" textAnchor="middle" fill={v < 0 ? '#fff' : '#0F172A'}>{money(v)}</text>}
        {d.proy && n <= 14 && <text x={X(i)} y={Yb(Math.max(0, fut ? 0 : v) + Math.max(0, p)) - 5} fontSize="10.5" fontWeight="700" textAnchor="middle" fill="#047857">+{money(p)}*</text>}
        {i % every === 0 && <text x={X(i)} y={H - 12} fontSize="11" fill={fut ? '#94A3B8' : '#475569'} textAnchor="middle">{isMonth ? Number(d.date.slice(8)) : `${DOW[i]} ${Number(d.date.slice(8))}`}</text>}
      </g>
    })}
    {prv.length > 0 && <polyline points={line(prv.slice(0, n))} fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeDasharray="6 5" />}
    {hasProj && <polyline points={line(projCum, startP)} fill="none" stroke="#6366F1" strokeWidth="2.5" strokeDasharray="2 4" />}
    <polyline points={line(cum)} fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinejoin="round" />
    {cum.map((v, i) => <circle key={i} cx={X(i)} cy={Yc(v)} r={n > 14 ? 2.5 : 4} fill="#fff" stroke="#6366F1" strokeWidth="2" />)}
    {hasProj && projCum.length > 0 && <text x={X(n - 1) - 6} y={Yc(projCum[projCum.length - 1]) - 10} fontSize="11" fontWeight="700" fill="#4F46E5" textAnchor="end">≈ {money(projCum[projCum.length - 1])}</text>}
  </svg>
}

export default function MarginTab({ onDebug, onGoDay }: { onDebug: (d: any) => void; onGoDay: (a: { from: string; to: string; property?: string; client?: string }) => void }) {
  const mobile = useIsMobile()
  const [mode, setMode] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(todayET())
  const [client, setClient] = useState('')
  const [property, setProperty] = useState('')
  const from = mode === 'week' ? mondayOf(anchor) : monthStart(anchor)
  const to = mode === 'week' ? addDays(from, 6) : monthEnd(anchor)
  const { data, loading, err } = useApi('margin', { from, to, client, property }, [from, to, client, property], onDebug)
  const days: any[] = data?.days || [], pdays: any[] = data?.prevDays || []
  const today = data?.today || todayET()
  const k = !data ? 0 : today > to ? days.length : today < from ? 0 : days.findIndex((d: any) => d.date === today) + 1
  const isNow = !!data && k > 0 && k < days.length
  const prevName = mode === 'week' ? 'sem. pasada' : 'mes pasado'
  const step = (n: number) => setAnchor(mode === 'week' ? addDays(from, 7 * n) : addMonths(from, n))
  const title = mode === 'week' ? weekLabel(from) : new Date(from + 'T12:00:00Z').toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const sfx = isNow ? ' a la fecha' : ''

  let cards: React.ReactNode = null, summary: React.ReactNode = null
  if (data && k > 0) {
    const ing = sumK(days, 'cobrado', k), lab = sumK(days, 'costo', k), mg = ing - lab, hh = sumK(days, 'hh', k), hrs = sumK(days, 'horas', k), lim = sumK(days, 'limpiezas', k)
    const pIng = sumK(pdays, 'cobrado', k), pLab = sumK(pdays, 'costo', k), pMg = pIng - pLab, pHrs = sumK(pdays, 'horas', k), pLim = sumK(pdays, 'limpiezas', k)
    const mgPct = ing > 0 ? mg / ing * 100 : null, pPct = pIng > 0 ? pMg / pIng * 100 : null
    const cI = cumul(days.map(d => d.cobrado)), cL = cumul(days.map(d => d.costo)), cM = cumul(days.map(d => d.margen)), cN = cumul(days.map(d => d.limpiezas)), cH = cumul(days.map(d => d.horas))
    const pI = cumul(pdays.map(d => d.cobrado)), pL = cumul(pdays.map(d => d.costo)), pM = cumul(pdays.map(d => d.margen)), pN = cumul(pdays.map(d => d.limpiezas)), pH = cumul(pdays.map(d => d.horas))
    const proj = (key: 'cobrado' | 'costo' | 'margen' | 'limpiezas', base: number[]) => { const s0 = base[k - 1] || 0; let s = s0; const out: number[] = []; for (let i = k - 1; i < days.length; i++) { s += days[i].proy?.[key] || 0; out.push(s) } return out.some((v, i) => i > 0 && v !== out[0]) || out[0] !== s0 ? out : [] }
    const rng = isNow ? `${fmtShort(days[0].date)} – ${fmtShort(days[k - 1].date)}` : ''
    const T = (label: string, v: string, sub: string, d: React.ReactNode, sp: React.ReactNode, color?: string) => <div style={{ flex: '1 1 170px', minWidth: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, color: '#64748B' }}>{label}{sfx}</div><div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', color: color || C.ink, lineHeight: 1.25 }}>{v}</div><div style={{ fontSize: 11, color: C.muted }}>{sub}</div>{d}{sp}</div>
    const dl = (cur: number, prev: number, good: 'up' | 'down', kind: 'money' | 'num' | 'h' | 'pct' = 'money') => { const dd = cur - prev; if (Math.abs(dd) < 0.005) return <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginTop: 3 }}>= igual que {prevName}</div>; const ok = good === 'up' ? dd > 0 : dd < 0
      const f = kind === 'money' ? money(Math.abs(dd)) : kind === 'h' ? Math.abs(Math.round(dd * 10) / 10) + ' h' : kind === 'pct' ? Math.abs(Math.round(dd)) + ' pts' : String(Math.abs(Math.round(dd)))
      return <div style={{ fontSize: 11, color: ok ? C.green : C.red, fontWeight: 700, marginTop: 3 }}>{dd > 0 ? '▲ +' : '▼ −'}{f} vs {prevName}{isNow ? ' (mismos días)' : ''}</div> }
    const pjI = proj('cobrado', cI), pjL = proj('costo', cL), pjM = proj('margen', cM), pjN = proj('limpiezas', cN)
    cards = <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
      {T('Ingresos', money(ing), data.filtered ? 'limpiezas terminadas' : 'limpiezas terminadas', dl(ing, pIng, 'up'), <Spark cur={cI} prev={pI} proj={pjI} k={k} />)}
      {T('Labor', money(lab), data.filtered ? 'horas limpiando × costo (est.)' : 'turnos × costo/hora', dl(lab, pLab, 'down'), <Spark cur={cL} prev={pL} proj={pjL} k={k} />)}
      {T('Margen', money(mg), `${pctS(mgPct)} de los ingresos`, <>{dl(mg, pMg, 'up')}</>, <Spark cur={cM} prev={pM} proj={pjM} k={k} />, mg >= 0 ? C.green : C.red)}
      {T('Margen %', pctS(mgPct), `Margen/HH ${money1(hh > 0 ? mg / hh : null)}`, pPct === null || mgPct === null ? null : dl(mgPct, pPct, 'up', 'pct'), null)}
      {T('Limpiezas', String(lim), isNow ? `${days.slice(k).reduce((t, d) => t + (d.proy?.limpiezas || 0), 0) + (days[k - 1]?.proy?.limpiezas || 0)} por hacer` : 'terminadas', dl(lim, pLim, 'up', 'num'), <Spark cur={cN} prev={pN} proj={pjN} k={k} />)}
      {T('Horas de trabajo', `${Math.round(hrs)} h`, rng, dl(hrs, pHrs, 'down', 'h'), <Spark cur={cH} prev={pH} k={k} />, C.primaryDark)}
    </div>
    const est = pjM.length ? pjM[pjM.length - 1] : null
    const ritmo = mode === 'month' && isNow ? mg / k * days.length : null
    const prevFull = pM[pM.length - 1]
    summary = <div style={{ fontSize: 12, color: C.slate, margin: '4px 0 12px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      <span><i style={{ display: 'inline-block', width: 14, borderTop: '2.5px solid #6366F1', marginRight: 5, verticalAlign: 'middle' }} />{isNow ? 'a hoy' : 'periodo'}</span>
      {pjM.length > 0 && <span><i style={{ display: 'inline-block', width: 14, borderTop: '2.5px dotted #6366F1', marginRight: 5, verticalAlign: 'middle' }} />proyección con lo ya agendado</span>}
      <span><i style={{ display: 'inline-block', width: 14, borderTop: '2.5px dashed #CBD5E1', marginRight: 5, verticalAlign: 'middle' }} />{prevName} completa</span>
      {isNow && est !== null && <b style={{ color: C.primaryDark }}>Cierre estimado (agendado): {money(est)} · {prevName} cerró {money(prevFull)}</b>}
      {ritmo !== null && <b style={{ color: C.slate }}>A este ritmo: {money(ritmo)}</b>}
    </div>
  }

  return <div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
      <Seg items={[['week', 'Semana'], ['month', 'Mes']]} value={mode} onChange={v => setMode(v as any)} />
      <button style={btn()} onClick={() => step(-1)}>‹</button>
      <div style={{ ...btn(true), display: 'flex', alignItems: 'center' }}>{title.charAt(0).toUpperCase() + title.slice(1)}</div>
      <button style={btn()} onClick={() => step(1)}>›</button>
      <button style={btn()} onClick={() => setAnchor(todayET())}>Hoy</button>
      <select value={client} onChange={e => setClient(e.target.value)} style={selStyle}><option value="">Cliente: todos</option>{(data?.options?.clients || []).map((c: string) => <option key={c}>{c}</option>)}</select>
      <select value={property} onChange={e => setProperty(e.target.value)} style={selStyle}><option value="">Casa: todas</option>{(data?.options?.properties || []).map((c: string) => <option key={c}>{c}</option>)}</select>
    </div>
    <Err msg={err} /><Loading on={loading} />
    {data && <>
      {isNow && <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Comparado con los mismos {k} días de {mode === 'week' ? 'la semana pasada' : 'el mes pasado'} ({fmtShort(pdays[0]?.date)} – {fmtShort(pdays[k - 1]?.date)}).</div>}
      {cards}{summary}
      <Card style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 14 }}>Margen por día y acumulado{isNow ? ' · con proyección' : ''}</b>
        <MarginChart days={days} prevDays={pdays} isMonth={data.isMonth} k={k} />
        {days.some(d => d.proy) && <div style={{ fontSize: 11.5, color: C.amber, background: C.amberBg, borderRadius: 8, padding: '6px 10px', marginTop: 6 }}>* Proyectado = limpiezas ya agendadas (ingreso programado − labor estimado con {data.avgDur?.toFixed(1)} h promedio por limpieza). Lo que aún no está agendado no cuenta.</div>}
      </Card>
      <Card>
        <b style={{ fontSize: 14 }}>Detalle por día</b> <span style={{ fontSize: 12, color: C.muted }}>· toca un día para ver sus casas</span>
        <div style={{ overflowX: 'auto', marginTop: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: mobile ? 520 : 0 }}>
            <thead><tr>{['Día', 'Ingresos', 'Labor', 'Margen', 'Mg %', 'Limp.', 'Labor según', ''].map(h => <th key={h} style={{ textAlign: 'left', fontSize: 10, color: C.muted, letterSpacing: '.04em', padding: 8, background: C.bg, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>
              {days.map((d, i) => { const onlyProj = !d.limpiezas && !!d.proy && i >= 0; const neg = d.margen < 0
                return <tr key={d.date} onClick={() => onGoDay({ from: d.date, to: d.date, property, client })} style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer', background: neg ? '#FEF2F2' : onlyProj ? '#F0FDF4' : 'transparent', opacity: d.limpiezas || d.costo || d.proy ? 1 : 0.45 }}>
                  <td style={{ padding: 8, fontWeight: 700, textTransform: 'capitalize' }}>{fmtDow(d.date)}{d.date === today && <span style={{ color: C.primary }}> · hoy</span>}{onlyProj && <span style={{ color: C.muted, fontWeight: 400 }}> agendado</span>}</td>
                  <td style={{ padding: 8 }}>{onlyProj ? money(d.proy.cobrado) + '*' : money(d.cobrado)}</td><td style={{ padding: 8 }}>{onlyProj ? money(d.proy.costo) + '*' : money(d.costo)}</td>
                  <td style={{ padding: 8, fontWeight: 700, color: onlyProj ? C.green : d.margen >= 0 ? C.green : C.red }}>{onlyProj ? money(d.proy.margen) + '*' : money(d.margen)}</td>
                  <td style={{ padding: 8 }}>{onlyProj ? (d.proy.cobrado > 0 ? pctS(d.proy.margen / d.proy.cobrado * 100) : '—') : d.cobrado > 0 ? pctS(d.margen / d.cobrado * 100) : '—'}</td>
                  <td style={{ padding: 8 }}>{onlyProj ? d.proy.limpiezas : d.limpiezas}</td><td style={{ padding: 8, color: C.muted }}>{onlyProj ? 'est.' : d.fuente}</td>
                  <td style={{ padding: 8, color: C.primary, fontWeight: 700, whiteSpace: 'nowrap' }}>Ver casas ›</td></tr> })}
              {data.total && <tr style={{ background: C.bg, fontWeight: 700 }}><td style={{ padding: 8 }}>Total</td><td style={{ padding: 8 }}>{money(data.total.cobrado)}</td><td style={{ padding: 8 }}>{money(data.total.costo)}</td><td style={{ padding: 8, color: data.total.margen >= 0 ? C.green : C.red }}>{money(data.total.margen)}</td><td style={{ padding: 8 }}>{pctS(data.total.mgPct)}</td><td style={{ padding: 8 }}>{data.total.limpiezas}</td><td colSpan={2} /></tr>}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Labor «turnos» = horas de turno pagadas × costo/hora. «est.» = horas limpiando × costo/hora de los asignados (días sin turnos o con filtros). Fila roja = el labor fue mayor que los ingresos ese día.</p>
      </Card>
    </>}
  </div>
}
