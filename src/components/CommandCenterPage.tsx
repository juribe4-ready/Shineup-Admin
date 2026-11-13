import { useEffect, useMemo, useState } from 'react'
import CommandToday from './CommandToday'
import { squadTravel, fmtMin } from './travel'

const C = { primary: '#6366F1', ink: '#0F172A', slate: '#475569', muted: '#94A3B8', border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF', green: '#059669', red: '#DC2626', amber: '#B45309' }
const card: React.CSSProperties = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px' }
const sec: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '.05em', textTransform: 'uppercase', margin: '4px 2px -2px' }
const money = (n: number) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US')
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const addDays = (d: string, n: number) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA') }
const isoWeek = (d: string) => { const x = new Date(d + 'T12:00:00Z'); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day + 3); const y = x.getUTCFullYear(); const j = new Date(Date.UTC(y, 0, 4)); return 1 + Math.round(((x.getTime() - j.getTime()) / 86400000 - 3 + ((j.getUTCDay() + 6) % 7)) / 7) }

const jget = async (url: string) => { try { const r = await fetch(url); return r.ok ? await r.json() : null } catch { return null } }

export default function CommandCenterPage({ onNavigate }: { onNavigate?: (p: any) => void }) {
  const T = today()
  const [exec, setExec] = useState<any>(null)
  const [ret, setRet] = useState<{ v: number | null; base: number } | null>(null)
  const [day, setDay] = useState<any>(null)
  const [billDay, setBillDay] = useState<any>(null)
  const [owed, setOwed] = useState<any>(null)
  const [inc, setInc] = useState<number | null>(null)
  const [mg, setMg] = useState<any>(null)
  const [notion, setNotion] = useState<any>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [tick, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])

  // Todo en paralelo: la pantalla se pinta ya y cada bloque entra cuando llega su dato
  useEffect(() => {
    jget('/api/getDashboard?action=executive').then(setExec)
    jget(`/api/getDashboard?action=scorecard&from=${T}&to=${T}`).then(j => setRet({ v: j?.total?.retencion ?? null, base: j?.total?.retBase ?? 0 }))
    jget(`/api/getDashboard?date=${T}`).then(setDay)
    jget(`/api/getReports?type=billing&dateFrom=${T}&dateTo=${T}`).then(setBillDay)
    jget(`/api/getReports?type=billing&dateFrom=${addDays(T, -60)}&dateTo=${T}`).then(setOwed)
    { const x = new Date(T + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); const mon = x.toISOString().slice(0, 10); x.setUTCDate(x.getUTCDate() + 6)
      jget(`/api/getDashboard?action=reports&kind=margin&from=${mon}&to=${x.toISOString().slice(0, 10)}`).then(setMg) }
    jget('/api/getDashboard?action=notion').then(j => setNotion(j || { error: 'sin respuesta' }))
    jget('/api/getReports?type=incidents').then(j => setInc(Array.isArray(j) ? j.filter((x: any) => x.creationDate && new Date(x.creationDate).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) === T).length : null))
  }, [tick])

  const cleanings: any[] = day?.cleanings || []
  const shifts: any[] = day?.shifts || []
  const bills: any[] = billDay?.cleanings || []
  const revDone = bills.filter(b => b.status === 'Done').reduce((t, b) => t + (b.price || 0), 0)
  const revPlan = bills.reduce((t, b) => t + (b.price || 0), 0)
  const labor = shifts.reduce((t, s) => t + (s.rate || 0) * Math.max(0, ((s.end ? new Date(s.end).getTime() : now) - new Date(s.start).getTime()) / 3600000), 0)
  const shiftH = shifts.reduce((t, s) => t + Math.max(0, ((s.end ? new Date(s.end).getTime() : now) - new Date(s.start).getTime()) / 3600000), 0)
  const hasShifts = shifts.length > 0
  const doneN = cleanings.filter(c => c.status === 'Done').length
  const pctRev = revPlan > 0 ? Math.round(revDone / revPlan * 100) : 0

  const rows = useMemo(() => squadTravel(cleanings, now), [cleanings, now])
  const trips = rows.flatMap(r => r.trips); const travelMs = rows.reduce((t, r) => t + r.travelMs, 0)
  const avgTrip = trips.length ? travelMs / trips.length : null

  const late = cleanings.filter(c => {
    if (!c.scheduledTime) return false
    const sch = new Date(c.scheduledTime).getTime()
    if (c.startTime) return new Date(c.startTime).getTime() - sch > 15 * 60000
    return c.status !== 'Done' && now - sch > 15 * 60000
  })
  const noCleaners = cleanings.filter(c => !(c.laborStaff || []).length && c.status !== 'Done')
  const e = exec?.current
  const rev = e?.revHH ?? null
  const util = e?.hhDisponibles ? Math.round(e.hhProgramadas / e.hhDisponibles * 100) : null
  const cumpl = e?.limpiezasTotal ? Math.round(e.limpiezasDone / e.limpiezasTotal * 100) : null
  const onTime = e?.onTimeRate ?? null
  const tone = (v: number | null, good: number, warn: number) => v === null ? { bg: C.white, bd: C.border, fg: C.muted } : v >= good ? { bg: '#F0FDF4', bd: '#BBF7D0', fg: '#047857' } : v >= warn ? { bg: '#FFFBEB', bd: '#FDE68A', fg: '#B45309' } : { bg: '#FEF2F2', bd: '#FECACA', fg: '#B91C1C' }
  const L = (v: any, f: (x: any) => string, ready: boolean) => !ready ? '…' : v === null || v === undefined ? '--' : f(v)

  const Bar = ({ pct, color }: { pct: number; color: string }) => <div style={{ height: 6, borderRadius: 6, background: '#EEF2F7', overflow: 'hidden', margin: '8px 0 4px' }}><div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: 6 }} /></div>
  const K = ({ label, value, sub, t }: { label: string; value: string; sub?: string; t: ReturnType<typeof tone> }) => (
    <div style={{ background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 12, padding: '10px 12px' }}>
      <p style={{ fontSize: 12, color: '#64748B' }}>{label}</p><p style={{ fontSize: 22, fontWeight: 700, color: t.fg, letterSpacing: '-0.02em' }}>{value}</p>{sub && <p style={{ fontSize: 11, color: C.muted }}>{sub}</p>}
    </div>
  )
  const go = (p: string) => onNavigate && onNavigate(p)
  const link: React.CSSProperties = { fontSize: 11, color: C.primary, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontWeight: 600 }
  const dayReady = !!day, billReady = !!billDay

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: '#64748B' }}>Hoy {new Date(T + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} · semana W{isoWeek(T)}</span>
        <button onClick={() => setTick(t => t + 1)} style={{ ...link, marginLeft: 'auto' }}>Actualizar</button>
      </div>

      <p style={sec}>1 · Hoy — avance del día</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div style={card}><p style={{ fontSize: 12, color: '#64748B' }}>Ingreso</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: C.primary, letterSpacing: '-0.02em' }}>{billReady ? money(revDone) : '…'} <span style={{ fontSize: 14, fontWeight: 500, color: C.muted }}>de {billReady ? money(revPlan) : '…'}</span></p>
          <Bar pct={pctRev} color={C.primary} /><p style={{ fontSize: 11, color: C.muted }}>{pctRev}% · {doneN} de {cleanings.length} terminadas</p></div>
        <div style={card}><p style={{ fontSize: 12, color: '#64748B' }}>Labor</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: C.red, letterSpacing: '-0.02em' }}>{dayReady ? (hasShifts ? money(labor) : '—') : '…'}</p>
          <Bar pct={revDone > 0 && hasShifts ? labor / revDone * 100 : 0} color={C.red} /><p style={{ fontSize: 11, color: C.muted }}>{hasShifts ? `${shiftH.toFixed(1)} h de turno · ${revDone > 0 ? Math.round(labor / revDone * 100) : 0}% del ingreso` : 'sin turnos registrados hoy'}</p></div>
        <div style={card}><p style={{ fontSize: 12, color: '#64748B' }}>Margen</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: revDone - labor >= 0 ? C.green : C.red, letterSpacing: '-0.02em' }}>{dayReady && billReady ? (hasShifts ? (revDone - labor >= 0 ? '+' : '') + money(revDone - labor) : '—') : '…'}</p>
          <Bar pct={revDone > 0 && hasShifts ? (revDone - labor) / revDone * 100 : 0} color={C.green} /><p style={{ fontSize: 11, color: C.muted }}>{hasShifts && shiftH > 0 ? `$${Math.round((revDone - labor) / shiftH)}/h por hora de turno` : 'ingreso − labor'}</p></div>
        <div style={card}><p style={{ fontSize: 12, color: '#64748B' }}>Traslados entre casas</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: avgTrip === null ? C.muted : avgTrip > 15 * 60000 ? C.red : avgTrip > 8 * 60000 ? C.amber : C.green, letterSpacing: '-0.02em' }}>{!dayReady ? '…' : avgTrip === null ? '—' : fmtMin(avgTrip)} <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>prom.</span></p>
          <Bar pct={avgTrip === null ? 0 : Math.min(100, (avgTrip / 60000) / 30 * 100)} color="#F59E0B" /><p style={{ fontSize: 11, color: C.muted }}>{trips.length} traslados · meta V/TO ~5 min · <button onClick={() => go('cco_monitoring')} style={link}>ver por squad →</button></p></div>
      </div>

      <p style={sec}>2 · Semana W{isoWeek(T)} — North Star y palancas</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <div style={{ background: '#1E293B', borderRadius: 14, padding: '14px 16px', color: 'white' }}>
          <p style={{ fontSize: 12, opacity: .75 }}>North Star · Revenue / HH</p>
          <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: '3px 0' }}>{L(rev, x => `$${Number(x).toFixed(2)}`, !!exec)}</p>
          <Bar pct={rev ? rev / 50 * 100 : 0} color="#818CF8" /><p style={{ fontSize: 11, color: '#FDE68A' }}>meta V/TO $50 por HH</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          <K label="Utilización" value={L(util, x => `${x}%`, !!exec)} sub="programado ÷ 48 h/cleaner" t={tone(util, 80, 70)} />
          <K label="On-time" value={L(onTime, x => `${x}%`, !!exec)} sub="≤ 15 min" t={tone(onTime, 90, 85)} />
          <K label="Cumplimiento" value={L(cumpl, x => `${x}%`, !!exec)} sub="terminadas ÷ programadas" t={tone(cumpl, 95, 90)} />
          <K label="Returning" value={L(ret?.v ?? null, x => `${x}%`, ret !== null)} sub={ret && ret.v === null ? 'pocos clientes en la base' : 'real, 90d→30d'} t={tone(ret?.v ?? null, 70, 60)} />
        </div>
      </div>
      <button onClick={() => go('scorecard')} style={{ ...link, alignSelf: 'flex-start' }}>Ver el Scorecard completo →</button>
      <div style={{ ...card, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div><p style={{ fontSize: 12, color: '#64748B' }}>Margen de la semana</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: C.green, letterSpacing: '-0.02em' }}>{mg?.total ? money(mg.total.margen) : '…'}</p></div>
        <p style={{ fontSize: 12, color: C.muted, flex: 1 }}>{mg?.total ? `${mg.total.mgPct ?? '—'}% de margen · ${mg.total.limpiezas} limpiezas` : ''}{mg?.prevTotal ? ` · semana pasada ${money(mg.prevTotal.margen)}` : ''}</p>
        <button onClick={() => go('earn_stats')} style={link}>Ver Reports →</button>
      </div>

      <p style={sec}>3 · Atención — lo que necesita una decisión</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={card}><p style={{ fontSize: 12, color: '#64748B' }}>Por cobrar (últimos 60 días)</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: C.amber, letterSpacing: '-0.02em' }}>{owed ? money(owed.summary?.unpaidAmount || 0) : '…'}</p>
          <p style={{ fontSize: 11, color: C.muted }}>{owed ? `${owed.summary?.unpaidCount || 0} limpiezas sin facturar · ${money((owed.summary?.invoicedAmount || 0) + (owed.summary?.overdueAmount || 0))} facturado sin cobrar` : ''} <button onClick={() => go('earn_billing')} style={link}>ir a Billing →</button></p></div>
        <div style={card}><p style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>Alertas de hoy</p>
          {!dayReady ? <p style={{ fontSize: 12, color: C.muted }}>…</p> : (late.length + noCleaners.length + (inc || 0) === 0) ? <p style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>Todo en orden</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {late.slice(0, 3).map(c => <span key={c.id} style={{ fontSize: 11, fontWeight: 700, background: '#FEE2E2', color: '#991B1B', borderRadius: 99, padding: '2px 10px', alignSelf: 'flex-start' }}>{c.propertyText} · tarde</span>)}
              {late.length > 3 && <span style={{ fontSize: 11, color: C.muted }}>+{late.length - 3} más con retraso</span>}
              {noCleaners.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#92400E', borderRadius: 99, padding: '2px 10px', alignSelf: 'flex-start' }}>{noCleaners.length} sin cleaners asignados</span>}
              {!!inc && <span style={{ fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#92400E', borderRadius: 99, padding: '2px 10px', alignSelf: 'flex-start' }}>{inc} incidente{inc > 1 ? 's' : ''} hoy</span>}
            </div>
          )}</div>
        <div style={card}><p style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>Rocks / Issues <span style={{ color: C.muted }}>(Notion)</span></p>
          {!notion ? <p style={{ fontSize: 12, color: C.muted }}>…</p> : notion.error ? <p style={{ fontSize: 12, color: C.amber }}>{notion.error}</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(notion.rocks || []).slice(0, 4).map((r: any) => (
                <div key={r.id} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ flex: 1, color: C.ink }}>{r.title}</span>
                  {r.pct !== null && <b style={{ color: C.slate }}>{Math.round(r.pct <= 1 ? r.pct * 100 : r.pct)}%</b>}
                  <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 8px', background: r.state === 'Off Track' ? '#FEE2E2' : '#DBEAFE', color: r.state === 'Off Track' ? '#991B1B' : '#1D4ED8' }}>{r.state || '—'}</span>
                </div>
              ))}
              {(notion.rocks || []).length === 0 && <p style={{ fontSize: 12, color: C.muted }}>Sin Rocks activos</p>}
              <p style={{ fontSize: 12, color: C.slate, borderTop: '1px solid #F1F5F9', paddingTop: 6 }}><b>{(notion.issues || []).length}</b> issues abiertos{(notion.issues || []).filter((i: any) => i.prioridad === 'Alta').length ? ` · ${(notion.issues || []).filter((i: any) => i.prioridad === 'Alta').length} de prioridad alta` : ''}</p>
              {(notion.issues || []).filter((i: any) => i.prioridad === 'Alta').slice(0, 3).map((i: any) => <span key={i.id} style={{ fontSize: 11, color: C.ink }}>• {i.name}</span>)}
            </div>
          )}</div>
      </div>

      <button onClick={() => setShowDetail(v => !v)} style={{ ...card, textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.ink }}>{showDetail ? '▾' : '▸'} Detalle por periodo (Día · Semana · Mes · YTD) <span style={{ fontWeight: 400, color: C.muted }}>— ingreso vs labor, limpiezas y horas de turno</span></button>
      {showDetail && <CommandToday onRefresh={() => setTick(t => t + 1)} />}

      <button onClick={() => setShowDebug(v => !v)} style={{ ...link, alignSelf: 'flex-start', color: C.slate }}>{showDebug ? '▾' : '▸'} Debug</button>
      {showDebug && <pre style={{ background: C.ink, color: '#E2E8F0', padding: 12, borderRadius: 10, fontSize: 12, overflowX: 'auto' }}>{JSON.stringify({ hoy: T, limpiezasHoy: cleanings.length, turnosHoy: shifts.length, precios: bills.length, traslados: trips.length, tardes: late.length, semana: e ? { hhReales: e.hhReales, hhProgramadas: e.hhProgramadas, hhDisponibles: e.hhDisponibles, cleaners: e.cleanersUnicos, revHH: e.revHH } : null, retencionBase: ret?.base }, null, 2)}</pre>}
    </div>
  )
}
