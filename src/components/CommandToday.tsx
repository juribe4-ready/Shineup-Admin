import { useEffect, useMemo, useState } from 'react'
import { splitShift, fmtH, TRAVEL_CAP_MIN, type Split } from './splitTime'

const C = { primary: '#6366F1', ink: '#0F172A', slate: '#475569', muted: '#94A3B8', border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF', green: '#059669', red: '#DC2626', amber: '#B45309' }
const card: React.CSSProperties = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px' }
const lbl: React.CSSProperties = { fontSize: 12, color: '#64748B', fontWeight: 500 }
const big: React.CSSProperties = { fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, margin: '3px 0' }

const todayDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const getMonday = (d: Date) => { const dow = (d.getDay() + 6) % 7; const m = new Date(d); m.setDate(d.getDate() - dow); return m }
const shiftDay = (d: string, n: number) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA') }
const navBtn: React.CSSProperties = { background: '#fff', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('en-US')

interface Cl { id: string; propertyText: string; status: string; scheduledTime: string | null; startTime?: string | null; endTime?: string | null; staffListText: string; laborStaff?: { id: string; name?: string; rate: number | null }[] }
interface Sh { staffId: string; name?: string; start: string; end: string | null; closed: boolean; rate: number | null }
interface Bl { id: string; price: number | null; staffCount: number; status: string | null }

const STATUS: Record<string, { t: string; bg: string; fg: string }> = {
  Done: { t: 'Terminada', bg: '#D1FAE5', fg: '#047857' },
  'In Progress': { t: 'En curso', bg: '#EEF0FF', fg: '#4338CA' },
}

type Period = 'day' | 'week' | 'month' | 'ytd'
interface LDay { date: string; hours: number; cost: number; people: number; open: number }
const iso = (d: Date) => d.toLocaleDateString('en-CA')
const rangeOf = (p: Period, anchor: string): [string, string] => {
  const a = new Date(anchor + 'T12:00:00')
  if (p === 'day') return [anchor, anchor]
  if (p === 'week') { const m = getMonday(a); const e = new Date(m); e.setDate(m.getDate() + 6); return [iso(m), iso(e)] }
  if (p === 'month') return [iso(new Date(a.getFullYear(), a.getMonth(), 1)), iso(new Date(a.getFullYear(), a.getMonth() + 1, 0))]
  return [`${a.getFullYear()}-01-01`, `${a.getFullYear()}-12-31`]
}
const stepAnchor = (p: Period, anchor: string, n: number) => {
  const a = new Date(anchor + 'T12:00:00')
  if (p === 'day') a.setDate(a.getDate() + n); else if (p === 'week') a.setDate(a.getDate() + 7 * n); else if (p === 'month') a.setMonth(a.getMonth() + n); else a.setFullYear(a.getFullYear() + n)
  return iso(a)
}
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`
const TH: React.CSSProperties = { fontSize: 11, color: C.muted, fontWeight: 600 }
const R: React.CSSProperties = { textAlign: 'right' }
const sec: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '.06em', textTransform: 'uppercase', margin: '6px 2px -4px' }

export default function CommandToday({ extraCard, kpis, week, onRefresh }: { extraCard?: React.ReactNode; kpis?: React.ReactNode; week?: React.ReactNode; onRefresh?: () => void }) {
  const [period, setPeriod] = useState<Period>('day')
  const [date, setDate] = useState(todayDate())          // ancla del periodo
  const [loading, setLoading] = useState(true)
  const [cleanings, setCleanings] = useState<Cl[]>([])
  const [stats, setStats] = useState({ total: 0, done: 0, inProgress: 0 })
  const [billing, setBilling] = useState<any>(null)
  const [bills, setBills] = useState<Bl[]>([])
  const [billDates, setBillDates] = useState<Record<string, string>>({})
  const [shifts, setShifts] = useState<Sh[]>([])
  const [lab, setLab] = useState<{ days: LDay[]; openPast: number } | null>(null)
  const [debug, setDebug] = useState<any>(null)
  const [nowTick, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])
  const [from, to] = useMemo(() => rangeOf(period, date), [period, date])
  const isDay = period === 'day'
  const isToday = isDay && date === todayDate()
  const now = isDay ? (isToday ? nowTick : new Date(`${date}T23:59:59`).getTime()) : nowTick
  const dayWord = isDay ? (isToday ? 'hoy' : 'ese día') : 'el periodo'
  const [capPct, setCapPct] = useState<number | null>(null)
  const [strCount, setStrCount] = useState(0)
  const [flexCount, setFlexCount] = useState(0)
  const [incToday, setIncToday] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const monStr = iso(getMonday(new Date(date + 'T12:00:00')))
    ;(async () => {
      try {
        const reqs: Promise<Response>[] = [
          fetch(`/api/getReports?type=billing&dateFrom=${from}&dateTo=${to}`),
          fetch(`/api/getSquads?weekStart=${monStr}`),
          fetch('/api/getReports?type=incidents'),
          isDay ? fetch(`/api/getDashboard?date=${date}`) : fetch(`/api/getDashboard?action=laborRange&from=${from}&to=${to}`),
        ]
        const [b, sq, i, d] = await Promise.all(reqs.map(r => r.catch(() => ({ ok: false }) as any)))
        if (!alive) return
        if (b.ok) {
          const j = await b.json(); setBilling(j.summary || null); setBills(j.cleanings || [])
          const m: Record<string, string> = {}; for (const c of (j.cleanings || [])) if (c.date) m[c.id] = String(c.date).slice(0, 10); setBillDates(m)
          if (!isDay) { const cs = j.cleanings || []; setStats({ total: cs.length, done: cs.filter((c: any) => c.status === 'Done').length, inProgress: cs.filter((c: any) => c.status === 'In Progress').length }) }
        }
        if (d.ok) {
          const j = await d.json()
          if (isDay) { setCleanings(j.cleanings || []); setShifts(j.shifts || []); setDebug(j.debug || null); setLab(null); setStats({ total: j.stats?.total || 0, done: j.stats?.done || 0, inProgress: j.stats?.inProgress || 0 }) }
          else { setLab({ days: j.days || [], openPast: j.openPast || 0 }); setCleanings([]); setShifts([]) }
        }
        if (sq.ok) {
          const j = await sq.json(); const squads = j.squads || []; const blocks = j.blocks || []
          if (squads.length > 0) {
            const total = squads.reduce((sum: number, x: any) => sum + ((x.endHour - x.startHour) || 8), 0) * 7
            const toMin = (t: string) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m }
            const used = blocks.reduce((sum: number, bl: any) => sum + Math.max(0, (toMin(bl.endTime) - toMin(bl.startTime)) / 60), 0)
            setCapPct(total > 0 ? Math.round((used / total) * 100) : 0)
            setStrCount(blocks.filter((bl: any) => bl.type === 'STR' || bl.type === 'Appointment').length)
            setFlexCount(blocks.filter((bl: any) => bl.type !== 'STR' && bl.type !== 'Appointment').length)
          }
        }
        if (i.ok) {
          const inc = await i.json()
          setIncToday((inc || []).filter((x: any) => { if (!x.creationDate) return false; const dd = new Date(x.creationDate).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); return dd >= from && dd <= to }).length)
        }
      } catch {}
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [from, to, isDay, date])

  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'
  const list = [...cleanings].sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''))
  const fmtDur = (c: Cl) => {
    if (!c.startTime) return '—'
    const end = c.endTime ? new Date(c.endTime).getTime() : now
    const m = Math.max(0, Math.round((end - new Date(c.startTime).getTime()) / 60000))
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m${c.endTime ? '' : ' ⏱'}`
  }
  const billOf = (id: string) => bills.find(b => b.id === id)
  const model = useMemo(() => buildModel(cleanings, shifts, now), [cleanings, shifts, now])
  const laborOf = (c: Cl): number | null => {
    if (!c.startTime) return null
    const end = c.endTime ? new Date(c.endTime).getTime() : now
    return laborCost(c, 1, 0, Math.max(0, (end - new Date(c.startTime).getTime()) / 3600000))
  }

  // ── Resumen unificado (día o periodo) ──
  const sum = useMemo(() => {
    if (isDay) {
      const rev = bills.filter(b => b.status === 'Done').reduce((t, b) => t + (b.price || 0), 0)
      const labor = model.tot.cleanC + model.tot.travelC + model.tot.deadC
      const hours = model.tot.total / 3600000
      return { rev, labor, hours, margin: rev - labor, mph: hours > 0 ? (rev - labor) / hours : 0, daysWith: model.byShift ? 1 : 0, note: model.byShift ? '' : 'Sin turnos registrados: el labor aparece en $0 hasta que haya turnos.' }
    }
    const byDay: Record<string, { rev: number; n: number }> = {}
    for (const b of bills as any[]) { const d = billDates[b.id]; if (!d || b.status !== 'Done') continue; (byDay[d] ||= { rev: 0, n: 0 }); byDay[d].rev += b.price || 0; byDay[d].n += 1 }
    const ld = (lab?.days || []).filter(x => x.hours > 0)
    const labor = ld.reduce((t, x) => t + x.cost, 0), hours = ld.reduce((t, x) => t + x.hours, 0)
    const revAll = Object.values(byDay).reduce((t, x) => t + x.rev, 0)
    const revWith = ld.reduce((t, x) => t + (byDay[x.date]?.rev || 0), 0)
    const margin = revWith - labor
    return { rev: revAll, revWith, labor, hours, margin, mph: hours > 0 ? margin / hours : 0, daysWith: ld.length, note: ld.length ? (revWith < revAll ? `Margen calculado solo sobre los ${ld.length} día(s) con turnos registrados (${money(revWith)} de ingreso).` : '') + (lab?.openPast ? ` ${lab.openPast} turno(s) de días pasados sin salida no suman horas.` : '') : 'Aún no hay turnos registrados en este periodo.', byDay }
  }, [isDay, bills, billDates, model, lab])

  const periodLabel = isDay
    ? new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : period === 'week' ? `Semana ${new Date(from + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${new Date(to + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
    : period === 'month' ? new Date(from + 'T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : `Año ${from.slice(0, 4)} (acumulado)`
  const atNow = isDay ? date === todayDate() : to >= todayDate() && from <= todayDate()
  const PERIODS: [Period, string][] = [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes'], ['ytd', 'YTD']]
  const doneTone = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

  const Kpi = ({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) => (
    <div style={card}><p style={lbl}>{label}</p><p style={{ ...big, fontSize: 22, color: color || C.ink }}>{loading ? '…' : value}</p>{sub && <p style={{ fontSize: 11, color: C.muted }}>{sub}</p>}</div>
  )

  const GRID = 'minmax(130px,1.5fr) minmax(110px,1.3fr) 66px 66px 74px 72px 72px 78px 84px'
  const totRev = list.reduce((t, c) => t + (billOf(c.id)?.price || 0), 0)
  const totRevDone = list.filter(c => c.status === 'Done').reduce((t, c) => t + (billOf(c.id)?.price || 0), 0)
  const totHouseCost = list.reduce((t, c) => t + (laborOf(c) || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── FILTRO (arriba) ── */}
      <div style={{ ...card, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 5 }}>
        <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 9, overflow: 'hidden' }}>
          {PERIODS.map(([k, t]) => (
            <button key={k} onClick={() => { setPeriod(k); if (k === 'day') setDate(d => d > todayDate() ? todayDate() : d) }} style={{ padding: '5px 14px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: period === k ? C.primary : '#fff', color: period === k ? '#fff' : C.slate }}>{t}</button>
          ))}
        </div>
        <button onClick={() => setDate(d => stepAnchor(period, d, -1))} aria-label="Anterior" style={navBtn}>‹</button>
        {isDay && <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} style={{ padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} />}
        <button onClick={() => setDate(d => stepAnchor(period, d, 1))} aria-label="Siguiente" style={navBtn}>›</button>
        {!atNow && <button onClick={() => setDate(todayDate())} style={{ ...navBtn, color: C.primary, borderColor: '#C7D2FE', background: '#EEF0FF' }}>{isDay ? 'Hoy' : 'Actual'}</button>}
        <span style={lbl}>{periodLabel}{atNow ? '' : ' · histórico'}</span>
        {onRefresh && <button onClick={onRefresh} style={{ marginLeft: 'auto', fontSize: 12, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Actualizar</button>}
      </div>

      {/* ── 1. RESUMEN ── */}
      <p style={sec}>1 · Resumen {isDay ? (isToday ? 'de hoy' : 'del día') : 'del periodo'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <Kpi label="Ingreso (terminadas)" value={money(sum.rev)} color={C.primary} sub={`${stats.done} de ${stats.total} limpiezas · ${doneTone}%`} />
        <Kpi label="Labor total" value={money(sum.labor)} color={C.red} sub={sum.hours ? `${fmtH(sum.hours * 3600000)} de turno` : 'sin turnos'} />
        <Kpi label="Margen" value={signed(sum.margin)} color={sum.margin >= 0 ? C.green : C.red} sub="ingreso − labor" />
        <Kpi label="Margen por hora" value={`${signed(sum.mph)}/h`} color={sum.mph >= 0 ? C.green : C.red} sub="por hora-persona de turno" />
        <Kpi label="Incidentes" value={String(incToday)} color={incToday > 0 ? C.amber : C.ink} sub={`${stats.inProgress} limpiezas en curso`} />
      </div>
      {sum.note && !loading && <p style={{ fontSize: 11, color: C.muted, margin: '-6px 2px 0' }}>{sum.note}</p>}

      {/* ── 2. GRÁFICA ── */}
      <p style={sec}>2 · {isDay ? 'Ingreso vs labor en el día' : 'Ingreso vs labor por ' + (period === 'ytd' ? 'mes' : 'día')}</p>
      {isDay
        ? <LaborChart cleanings={cleanings} bills={bills} model={model} now={now} loading={loading} dayWord={dayWord} />
        : <RangeChart period={period} from={from} to={to} lab={lab?.days || []} byDay={(sum as any).byDay || {}} loading={loading} />}

      {/* ── 3. DETALLE ── */}
      <p style={sec}>3 · {isDay ? `Limpiezas ${isToday ? 'de hoy' : 'del día'}` : 'Detalle'}</p>
      {isDay ? (
        <div style={{ ...card, padding: '12px 16px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{list.length} limpiezas</p>
          {loading ? <p style={{ fontSize: 13, color: C.muted }}>Cargando…</p> : list.length === 0 ? <p style={{ fontSize: 13, color: C.muted }}>No hay limpiezas {isToday ? 'hoy' : 'ese día'}.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 860 }}>
                <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}`, ...TH }}>
                  <span>Casa</span><span>Cleaners</span><span style={R}>Inicio</span><span style={R}>Fin</span><span style={R}>Duración</span><span style={R}>Ingreso</span><span style={R} title="tarifa × cleaners × horas dentro de la casa">Costo</span><span style={R}>Margen</span><span style={R}>Estado</span>
                </div>
                {list.map(c => {
                  const st = STATUS[c.status] || { t: 'Programada', bg: '#F1F5F9', fg: '#475569' }
                  const names = (c.laborStaff || []).map(x => (x.name || '').split(' ')[0]).filter(Boolean)
                  const price = billOf(c.id)?.price || 0
                  const cost = laborOf(c)
                  const margin = cost == null ? null : price - cost
                  const dim = c.status === 'Done'
                  return (
                    <div key={c.id} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center', padding: '8px 0', borderTop: '1px solid #F1F5F9', fontSize: 13 }}>
                      <div style={{ minWidth: 0 }}>
                        <b style={{ display: 'block', color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.propertyText || 'Sin nombre'}</b>
                        <span style={{ fontSize: 11, color: C.muted }}>Prog. {fmtTime(c.scheduledTime)}</span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        {names.length === 0 ? <span style={{ color: C.amber, fontSize: 12 }}>Sin cleaners</span> : (
                          <>
                            <span style={{ display: 'inline-block', background: '#EEF0FF', color: '#4338CA', fontWeight: 700, fontSize: 11, borderRadius: 6, padding: '1px 7px', marginRight: 6 }}>{names.length}</span>
                            <span style={{ fontSize: 11, color: '#64748B' }}>{names.join(', ')}</span>
                          </>
                        )}
                      </div>
                      <span style={{ ...R, fontSize: 12, color: c.startTime ? C.ink : C.muted }}>{fmtTime(c.startTime || null)}</span>
                      <span style={{ ...R, fontSize: 12, color: c.endTime ? C.ink : C.muted }}>{fmtTime(c.endTime || null)}</span>
                      <span style={{ ...R, fontSize: 12, fontWeight: 600, color: c.endTime ? C.green : c.startTime ? C.primary : C.muted }}>{fmtDur(c)}</span>
                      <span style={{ ...R, fontSize: 12, color: C.ink, fontWeight: 600 }}>{price ? money(price) : '—'}</span>
                      <span style={{ ...R, fontSize: 12, color: C.slate }}>{cost == null ? '—' : money(cost)}</span>
                      <span style={{ ...R, fontSize: 12, fontWeight: 700, color: margin == null ? C.muted : margin >= 0 ? C.green : C.red }}>{margin == null || !price ? '—' : signed(margin)}</span>
                      <span style={R}><span style={{ background: st.bg, color: st.fg, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', opacity: dim ? 1 : 1 }}>{st.t}</span></span>
                    </div>
                  )
                })}
                <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center', padding: '9px 0 2px', borderTop: `2px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.ink }}>
                  <span>Total casas</span><span /><span /><span /><span />
                  <span style={R}>{money(totRev)}</span><span style={R}>{money(totHouseCost)}</span><span style={{ ...R, color: totRev - totHouseCost >= 0 ? C.green : C.red }}>{signed(totRev - totHouseCost)}</span><span />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center', padding: '4px 0', fontSize: 12, fontWeight: 700 }}>
                  <span style={{ color: C.ink }}>Labor total del turno</span><span style={{ fontSize: 11, fontWeight: 500, color: C.muted, gridColumn: '2 / 6' }}>horas de turno × Cost/Hour (incluye traslado y tiempo muerto)</span>
                  <span style={R} /><span style={{ ...R, color: C.red }}>{money(sum.labor)}</span><span style={{ ...R, color: totRevDone - sum.labor >= 0 ? C.green : C.red }} title="Ingreso de terminadas − labor total">{signed(totRevDone - sum.labor)}</span><span />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <RangeTable period={period} lab={lab?.days || []} byDay={(sum as any).byDay || {}} loading={loading} />
      )}

      {isDay && (<><p style={sec}>4 · Horas del turno</p><HoursCard model={model} loading={loading} debug={debug} dayWord={dayWord} /></>)}

      {/* ── OPERACIÓN Y COBROS ── */}
      <p style={sec}>{isDay ? '5' : '4'} · Operación y cobros</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div style={card}>
          <p style={lbl}>Cobros {isDay ? (isToday ? 'de hoy' : 'del día') : 'del periodo'}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}><span style={lbl}>Generado (todas)</span><b style={{ color: C.primary }}>{money(billing?.totalRevenue || 0)}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={lbl}>Por cobrar</span><b style={{ color: C.amber }}>{money(billing?.unpaidAmount || 0)}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={lbl}>Facturado</span><b style={{ color: C.ink }}>{money(billing?.invoicedAmount || 0)}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={lbl}>Cobrado</span><b style={{ color: C.green }}>{money(billing?.paidAmount || 0)}</b></div>
        </div>
        <div style={card}>
          <p style={lbl}>Capacidad de la semana</p>
          <p style={big}>{capPct === null ? '—' : `${capPct}%`}</p>
          <div style={{ height: 8, borderRadius: 99, background: '#E2E8F0', margin: '6px 0', overflow: 'hidden' }}><div style={{ width: `${Math.min(capPct || 0, 100)}%`, height: '100%', background: C.primary }} /></div>
          <p style={lbl}>Bloques STR: {strCount} · Flex / otros: {flexCount}</p>
        </div>
        {extraCard}
      </div>
      {kpis}
      {week}
    </div>
  )
}

