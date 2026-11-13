import { useState } from 'react'
import { C, Card, Seg, Err, Loading, btn, selStyle, money, money1, pctS, todayET, mondayOf, addDays, addMonths, monthStart, monthEnd, weekLabel, fmtDow, fmtShort, useApi, useIsMobile } from './shared'

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const sumK = (a: any[], k: string, n: number) => a.slice(0, n).reduce((t, d) => t + (d[k] || 0), 0)
export const kM = (v: number) => { const a = Math.abs(v), sg = v < 0 ? '−' : ''; return a >= 1e6 ? sg + '$' + (a / 1e6).toFixed(1) + 'M' : a >= 1000 ? sg + '$' + (a / 1000).toFixed(1) + 'k' : sg + '$' + Math.round(a) }
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


function CumChart({ days, prevDays, k, isMonth, prevName, mob }: { days: any[]; prevDays: any[]; k: number; isMonth: boolean; prevName: string; mob?: boolean }) {
  const W = mob ? 520 : 1000, H = mob ? 260 : 250, L = 50, R = mob ? 120 : 170, T = 16, B = 30
  const pw = W - L - R, ph = H - T - B, n = Math.max(days.length, 1)
  const cum = cumul(days.map((d, i) => (i < k ? d.margen : 0))).slice(0, k)
  const prv = cumul(prevDays.map(d => d.margen))
  const sp = Math.max(0, k - 1)
  const proj: number[] = []; { let s = cum[sp] ?? 0; for (let i = sp; i < n; i++) { s += days[i].proy?.margen || 0; proj.push(s) } }
  const hasProj = days.some((d, i) => i >= sp && d.proy)
  const all = [...cum, ...prv, ...(hasProj ? proj : []), 0]
  const mx = Math.max(100, ...all) * 1.08, mn = Math.min(0, ...all) * 1.08
  const X = (i: number) => L + pw * (i + 0.5) / n, Y = (v: number) => T + ph * (1 - (v - mn) / (mx - mn))
  const pts = (a: number[], from = 0) => a.map((v, i) => `${X(i + from).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const every = n > (mob ? 8 : 16) ? Math.ceil(n / (mob ? 8 : 16)) : 1
  const labels: { y: number; t: string; c: string; b?: boolean }[] = []
  if (prv.length) labels.push({ y: Y(prv[Math.min(prv.length, n) - 1]), t: mob ? `Pasada ${kM(prv[prv.length - 1])}` : `${prevName} cerró ${kM(prv[prv.length - 1])}`, c: '#64748B' })
  if (hasProj) labels.push({ y: Y(proj[proj.length - 1]), t: mob ? `Proy. ${kM(proj[proj.length - 1])}` : `Proyección ${kM(proj[proj.length - 1])}`, c: '#4F46E5', b: true })
  if (cum.length) labels.push({ y: Y(cum[cum.length - 1]), t: `Hoy ${kM(cum[cum.length - 1])}`, c: '#4F46E5', b: true })
  labels.sort((a, b) => a.y - b.y); for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 15) labels[i].y = labels[i - 1].y + 15
  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
    {[0, 1, 2, 3].map(g => { const v = mn + (mx - mn) * g / 3; return <g key={g}><line x1={L} x2={L + pw} y1={Y(v)} y2={Y(v)} stroke="#EEF2F7" /><text x={L - 8} y={Y(v) + 3} fontSize="11" fill="#94A3B8" textAnchor="end">{kM(v)}</text></g> })}
    {mn < 0 && <line x1={L} x2={L + pw} y1={Y(0)} y2={Y(0)} stroke="#94A3B8" />}
    {days.map((d, i) => i % every === 0 && <text key={d.date} x={X(i)} y={H - 8} fontSize="11" fill={i >= k ? '#94A3B8' : '#475569'} textAnchor="middle">{isMonth ? Number(d.date.slice(8)) : `${DOW[i]} ${Number(d.date.slice(8))}`}</text>)}
    {prv.length > 0 && <polyline points={pts(prv.slice(0, n))} fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeDasharray="7 5" />}
    {hasProj && <polyline points={pts(proj, sp)} fill="none" stroke="#6366F1" strokeWidth="2.5" strokeDasharray="2 5" strokeLinecap="round" />}
    <polyline points={pts(cum)} fill="none" stroke="#4F46E5" strokeWidth="3" strokeLinejoin="round" />
    {cum.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r={n > 14 ? 2.5 : 4} fill="#fff" stroke="#4F46E5" strokeWidth="2" />)}
    {labels.map((l, i) => <text key={i} x={L + pw + 10} y={l.y + 4} fontSize="12" fontWeight={l.b ? 700 : 500} fill={l.c}>{l.t}</text>)}
  </svg>
}

function DayBars({ days, prevDays, k, isMonth, mob }: { days: any[]; prevDays: any[]; k: number; isMonth: boolean; mob?: boolean }) {
  const W = mob ? 520 : 1000, H = 230, L = 50, R = 10, T = 22, B = 30
  const pw = W - L - R, ph = H - T - B, n = Math.max(days.length, 1)
  const pj = days.map(d => Math.max(0, d.proy?.margen || 0))
  const mx = Math.max(100, ...days.map((d, i) => Math.max(0, d.margen) + pj[i]), ...prevDays.map(d => d.margen)) * 1.12
  const mn = Math.min(0, ...days.map(d => d.margen)) * 1.15
  const X = (i: number) => L + pw * (i + 0.5) / n, Y = (v: number) => T + ph * (1 - (v - mn) / (mx - mn)), z = Y(0)
  const bw = Math.min(54, pw / n * 0.62), every = n > (mob ? 8 : 16) ? Math.ceil(n / (mob ? 8 : 16)) : 1
  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
    {[0, 1, 2, 3].map(g => { const v = mn + (mx - mn) * g / 3; return <g key={g}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#EEF2F7" /><text x={L - 8} y={Y(v) + 3} fontSize="11" fill="#94A3B8" textAnchor="end">{kM(v)}</text></g> })}
    <line x1={L} x2={W - R} y1={z} y2={z} stroke="#94A3B8" />
    {days.map((d, i) => { const fut = i >= k, v = d.margen, p = pj[i], top = Y(Math.max(0, fut ? 0 : v) + p), pv = prevDays[i]
      return <g key={d.date}>
        {!fut && <rect x={X(i) - bw / 2} y={v >= 0 ? Y(v) : z} width={bw} height={Math.abs(Y(v) - z)} rx="4" fill={v < 0 ? '#EF4444' : '#10B981'} />}
        {p > 0 && <rect x={X(i) - bw / 2} y={top} width={bw} height={Math.max(0, Y(fut ? 0 : Math.max(0, v)) - top)} rx="4" fill="#A7F3D0" fillOpacity=".55" stroke="#10B981" strokeDasharray="4 3" />}
        {pv && <line x1={X(i) - bw / 2 - 4} x2={X(i) + bw / 2 + 4} y1={Y(pv.margen)} y2={Y(pv.margen)} stroke="#475569" strokeWidth="2.5" />}
        {n <= 14 && !fut && d.limpiezas > 0 && (v < 0 ? <text x={X(i)} y={Y(v) + 14} fontSize="11" fontWeight="700" textAnchor="middle" fill="#B91C1C">{money(v)}</text> : Math.abs(Y(v) - z) >= 18 ? <text x={X(i)} y={Y(v) + 14} fontSize="11" fontWeight="700" textAnchor="middle" fill="#fff">{money(v)}</text> : p > 0 ? null : <text x={X(i)} y={Y(v) - 5} fontSize="11" fontWeight="700" textAnchor="middle" fill="#0F172A">{money(v)}</text>)}
        {n <= 14 && p > 0 && <text x={X(i)} y={top - 5} fontSize="11" fontWeight="700" textAnchor="middle" fill="#047857">+{money(p)}*</text>}
        {i % every === 0 && <text x={X(i)} y={H - 8} fontSize="11" fill={fut ? '#94A3B8' : '#475569'} textAnchor="middle">{isMonth ? Number(d.date.slice(8)) : `${DOW[i]} ${Number(d.date.slice(8))}`}</text>}
      </g> })}
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
  const pj = (key: string) => days.reduce((t, d, i) => t + (i >= Math.max(0, k - 1) ? (d.proy?.[key] || 0) : 0), 0)
  const pctD = (a: number, b: number) => b ? ` (${a - b >= 0 ? '+' : '−'}${Math.abs(Math.round((a - b) / Math.abs(b) * 100))}%)` : ''

  let cards: React.ReactNode = null
  if (data && k > 0) {
    const ing = sumK(days, 'cobrado', k), lab = sumK(days, 'costo', k), mg = ing - lab, hh = sumK(days, 'hh', k), hrs = sumK(days, 'horas', k), lim = sumK(days, 'limpiezas', k)
    const pIng = sumK(pdays, 'cobrado', k), pLab = sumK(pdays, 'costo', k), pMg = pIng - pLab, pHrs = sumK(pdays, 'horas', k), pLim = sumK(pdays, 'limpiezas', k)
    const fIng = sumK(pdays, 'cobrado', 999), fLab = sumK(pdays, 'costo', 999), fMg = fIng - fLab, fHrs = sumK(pdays, 'horas', 999), fLim = sumK(pdays, 'limpiezas', 999)
    const mgPct = ing > 0 ? mg / ing * 100 : null, pPct = pIng > 0 ? pMg / pIng * 100 : null
    const cum = (key: string, f: (n: number) => number = x => x) => cumul(days.map(d => f(d[key])))
    const cI = cum('cobrado'), cL = cum('costo'), cM = cum('margen'), cN = cum('limpiezas'), cH = cum('horas')
    const pI = cumul(pdays.map(d => d.cobrado)), pL = cumul(pdays.map(d => d.costo)), pM = cumul(pdays.map(d => d.margen)), pN = cumul(pdays.map(d => d.limpiezas)), pH = cumul(pdays.map(d => d.horas))
    const projArr = (key: string, base: number[]) => { let s = base[k - 1] || 0; const out: number[] = []; for (let i = k - 1; i < days.length; i++) { s += days[i].proy?.[key] || 0; out.push(s) } return out.length > 1 && out[out.length - 1] !== out[0] ? out : [] }
    const rng = isNow ? `${fmtShort(days[0].date)} – ${fmtShort(days[k - 1].date)}` : ''
    const prLine = (t: string) => <div style={{ fontSize: 11.5, color: C.slate, marginTop: 4 }}>{t}</div>
    const Cd = (label: string, v: string, color: string | undefined, vs: string, delta: React.ReactNode, projLine: string | null, sp: React.ReactNode) => <div style={{ flex: '1 1 190px', minWidth: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, color: '#64748B' }}>{label}{sfx}</div><div style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-.02em', color: color || C.ink, lineHeight: 1.25 }}>{v}</div>
      <div style={{ fontSize: 11.5, color: C.muted }}>{vs}</div>{delta}{projLine && prLine(projLine)}{sp}</div>
    const dl = (cur: number, prev: number, good: 'up' | 'down', kind: 'money' | 'num' | 'h' | 'pct' = 'money') => { const dd = cur - prev; if (Math.abs(dd) < 0.005) return <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, marginTop: 2 }}>= igual</div>; const ok = good === 'up' ? dd > 0 : dd < 0
      const f = kind === 'money' ? money(Math.abs(dd)) : kind === 'h' ? Math.abs(Math.round(dd * 10) / 10) + ' h' : kind === 'pct' ? Math.abs(Math.round(dd)) + ' pts' : String(Math.abs(Math.round(dd)))
      return <div style={{ fontSize: 12, color: ok ? C.green : C.red, fontWeight: 700, marginTop: 2 }}>{dd > 0 ? '▲ +' : '▼ −'}{f}{kind === 'pct' ? '' : pctD(cur, prev)}</div> }
    const cierre = (key: 'cobrado' | 'costo' | 'margen' | 'limpiezas', actual: number, full: number, fmt: (n: number) => string) => { const p = pj(key); if (!isNow || !p) return `${prevName} cerró ${fmt(full)}`; const e = actual + p; return `Proyección cierre ${fmt(e)}${pctD(e, full)} · ${prevName} cerró ${fmt(full)}` }
    cards = <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
      {Cd('Ingresos', money(ing), undefined, `${prevName} a esta fecha: ${money(pIng)}`, dl(ing, pIng, 'up'), cierre('cobrado', ing, fIng, kM), <Spark cur={cI} prev={pI} proj={projArr('cobrado', cI)} k={k} />)}
      {Cd('Labor', money(lab), undefined, `${prevName} a esta fecha: ${money(pLab)}`, dl(lab, pLab, 'down'), cierre('costo', lab, fLab, kM), <Spark cur={cL} prev={pL} proj={projArr('costo', cL)} k={k} />)}
      {Cd('Margen', money(mg), mg >= 0 ? C.green : C.red, `${prevName} a esta fecha: ${money(pMg)}`, dl(mg, pMg, 'up'), cierre('margen', mg, fMg, kM), <Spark cur={cM} prev={pM} proj={projArr('margen', cM)} k={k} />)}
      {Cd('Margen %', pctS(mgPct), undefined, `${prevName} a esta fecha: ${pctS(pPct)} · Mg/HH ${money1(hh > 0 ? mg / hh : null)}`, pPct === null || mgPct === null ? null : dl(mgPct, pPct, 'up', 'pct'), null, null)}
      {Cd('Limpiezas', String(lim), undefined, `${prevName} a esta fecha: ${pLim}`, dl(lim, pLim, 'up', 'num'), cierre('limpiezas', lim, fLim, n => String(Math.round(n))), <Spark cur={cN} prev={pN} proj={projArr('limpiezas', cN)} k={k} />)}
      {Cd('Horas de trabajo', `${Math.round(hrs)} h`, C.primaryDark, `${prevName} a esta fecha: ${Math.round(pHrs)} h · ${rng}`, dl(hrs, pHrs, 'down', 'h'), `${prevName} cerró ${Math.round(fHrs)} h`, <Spark cur={cH} prev={pH} k={k} />)}
    </div>
  }

  // detalle: acumulado y totales (real + agendado)
  let run = 0
  const rows = days.map((d, i) => { if (i < k) run += d.margen; if (d.proy && i >= Math.max(0, k - 1)) run += d.proy.margen; return { d, only: !d.limpiezas && !!d.proy, acc: run } })
  const pT = (key: string) => days.reduce((t, d) => t + (d.proy?.[key] || 0), 0)

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
      {isNow && <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Todo se compara con los mismos {k} días de {mode === 'week' ? 'la semana pasada' : 'el mes pasado'} ({fmtShort(pdays[0]?.date)} – {fmtShort(pdays[k - 1]?.date)}). Proyección = limpiezas ya agendadas.</div>}
      {cards}
      <Card style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 14 }}>Margen acumulado</b>
        <div style={{ fontSize: 12, color: C.slate, margin: '2px 0 4px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span><i style={{ display: 'inline-block', width: 18, borderTop: '3px solid #4F46E5', marginRight: 6, verticalAlign: 'middle' }} />Esta {mode === 'week' ? 'semana' : 'periodo'} (real)</span>
          {days.some(d => d.proy) && <span><i style={{ display: 'inline-block', width: 18, borderTop: '3px dotted #6366F1', marginRight: 6, verticalAlign: 'middle' }} />Proyección con lo agendado</span>}
          <span><i style={{ display: 'inline-block', width: 18, borderTop: '3px dashed #94A3B8', marginRight: 6, verticalAlign: 'middle' }} />{prevName[0].toUpperCase() + prevName.slice(1)} completa</span>
        </div>
        <CumChart days={days} prevDays={pdays} k={k} isMonth={data.isMonth} prevName={prevName} mob={mobile} />
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 14 }}>Margen por día</b>
        <div style={{ fontSize: 12, color: C.slate, margin: '2px 0 4px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span><i style={{ display: 'inline-block', width: 12, height: 12, background: '#10B981', borderRadius: 3, marginRight: 6, verticalAlign: 'middle' }} />Margen del día</span>
          {days.some(d => d.proy) && <span><i style={{ display: 'inline-block', width: 12, height: 12, background: '#A7F3D0', border: '1px dashed #10B981', borderRadius: 3, marginRight: 6, verticalAlign: 'middle' }} />Agendado (*)</span>}
          <span><i style={{ display: 'inline-block', width: 16, borderTop: '3px solid #475569', marginRight: 6, verticalAlign: 'middle' }} />Mismo día {mode === 'week' ? 'de la sem. pasada' : 'del mes pasado'}</span>
          <span><i style={{ display: 'inline-block', width: 12, height: 12, background: '#EF4444', borderRadius: 3, marginRight: 6, verticalAlign: 'middle' }} />Pérdida</span>
        </div>
        <DayBars days={days} prevDays={pdays} k={k} isMonth={data.isMonth} mob={mobile} />
        {days.some(d => d.proy) && <div style={{ fontSize: 11.5, color: C.amber, background: C.amberBg, borderRadius: 8, padding: '6px 10px', marginTop: 6 }}>* Agendado = ingreso programado − labor estimado ({data.avgDur?.toFixed(1)} h promedio por limpieza). Lo que aún no está agendado no cuenta.</div>}
      </Card>
      <Card>
        <b style={{ fontSize: 14 }}>Detalle por día</b> <span style={{ fontSize: 12, color: C.muted }}>· toca un día para ver sus casas</span>
        <div style={{ overflowX: 'auto', marginTop: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: mobile ? 600 : 0 }}>
            <thead><tr>{['Día', 'Ingresos', 'Labor', 'Margen', 'Mg %', 'Limp.', 'Acumulado', 'Labor según', ''].map(h => <th key={h} style={{ textAlign: 'left', fontSize: 10, color: C.muted, letterSpacing: '.04em', padding: 8, background: C.bg, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ d, only, acc }) => { const neg = !only && d.margen < 0
                return <tr key={d.date} onClick={() => onGoDay({ from: d.date, to: d.date, property, client })} style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer', background: neg ? '#FEF2F2' : only ? '#F0FDF4' : 'transparent', opacity: d.limpiezas || d.costo || d.proy ? 1 : 0.45 }}>
                  <td style={{ padding: 8, fontWeight: 700, textTransform: 'capitalize' }}>{fmtDow(d.date)}{d.date === today && <span style={{ color: C.primary }}> · hoy</span>}{only && <span style={{ color: C.muted, fontWeight: 400 }}> agendado</span>}</td>
                  <td style={{ padding: 8 }}>{only ? money(d.proy.cobrado) + '*' : money(d.cobrado)}</td><td style={{ padding: 8 }}>{only ? money(d.proy.costo) + '*' : money(d.costo)}</td>
                  <td style={{ padding: 8, fontWeight: 700, color: only || d.margen >= 0 ? C.green : C.red }}>{only ? money(d.proy.margen) + '*' : money(d.margen)}{!only && d.proy && <span style={{ fontWeight: 400, color: C.muted }}> +{money(d.proy.margen)}*</span>}</td>
                  <td style={{ padding: 8 }}>{only ? (d.proy.cobrado > 0 ? pctS(d.proy.margen / d.proy.cobrado * 100) : '—') : d.cobrado > 0 ? pctS(d.margen / d.cobrado * 100) : '—'}</td>
                  <td style={{ padding: 8 }}>{only ? d.proy.limpiezas : d.limpiezas}{!only && d.proy && <span style={{ color: C.muted }}> +{d.proy.limpiezas}*</span>}</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{money(acc)}{only ? '*' : ''}</td>
                  <td style={{ padding: 8, color: C.muted }}>{only ? 'est.' : d.fuente}</td>
                  <td style={{ padding: 8, color: C.primary, fontWeight: 700, whiteSpace: 'nowrap' }}>Ver casas ›</td></tr> })}
              {data.total && <tr style={{ background: C.bg, fontWeight: 700 }}><td style={{ padding: 8 }}>Total real</td><td style={{ padding: 8 }}>{money(data.total.cobrado)}</td><td style={{ padding: 8 }}>{money(data.total.costo)}</td><td style={{ padding: 8, color: data.total.margen >= 0 ? C.green : C.red }}>{money(data.total.margen)}</td><td style={{ padding: 8 }}>{pctS(data.total.mgPct)}</td><td style={{ padding: 8 }}>{data.total.limpiezas}</td><td colSpan={3} /></tr>}
              {data.total && days.some(d => d.proy) && <tr style={{ background: '#F0FDF4', fontWeight: 700 }}><td style={{ padding: 8 }}>Total con agendado*</td><td style={{ padding: 8 }}>{money(data.total.cobrado + pT('cobrado'))}</td><td style={{ padding: 8 }}>{money(data.total.costo + pT('costo'))}</td><td style={{ padding: 8, color: C.green }}>{money(data.total.margen + pT('margen'))}</td><td style={{ padding: 8 }}>{pctS((data.total.cobrado + pT('cobrado')) > 0 ? (data.total.margen + pT('margen')) / (data.total.cobrado + pT('cobrado')) * 100 : null)}</td><td style={{ padding: 8 }}>{data.total.limpiezas + pT('limpiezas')}</td><td colSpan={3} /></tr>}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Labor «turnos» = horas de turno pagadas × costo/hora. «est.» = horas limpiando × costo/hora (días sin turnos). En Casas, el labor del día se reparte entre sus limpiezas, así que la suma de casas = este detalle. Fila roja = labor mayor que ingresos.</p>
      </Card>
    </>}
  </div>
}
