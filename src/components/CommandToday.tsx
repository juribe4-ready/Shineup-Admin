import { useEffect, useMemo, useState } from 'react'

const C = { primary: '#6366F1', ink: '#0F172A', slate: '#475569', muted: '#94A3B8', border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF', green: '#059669', red: '#DC2626', amber: '#B45309' }
const card: React.CSSProperties = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px' }
const lbl: React.CSSProperties = { fontSize: 12, color: '#64748B', fontWeight: 500 }
const big: React.CSSProperties = { fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, margin: '3px 0' }

const todayDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const getMonday = (d: Date) => { const dow = (d.getDay() + 6) % 7; const m = new Date(d); m.setDate(d.getDate() - dow); return m }
const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('en-US')

interface Cl { id: string; propertyText: string; status: string; scheduledTime: string | null; startTime?: string | null; endTime?: string | null; staffListText: string }
interface Bl { id: string; price: number | null; staffCount: number; status: string | null }

const STATUS: Record<string, { t: string; bg: string; fg: string }> = {
  Done: { t: 'Terminada', bg: '#D1FAE5', fg: '#047857' },
  'In Progress': { t: 'En curso', bg: '#EEF0FF', fg: '#4338CA' },
}

export default function CommandToday({ extraCard, kpis, week, onRefresh }: { extraCard?: React.ReactNode; kpis?: React.ReactNode; week?: React.ReactNode; onRefresh?: () => void }) {
  const [loading, setLoading] = useState(true)
  const [cleanings, setCleanings] = useState<Cl[]>([])
  const [stats, setStats] = useState({ total: 0, done: 0, inProgress: 0 })
  const [billing, setBilling] = useState<any>(null)
  const [bills, setBills] = useState<Bl[]>([])
  const [rate, setRate] = useState<number>(readRate)
  const saveRate = (v: number) => { setRate(v); try { localStorage.setItem(RATE_KEY, String(v)) } catch { /* sin storage */ } }
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])
  const [capPct, setCapPct] = useState<number | null>(null)
  const [strCount, setStrCount] = useState(0)
  const [flexCount, setFlexCount] = useState(0)
  const [incToday, setIncToday] = useState(0)

  useEffect(() => {
    const today = todayDate()
    const monStr = getMonday(new Date()).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    ;(async () => {
      try {
        const [d, b, s, i] = await Promise.all([
          fetch(`/api/getDashboard?date=${today}`),
          fetch(`/api/getReports?type=billing&dateFrom=${today}&dateTo=${today}`),
          fetch(`/api/getSquads?weekStart=${monStr}`),
          fetch('/api/getReports?type=incidents'),
        ])
        if (d.ok) { const j = await d.json(); setCleanings(j.cleanings || []); setStats({ total: j.stats?.total || 0, done: j.stats?.done || 0, inProgress: j.stats?.inProgress || 0 }) }
        if (b.ok) { const j = await b.json(); setBilling(j.summary || null); setBills(j.cleanings || []) }
        if (s.ok) {
          const j = await s.json(); const squads = j.squads || []; const blocks = j.blocks || []
          if (squads.length > 0) {
            const total = squads.reduce((sum: number, sq: any) => sum + ((sq.endHour - sq.startHour) || 8), 0) * 7
            const toMin = (t: string) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m }
            const used = blocks.reduce((sum: number, bl: any) => sum + Math.max(0, (toMin(bl.endTime) - toMin(bl.startTime)) / 60), 0)
            setCapPct(total > 0 ? Math.round((used / total) * 100) : 0)
            setStrCount(blocks.filter((bl: any) => bl.type === 'STR' || bl.type === 'Appointment').length)
            setFlexCount(blocks.filter((bl: any) => bl.type !== 'STR' && bl.type !== 'Appointment').length)
          }
        }
        if (i.ok) {
          const inc = await i.json()
          setIncToday((inc || []).filter((x: any) => x.creationDate && new Date(x.creationDate).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) === today).length)
        }
      } catch {}
      finally { setLoading(false) }
    })()
  }, [])

  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'
  const list = [...cleanings].sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''))
  const fmtDur = (c: Cl) => {
    if (!c.startTime) return '—'
    const end = c.endTime ? new Date(c.endTime).getTime() : now
    const m = Math.max(0, Math.round((end - new Date(c.startTime).getTime()) / 60000))
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m${c.endTime ? '' : ' ⏱'}`
  }
  const billOf = (id: string) => bills.find(b => b.id === id)
  const rateNow = rate
  const laborOf = (c: Cl): number | null => {
    if (!c.startTime) return null
    const end = c.endTime ? new Date(c.endTime).getTime() : now
    return rateNow * Math.max(1, billOf(c.id)?.staffCount || 1) * Math.max(0, (end - new Date(c.startTime).getTime()) / 3600000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
        <div style={{ ...card, borderColor: '#C7D2FE', background: 'linear-gradient(180deg,#EEF0FF,#fff)' }}>
          <p style={lbl}>Generado hoy</p>
          <p style={big}>{loading ? '…' : money(billing?.totalRevenue || 0)}</p>
          <p style={{ fontSize: 12, color: C.green, fontWeight: 500 }}>{stats.done} de {stats.total} limpiezas terminadas</p>
          <div style={{ height: 8, borderRadius: 99, background: '#E2E8F0', margin: '8px 0 6px', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: C.primary }} /></div>
          <p style={lbl}>{stats.inProgress} en curso</p>
        </div>
        <div style={card}>
          <p style={lbl}>Alertas de hoy</p>
          <p style={{ ...big, color: incToday > 0 ? C.amber : C.ink }}>{loading ? '…' : incToday}</p>
          <p style={{ fontSize: 12, color: '#64748B' }}>incidentes reportados hoy</p>
        </div>
        <div style={card}>
          <p style={lbl}>Capacidad de la semana</p>
          <p style={big}>{capPct === null ? '—' : `${capPct}%`}</p>
          <div style={{ height: 8, borderRadius: 99, background: '#E2E8F0', margin: '6px 0', overflow: 'hidden' }}><div style={{ width: `${Math.min(capPct || 0, 100)}%`, height: '100%', background: C.primary }} /></div>
          <p style={lbl}>Bloques STR: {strCount} · Flex / otros: {flexCount}</p>
        </div>
        <div style={card}>
          <p style={lbl}>Cobros de hoy</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}><span style={lbl}>Por cobrar</span><b style={{ color: C.amber }}>{money(billing?.unpaidAmount || 0)}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={lbl}>Facturado</span><b style={{ color: C.ink }}>{money(billing?.invoicedAmount || 0)}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={lbl}>Cobrado</span><b style={{ color: C.green }}>{money(billing?.paidAmount || 0)}</b></div>
        </div>
        {extraCard}
      </div>

      {kpis}

      <LaborChart cleanings={cleanings} bills={bills} now={now} loading={loading} rate={rate} saveRate={saveRate} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, alignItems: 'start' }}>
      <div style={{ ...card, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Limpiezas de hoy · {list.length}</p>
          {onRefresh && <button onClick={onRefresh} style={{ fontSize: 12, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Actualizar</button>}
        </div>
        {loading ? <p style={{ fontSize: 13, color: C.muted }}>Cargando…</p> : list.length === 0 ? <p style={{ fontSize: 13, color: C.muted }}>No hay limpiezas para hoy.</p> : (
          <div style={{ maxHeight: 440, overflowY: 'auto', overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1.6fr) minmax(90px,1fr) 62px 62px 84px 74px 86px', gap: 8, padding: '6px 0', fontSize: 11, color: C.muted, fontWeight: 600, position: 'sticky', top: 0, background: C.white, borderBottom: `1px solid ${C.border}`, minWidth: 600 }}>
              <span>Casa</span><span>Cleaners</span><span style={{ textAlign: 'right' }}>Programada</span><span style={{ textAlign: 'right' }}>Inició</span><span style={{ textAlign: 'right' }}>Duración</span><span style={{ textAlign: 'right' }}>Labor</span><span style={{ textAlign: 'right' }}>Estado</span>
            </div>
            {list.map(c => {
              const st = STATUS[c.status] || { t: 'Programada', bg: '#F1F5F9', fg: '#475569' }
              const unassigned = !c.staffListText || c.staffListText === 'Sin asignar'
              const b = billOf(c.id)
              return (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1.6fr) minmax(90px,1fr) 62px 62px 84px 74px 86px', gap: 8, alignItems: 'center', padding: '7px 0', borderTop: '1px solid #F1F5F9', fontSize: 13, minWidth: 600 }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ display: 'block', color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.propertyText || 'Sin nombre'}</b>
                    {b?.price ? <span style={{ fontSize: 11, color: C.muted }}>{money(b.price)}</span> : null}
                  </div>
                  <span style={{ color: unassigned ? C.amber : '#64748B', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unassigned ? 'Sin asignar' : c.staffListText}</span>
                  <span style={{ color: '#64748B', fontSize: 12, textAlign: 'right' }}>{fmtTime(c.scheduledTime)}</span>
                  <span style={{ color: c.startTime ? C.ink : C.muted, fontSize: 12, textAlign: 'right' }}>{fmtTime(c.startTime || null)}</span>
                  <span style={{ color: c.endTime ? C.green : c.startTime ? C.primary : C.muted, fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{fmtDur(c)}</span>
                  <span style={{ textAlign: 'right', fontSize: 12, color: C.slate }} title="tarifa × cleaners × horas">{laborOf(c) == null ? '—' : money(laborOf(c) as number)}</span>
                  <span style={{ textAlign: 'right' }}><span style={{ background: st.bg, color: st.fg, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.t}</span></span>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {week}
      </div>
    </div>
  )
}

// ── Ingreso acumulado vs costo de labor (hoy) ────────────────────────────────
const etHour = (ms: number) => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date(ms))
  const h = Number(p.find(x => x.type === 'hour')?.value) % 24, m = Number(p.find(x => x.type === 'minute')?.value)
  return h + m / 60
}
const RATE_KEY = 'shineup-labor-rate'
const readRate = () => { try { return Number(localStorage.getItem(RATE_KEY)) || 18 } catch { return 18 } }

function LaborChart({ cleanings, bills, now, loading, rate, saveRate }: { cleanings: Cl[]; bills: Bl[]; now: number; loading: boolean; rate: number; saveRate: (v: number) => void }) {

  const d = useMemo(() => {
    const nowH = etHour(now)
    const jobs = cleanings.filter(c => c.startTime).map(c => {
      const b = bills.find(x => x.id === c.id)
      return { s: etHour(new Date(c.startTime as string).getTime()), e: c.endTime ? etHour(new Date(c.endTime).getTime()) : nowH, done: !!c.endTime, price: b?.price || 0, n: Math.max(1, b?.staffCount || 1) }
    })
    if (!jobs.length) return null
    const target = cleanings.reduce((t, c) => t + (bills.find(x => x.id === c.id)?.price || 0), 0)
    // Eje: desde la primera hora trabajada hasta las 10pm como mínimo (crece si se trabaja más tarde)
    const x0 = Math.max(0, Math.min(6, Math.floor(Math.min(...jobs.map(j => j.s))))), x1 = Math.max(22, Math.ceil(Math.max(nowH, ...jobs.map(j => j.e))))
    const revAt = (t: number) => jobs.reduce((a, j) => a + (j.done && j.e <= t ? j.price : 0), 0)
    const costAt = (t: number) => jobs.reduce((a, j) => a + rate * j.n * Math.max(0, Math.min(t, j.e) - j.s), 0)
    const rev: [number, number][] = [], cost: [number, number][] = []
    for (let t = x0; t <= Math.min(x1, nowH) + 1e-9; t += 0.25) { rev.push([t, revAt(t)]); cost.push([t, costAt(t)]) }
    const hours = Array.from({ length: x1 - x0 }, (_, i) => { const a = x0 + i, b = Math.min(a + 1, nowH); return { h: a, rev: a >= nowH ? 0 : revAt(b) - revAt(a), cost: a >= nowH ? 0 : costAt(b) - costAt(a) } })
    const lastR = revAt(nowH), lastC = costAt(nowH)
    const cross = rev.find((p, i) => p[1] >= cost[i][1] && p[1] > 0)
    return { x0, x1, rev, cost, hours, target, lastR, lastC, cross: cross ? cross[0] : null, nowH }
  }, [cleanings, bills, now, rate])

  const W = 700, H = 240, pl = 48, pr = 96, pt = 14, pb = 24
  const body = (() => {
    if (loading) return <p style={{ fontSize: 13, color: C.muted }}>Cargando…</p>
    if (!d) return <p style={{ fontSize: 13, color: C.muted }}>Aún no hay limpiezas iniciadas hoy. La gráfica aparece cuando empiece la primera.</p>
    const ymax = Math.max(d.target, d.lastR, d.lastC, 50) * 1.08
    const plotR = W - pr
    const X = (t: number) => pl + ((t - d.x0) / (d.x1 - d.x0)) * (plotR - pl)
    const Y = (v: number) => pt + (1 - v / ymax) * (H - pt - pb)
    const path = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')
    const hl = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`
    const margin = d.lastR - d.lastC
    const bw = (plotR - pl) / (d.x1 - d.x0)
    const bx = plotR + 14, bwid = 26, base = H - pb
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 8 }}>
          <div><p style={lbl}>Ingreso (terminadas)</p><p style={{ ...big, fontSize: 22, color: C.primary }}>{money(d.lastR)}</p></div>
          <div><p style={lbl}>Labor hasta ahora</p><p style={{ ...big, fontSize: 22, color: C.red }}>{money(d.lastC)}</p></div>
          <div><p style={lbl}>Margen</p><p style={{ ...big, fontSize: 22, color: margin >= 0 ? C.green : C.red }}>{margin >= 0 ? '+' : '−'}{money(Math.abs(margin))}</p></div>
          <div><p style={lbl}>Meta del día</p><p style={{ ...big, fontSize: 22, color: C.slate }}>{money(d.target)}</p></div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', fontFamily: 'inherit' }}>
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
          {d.cross != null && <g><line x1={X(d.cross)} x2={X(d.cross)} y1={pt} y2={base} stroke={C.green} strokeDasharray="3 3" /><text x={X(d.cross) + 4} y={pt + 10} fontSize="10" fill={C.green} fontWeight="600">breakeven</text></g>}
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
        <p style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Ingreso vs labor · hoy</p>
        <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6 }}>
          Costo por hora de cleaner $
          <input type="number" min={0} step={0.5} value={rate} onChange={e => saveRate(Math.max(0, Number(e.target.value) || 0))} style={{ width: 64, padding: '3px 6px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: 'inherit' }} />
        </label>
      </div>
      {body}
      <p style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>Labor = tarifa × cleaners × horas trabajadas (desde que inicia cada limpieza). El ingreso cuenta cuando la limpieza termina. Tarifa única editable (aún no por persona).</p>
    </div>
  )
}