function RangeChart({ period, from, to, lab, byDay, loading }: { period: Period; from: string; to: string; lab: LDay[]; byDay: Record<string, { rev: number; n: number }>; loading: boolean }) {
  const buckets = useMemo(() => {
    const keyOf = (d: string) => period === 'ytd' ? d.slice(0, 7) : d
    const m: Record<string, { k: string; rev: number; labor: number; hours: number }> = {}
    const put = (k: string) => (m[k] ||= { k, rev: 0, labor: 0, hours: 0 })
    for (const [d, v] of Object.entries(byDay)) put(keyOf(d)).rev += v.rev
    for (const x of lab) { const b = put(keyOf(x.date)); b.labor += x.cost; b.hours += x.hours }
    // rellenar huecos para que el eje sea continuo
    const out: typeof m[string][] = []
    if (period === 'ytd') { for (let mth = 1; mth <= 12; mth++) { const k = `${from.slice(0, 4)}-${String(mth).padStart(2, '0')}`; out.push(m[k] || { k, rev: 0, labor: 0, hours: 0 }) } }
    else { for (let d = from; d <= to; d = shiftDay(d, 1)) out.push(m[d] || { k: d, rev: 0, labor: 0, hours: 0 }) }
    return out
  }, [period, from, to, lab, byDay])
  if (loading) return <div style={card}><p style={{ fontSize: 13, color: C.muted }}>Cargando…</p></div>
  const W = 760, H = 190, pl = 46, pr = 10, pt = 10, pb = 34
  const ymax = Math.max(50, ...buckets.map(b => Math.max(b.rev, b.labor))) * 1.1
  const bw = (W - pl - pr) / buckets.length
  const Y = (v: number) => pt + (1 - v / ymax) * (H - pt - pb)
  const lab_ = (k: string) => period === 'ytd' ? new Date(k + '-15T12:00:00').toLocaleDateString('es-ES', { month: 'short' }) : (period === 'week' ? new Date(k + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 3) : String(Number(k.slice(8))))
  return (
    <div style={card}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxHeight: 220, fontFamily: 'inherit' }}>
        {[0, 0.5, 1].map(f => { const v = (ymax / 1.1) * f; return <g key={f}><line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke="#EEF2F7" /><text x={pl - 6} y={Y(v) + 3} fontSize="10" textAnchor="end" fill={C.muted}>{money(v)}</text></g> })}
        {buckets.map((b, i) => {
          const x = pl + i * bw, mph = b.hours > 0 ? (b.rev - b.labor) / b.hours : null
          return (
            <g key={b.k}>
              {b.rev > 0 && <rect x={x + bw * 0.12} y={Y(b.rev)} width={bw * 0.36} height={Math.max(0, H - pb - Y(b.rev))} fill="#6366F1" rx="2" />}
              {b.labor > 0 && <rect x={x + bw * 0.52} y={Y(b.labor)} width={bw * 0.36} height={Math.max(0, H - pb - Y(b.labor))} fill="#DC2626" rx="2" />}
              <text x={x + bw / 2} y={H - 20} fontSize="10" textAnchor="middle" fill={C.muted}>{lab_(b.k)}</text>
              {mph != null && buckets.length <= 16 && <text x={x + bw / 2} y={H - 7} fontSize="9" textAnchor="middle" fill={mph >= 0 ? C.green : C.red} fontWeight="600">{mph >= 0 ? '+' : '−'}${Math.abs(mph).toFixed(0)}/h</text>}
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.slate, flexWrap: 'wrap' }}>
        <span><b style={{ color: '#6366F1' }}>▮</b> Ingreso (terminadas)</span><span><b style={{ color: '#DC2626' }}>▮</b> Labor de turno</span><span>Debajo de cada barra: margen por hora (solo donde hay turnos)</span>
      </div>
    </div>
  )
}

function RangeTable({ period, lab, byDay, loading }: { period: Period; lab: LDay[]; byDay: Record<string, { rev: number; n: number }>; loading: boolean }) {
  const rows = useMemo(() => {
    const keyOf = (d: string) => period === 'ytd' ? d.slice(0, 7) : d
    const m: Record<string, { k: string; n: number; rev: number; labor: number; hours: number; withShifts: boolean }> = {}
    const put = (k: string) => (m[k] ||= { k, n: 0, rev: 0, labor: 0, hours: 0, withShifts: false })
    for (const [d, v] of Object.entries(byDay)) { const b = put(keyOf(d)); b.rev += v.rev; b.n += v.n }
    for (const x of lab) { const b = put(keyOf(x.date)); b.labor += x.cost; b.hours += x.hours; b.withShifts = b.withShifts || x.hours > 0 }
    return Object.values(m).sort((a, b) => b.k.localeCompare(a.k))
  }, [period, lab, byDay])
  const name = (k: string) => period === 'ytd' ? new Date(k + '-15T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : new Date(k + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  const G = 'minmax(120px,1.4fr) 80px 90px 90px 90px 80px 90px'
  return (
    <div style={{ ...card, padding: '12px 16px' }}>
      {loading ? <p style={{ fontSize: 13, color: C.muted }}>Cargando…</p> : rows.length === 0 ? <p style={{ fontSize: 13, color: C.muted }}>Sin datos en este periodo.</p> : (
        <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: G, gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}`, ...TH }}>
            <span>{period === 'ytd' ? 'Mes' : 'Día'}</span><span style={R}>Limpiezas</span><span style={R}>Ingreso</span><span style={R}>Labor</span><span style={R}>Margen</span><span style={R}>Horas</span><span style={R}>Margen/h</span>
          </div>
          {rows.map(r => {
            const margin = r.rev - r.labor
            return (
              <div key={r.k} style={{ display: 'grid', gridTemplateColumns: G, gap: 8, padding: '7px 0', borderTop: '1px solid #F1F5F9', fontSize: 12, alignItems: 'center' }}>
                <span style={{ color: C.ink, fontWeight: 600, textTransform: 'capitalize' }}>{name(r.k)}</span>
                <span style={R}>{r.n}</span><span style={{ ...R, fontWeight: 600 }}>{money(r.rev)}</span>
                <span style={{ ...R, color: C.slate }}>{r.withShifts ? money(r.labor) : '—'}</span>
                <span style={{ ...R, fontWeight: 700, color: !r.withShifts ? C.muted : margin >= 0 ? C.green : C.red }}>{r.withShifts ? signed(margin) : '—'}</span>
                <span style={R}>{r.withShifts ? fmtH(r.hours * 3600000) : '—'}</span>
                <span style={{ ...R, fontWeight: 700, color: !r.withShifts ? C.muted : margin >= 0 ? C.green : C.red }}>{r.withShifts && r.hours > 0 ? `${signed(margin / r.hours)}/h` : '—'}</span>
              </div>
            )
          })}
        </div></div>
      )}
    </div>
  )
}

// ── Ingreso acumulado vs costo de labor (hoy) ────────────────────────────────
const etHour = (ms: number) => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date(ms))
  const h = Number(p.find(x => x.type === 'hour')?.value) % 24, m = Number(p.find(x => x.type === 'minute')?.value)
  return h + m / 60
}
// Costo de labor de una limpieza (solo cleaners) en `hours` horas, con Cost/Hour por persona; sin tarifa usa el promedio del equipo.
const laborCost = (c: { laborStaff?: { id: string; rate: number | null }[] }, n: number, avgRate: number, hours: number) =>
  c.laborStaff && c.laborStaff.length ? c.laborStaff.reduce((a, p) => a + (p.rate ?? avgRate) * hours, 0) : avgRate * n * hours

// Modelo de labor del día: por persona (turno → limpiando / traslado / muerto) y totales.
interface PersonRow { id: string; name: string; startMs: number; endMs: number; open: boolean; rate: number; noRate: boolean; sp: Split }
function buildModel(cleanings: Cl[], shifts: Sh[], now: number) {
  const avgRate = 0  // sin Cost/Hour = $0 (no se inventa un promedio)
  const people: PersonRow[] = shifts.map(x => {
    const startMs = new Date(x.start).getTime(), endMs = x.end ? new Date(x.end).getTime() : now
    const iv = cleanings.filter(c => c.startTime && (c.laborStaff || []).some(p => p.id === x.staffId)).map(c => ({ s: new Date(c.startTime as string).getTime(), e: c.endTime ? new Date(c.endTime).getTime() : now }))
    return { id: x.staffId, name: x.name || 'Cleaner', startMs, endMs, open: !x.end, rate: x.rate || 0, noRate: !x.rate, sp: splitShift(startMs, endMs, iv) }
  })
  const H = 3600000
  const tot = people.reduce((t, p) => ({ total: t.total + p.sp.total, clean: t.clean + p.sp.clean, travel: t.travel + p.sp.travel, dead: t.dead + p.sp.dead, cleanC: t.cleanC + p.rate * p.sp.clean / H, travelC: t.travelC + p.rate * p.sp.travel / H, deadC: t.deadC + p.rate * p.sp.dead / H }), { total: 0, clean: 0, travel: 0, dead: 0, cleanC: 0, travelC: 0, deadC: 0 })
  return { avgRate, people, tot, byShift: people.length > 0 }
}

function LaborChart({ cleanings, bills, model, now, loading, dayWord }: { cleanings: Cl[]; bills: Bl[]; model: ReturnType<typeof buildModel>; now: number; loading: boolean; dayWord: string }) {
  const rate = model.avgRate

  const d = useMemo(() => {
    const nowH = etHour(now)
    const jobs = cleanings.filter(c => c.startTime).map(c => {
      const b = bills.find(x => x.id === c.id)
      return { c, s: etHour(new Date(c.startTime as string).getTime()), e: c.endTime ? etHour(new Date(c.endTime).getTime()) : nowH, done: !!c.endTime, price: b?.price || 0, n: Math.max(1, b?.staffCount || 1) }
    })
    if (!jobs.length && !model.byShift) return null
    const target = cleanings.reduce((t, c) => t + (bills.find(x => x.id === c.id)?.price || 0), 0)
    // Labor = horas de TURNO (desde que cada cleaner inicia turno) × su costo/hora. Sin turnos registrados: estimado por horas en casas.
    const sh = model.people.map(x => ({ s: etHour(x.startMs), e: x.open ? nowH : etHour(x.endMs), rate: x.rate }))
    const byShift = sh.length > 0
    const costAt = (t: number) => byShift
      ? sh.reduce((a, p) => a + p.rate * Math.max(0, Math.min(t, p.e) - p.s), 0)
      : jobs.reduce((a, j) => a + laborCost(j.c, j.n, rate, Math.max(0, Math.min(t, j.e) - j.s)), 0)
    const revAt = (t: number) => jobs.reduce((a, j) => a + (j.done && j.e <= t ? j.price : 0), 0)
    // Eje: desde que empieza el turno / la primera casa; hasta las 10pm como mínimo (crece si se trabaja más tarde)
    const first = Math.min(...jobs.map(j => j.s), ...sh.map(p => p.s))
    const x0 = Math.max(0, Math.floor(first)), x1 = Math.max(22, Math.ceil(Math.max(nowH, ...jobs.map(j => j.e), ...sh.map(p => p.e))))
    const rev: [number, number][] = [], cost: [number, number][] = []
    for (let t = first; t <= Math.min(x1, nowH) + 1e-9; t += 0.25) { rev.push([t, revAt(t)]); cost.push([t, costAt(t)]) }
    const hours = Array.from({ length: x1 - x0 }, (_, i) => { const a = x0 + i, b = Math.min(a + 1, nowH); return { h: a, rev: a >= nowH ? 0 : revAt(b) - revAt(a), cost: a >= nowH ? 0 : costAt(b) - costAt(a) } })
    const lastR = revAt(nowH), lastC = costAt(nowH)
    return { x0, x1, rev, cost, hours, target, lastR, lastC, nowH, byShift, people: sh.length }
  }, [cleanings, bills, model, now, rate])

  const W = 700, H = 170, pl = 46, pr = 84, pt = 10, pb = 20
  const body = (() => {
    if (loading) return <p style={{ fontSize: 13, color: C.muted }}>Cargando…</p>
    if (!d) return <p style={{ fontSize: 13, color: C.muted }}>Aún no hay limpiezas iniciadas ese día. La gráfica aparece cuando empiece la primera.</p>
    const ymax = Math.max(d.target, d.lastR, d.lastC, 50) * 1.08
    const plotR = W - pr
    const X = (t: number) => pl + ((t - d.x0) / (d.x1 - d.x0)) * (plotR - pl)
    const Y = (v: number) => pt + (1 - v / ymax) * (H - pt - pb)
    const path = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')
    const hl = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`
    const margin = d.lastR - d.lastC
    const personHours = model.tot.total / 3600000
    const mph = personHours > 0 ? margin / personHours : 0
    const bw = (plotR - pl) / (d.x1 - d.x0)
    const bx = plotR + 14, bwid = 26, base = H - pb
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 4 }}>
          <div><p style={lbl}>Ingreso (terminadas)</p><p style={{ ...big, fontSize: 18, margin: '1px 0', color: C.primary }}>{money(d.lastR)}</p></div>
          <div><p style={lbl}>Labor de turno{d.byShift ? ` · ${d.people} cleaners` : ' (estimado)'}</p><p style={{ ...big, fontSize: 18, margin: '1px 0', color: C.red }}>{money(d.lastC)}</p></div>
          <div><p style={lbl}>Margen</p><p style={{ ...big, fontSize: 18, margin: '1px 0', color: margin >= 0 ? C.green : C.red }}>{margin >= 0 ? '+' : '−'}{money(Math.abs(margin))}</p></div>
          <div><p style={lbl}>Margen por hora</p><p style={{ ...big, fontSize: 18, margin: '1px 0', color: mph >= 0 ? C.green : C.red }}>{mph >= 0 ? '+' : '−'}{money(Math.abs(mph))}/h</p></div>
          <div><p style={lbl}>Meta del día</p><p style={{ ...big, fontSize: 18, margin: '1px 0', color: C.slate }}>{money(d.target)}</p></div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxHeight: 190, fontFamily: 'inherit' }}>
          {[0, 0.25, 0.5, 0.75, 1].map(f => { const v = (ymax / 1.08) * f; return <g key={f}><line x1={pl} x2={plotR} y1={Y(v)} y2={Y(v)} stroke="#EEF2F7" /><text x={pl - 6} y={Y(v) + 3} fontSize="10" textAnchor="end" fill={C.muted}>{money(v)}</text></g> })}
          {d.hours.map(hh => (
            <g key={hh.h}>
              <text x={X(hh.h) + bw / 2} y={H - 8} fontSize="10" textAnchor="middle" fill={C.muted}>{hl(hh.h)}</text>
              {hh.rev > 0 && <rect x={X(hh.h) + bw * 0.14} y={Y(hh.rev)} width={bw * 0.34} height={Math.max(0, base - Y(hh.rev))} fill="#C7D2FE" rx="2" />}
              {hh.cost > 0 && <rect x={X(hh.h) + bw * 0.52} y={Y(hh.cost)} width={bw * 0.34} height={Math.max(0, base - Y(hh.cost))} fill="#FECACA" rx="2" />}
            </g>
          ))}
          <line x1={pl} x2={plotR} y1={Y(d.target)} y2={Y(d.target)} stroke="#A5B4FC" strokeDasharray="5 4" />
          <path d={path(d.cost)} fill="none" stroke={C.red} strokeWidth="2.2" />
          <path d={path(d.rev)} fill="none" stroke={C.primary} strokeWidth="2.6" />
          <line x1={X(d.nowH)} x2={X(d.nowH)} y1={pt} y2={base} stroke="#CBD5E1" />
          <text x={X(d.nowH) - 3} y={pt + 22} fontSize="10" textAnchor="end" fill={C.muted}>ahora</text>
          {/* dos barras finales: totales acumulados de hoy */}
          <rect x={bx} y={Y(d.lastR)} width={bwid} height={Math.max(0, base - Y(d.lastR))} fill={C.primary} rx="3" />
          <rect x={bx + bwid + 8} y={Y(d.lastC)} width={bwid} height={Math.max(0, base - Y(d.lastC))} fill={C.red} rx="3" />
          <text x={bx + bwid / 2} y={Y(d.lastR) - 4} fontSize="10" textAnchor="middle" fill={C.ink} fontWeight="600">{money(d.lastR)}</text>
          <text x={bx + bwid + 8 + bwid / 2} y={Y(d.lastC) - 4} fontSize="10" textAnchor="middle" fill={C.ink} fontWeight="600">{money(d.lastC)}</text>
          <text x={bx + bwid / 2} y={H - 8} fontSize="10" textAnchor="middle" fill={C.muted}>Ing.</text>
          <text x={bx + bwid + 8 + bwid / 2} y={H - 8} fontSize="10" textAnchor="middle" fill={C.muted}>Labor</text>
        </svg>
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.slate, flexWrap: 'wrap' }}>
          <span><b style={{ color: C.primary }}>━</b> Ingreso acumulado</span><span><b style={{ color: C.red }}>━</b> Labor acumulado</span><span><b style={{ color: '#6366F1' }}>╌</b> Meta del día</span><span><b style={{ color: '#C7D2FE' }}>▮</b><b style={{ color: '#FECACA' }}>▮</b> Por hora</span>
        </div>
      </>
    )
  })()

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Ingreso vs labor · {dayWord}</p>
      </div>
      {body}
      <p style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>Labor = Cost/Hour de cada cleaner × horas de turno (solo cleaners). Margen por hora = (ingreso − labor) ÷ horas-persona de turno. El ingreso cuenta al terminar cada limpieza.</p>
    </div>
  )
}


// ── Horas y costo del turno: limpiando / traslado / tiempo muerto ─────────────
function HoursCard({ model, loading, debug, dayWord }: { model: ReturnType<typeof buildModel>; loading: boolean; debug: any; dayWord: string }) {
  const t = model.tot
  const groups = [
    { k: 'Limpiando', ms: t.clean, cost: t.cleanC, color: C.primary, note: 'dentro de las casas' },
    { k: 'Traslado', ms: t.travel, cost: t.travelC, color: '#F59E0B', note: `hueco entre casas, hasta ${TRAVEL_CAP_MIN} min` },
    { k: 'Tiempo muerto', ms: t.dead, cost: t.deadC, color: '#94A3B8', note: 'lo que exceda ese tope' },
  ]
  const totalCost = t.cleanC + t.travelC + t.deadC
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Horas y costo del turno · {dayWord}</p>
        <p style={lbl}>{model.byShift ? `${model.people.length} cleaners · ${fmtH(t.total)} en total · ${money(totalCost)}` : '—'}</p>
      </div>
      {loading ? <p style={{ fontSize: 13, color: C.muted }}>Cargando…</p> : !model.byShift ? (
        <p style={{ fontSize: 13, color: C.muted }}>Aún no hay turnos de cleaners registrados ese día (se registran en Ops, pestaña Turno, o en Field).</p>
      ) : (
        <>
          <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', background: '#E2E8F0', marginBottom: 10 }}>
            {groups.map(g => <div key={g.k} title={g.k} style={{ width: `${t.total ? (g.ms / t.total) * 100 : 0}%`, background: g.color }} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
            {groups.map(g => (
              <div key={g.k}>
                <p style={lbl}><b style={{ color: g.color }}>●</b> {g.k}</p>
                <p style={{ ...big, fontSize: 18, margin: '1px 0' }}>{fmtH(g.ms)} · {money(g.cost)}</p>
                <p style={{ fontSize: 10, color: C.muted }}>{g.note}</p>
              </div>
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 480 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr .8fr .8fr .8fr .8fr', gap: 8, fontSize: 11, color: C.muted, fontWeight: 600, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                <span>Cleaner</span><span style={{ textAlign: 'right' }}>Turno</span><span style={{ textAlign: 'right' }}>Limpiando</span><span style={{ textAlign: 'right' }}>Traslado</span><span style={{ textAlign: 'right' }}>Muerto</span><span style={{ textAlign: 'right' }}>Costo</span>
              </div>
              {model.people.map(p => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr .8fr .8fr .8fr .8fr', gap: 8, fontSize: 12, padding: '5px 0', borderTop: '1px solid #F1F5F9', alignItems: 'center' }}>
                  <span style={{ color: C.ink, fontWeight: 600 }}>{p.name}{p.open ? ' ⏱' : ''}</span>
                  <span style={{ textAlign: 'right' }}>{fmtH(p.sp.total)}</span><span style={{ textAlign: 'right' }}>{fmtH(p.sp.clean)}</span><span style={{ textAlign: 'right' }}>{fmtH(p.sp.travel)}</span><span style={{ textAlign: 'right' }}>{fmtH(p.sp.dead)}</span>
                  <span style={{ textAlign: 'right', fontWeight: 600 }}>{money(p.rate * p.sp.total / 3600000)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <p style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>Costo de limpiezas = suma de la columna «Labor casa». Traslado y muerto salen de los huecos entre limpiezas de cada persona (aún no hay un botón en Ops para marcarlos).</p>
      {debug && (
        <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
          Debug · Cost/Hour: {debug.costRead} · {debug.ratesFound} de {debug.cleanersTotal} cleaners con tarifa{debug.cleanersWithoutRate?.length ? ` (sin tarifa: ${debug.cleanersWithoutRate.join(', ')})` : ''} · turnos de cleaners hoy: {debug.shiftsToday}
        </p>
      )}
    </div>
  )
}
