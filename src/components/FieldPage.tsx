import { useCallback, useEffect, useMemo, useState } from 'react'
import { splitShift, fmtH, TRAVEL_CAP_MIN } from './splitTime'

const C = { primary: '#6366F1', ink: '#0F172A', slate: '#475569', muted: '#94A3B8', border: '#E2E8F0', white: '#FFFFFF', green: '#059669', red: '#DC2626', amber: '#B45309' }
const card: React.CSSProperties = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px' }
const lbl: React.CSSProperties = { fontSize: 12, color: '#64748B', fontWeight: 500 }
const big: React.CSSProperties = { fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, margin: '2px 0' }
const inp: React.CSSProperties = { padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }
const btn = (bg: string, fg = '#fff', bd = bg): React.CSSProperties => ({ background: bg, color: fg, border: `1px solid ${bd}`, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' })

const todayET = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const shiftDay = (d: string, n: number) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA') }
const money = (n: number) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const toHm = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const fromHm = (date: string, hm: string) => new Date(`${date}T${hm}:00`).toISOString()
const fmtT = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'
const isCleaner = (role: string) => role.toLowerCase().includes('cleaner')

interface Sh { id: string; staffId: string | null; name: string; role: string; rate: number | null; start: string | null; end: string | null; closed: boolean; registeredBy: string; notes: string }
interface St { id: string; name: string; role: string; rate: number | null }
interface Cl { id: string; propertyText: string; startTime?: string | null; endTime?: string | null; laborStaff?: { id: string }[] }

export default function FieldPage({ by }: { by: string }) {
  const [date, setDate] = useState(todayET())
  const [shifts, setShifts] = useState<Sh[]>([])
  const [staff, setStaff] = useState<St[]>([])
  const [cleanings, setCleanings] = useState<Cl[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const [a, b] = await Promise.all([fetch(`/api/getDashboard?action=shiftsDay&date=${date}`), fetch(`/api/getDashboard?date=${date}`)])
      const ja = await a.json().catch(() => ({}))
      if (!a.ok) throw new Error(ja.error || `Error ${a.status}`)
      setShifts(ja.shifts || []); setStaff(ja.staff || [])
      if (b.ok) { const jb = await b.json(); setCleanings(jb.cleanings || []) } else setCleanings([])
    } catch (e: any) { setErr(e.message || 'No se pudo cargar') } finally { setLoading(false) }
  }, [date])
  useEffect(() => { load() }, [load])

  const isToday = date === todayET()
  const endOfDay = new Date(`${date}T23:59:59`).getTime()
  const ref = isToday ? now : endOfDay

  const rows = useMemo(() => shifts.map(s => {
    const startMs = s.start ? new Date(s.start).getTime() : 0
    const endMs = s.end ? new Date(s.end).getTime() : Math.max(startMs, Math.min(ref, endOfDay))
    const iv = cleanings.filter(c => c.startTime && (c.laborStaff || []).some(p => p.id === s.staffId)).map(c => ({ s: new Date(c.startTime as string).getTime(), e: c.endTime ? new Date(c.endTime).getTime() : ref }))
    const sp = splitShift(startMs, endMs, iv)
    const counts = isCleaner(s.role)
    const cost = counts && s.rate != null ? (s.rate * sp.total) / 3600000 : null
    return { s, sp, counts, cost, open: !s.end }
  }), [shifts, cleanings, ref, endOfDay])

  const tot = rows.filter(r => r.counts).reduce((t, r) => ({ total: t.total + r.sp.total, clean: t.clean + r.sp.clean, travel: t.travel + r.sp.travel, dead: t.dead + r.sp.dead, cost: t.cost + (r.cost || 0) }), { total: 0, clean: 0, travel: 0, dead: 0, cost: 0 })
  const noRate = rows.filter(r => r.counts && r.s.rate == null).map(r => r.s.name)

  async function post(action: string, body: any) {
    const r = await fetch(`/api/getDashboard?action=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, by }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || `Error ${r.status}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button style={btn('#fff', C.slate, C.border)} onClick={() => setDate(shiftDay(date, -1))}>‹</button>
        <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} style={inp} />
        <button style={btn('#fff', C.slate, C.border)} onClick={() => setDate(shiftDay(date, 1))}>›</button>
        {!isToday && <button style={btn('#EEF0FF', C.primary, '#C7D2FE')} onClick={() => setDate(todayET())}>Hoy</button>}
        <span style={{ ...lbl, marginLeft: 6 }}>{new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <button style={{ ...btn('#fff', C.primary, C.border), marginLeft: 'auto' }} onClick={load}>Actualizar</button>
      </div>

      {err && <div style={{ ...card, borderColor: '#FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div style={card}><p style={lbl}>Cleaners con turno</p><p style={big}>{rows.filter(r => r.counts).length}</p></div>
        <div style={card}><p style={lbl}>Horas de turno</p><p style={big}>{fmtH(tot.total)}</p></div>
        <div style={card}><p style={lbl}>Costo de labor</p><p style={{ ...big, color: C.red }}>{money(tot.cost)}</p></div>
        <div style={card}><p style={lbl}><b style={{ color: C.primary }}>●</b> Limpiando</p><p style={big}>{fmtH(tot.clean)}</p></div>
        <div style={card}><p style={lbl}><b style={{ color: '#F59E0B' }}>●</b> Traslado</p><p style={big}>{fmtH(tot.travel)}</p></div>
        <div style={card}><p style={lbl}><b style={{ color: C.muted }}>●</b> Tiempo muerto</p><p style={big}>{fmtH(tot.dead)}</p></div>
      </div>

      <div style={{ ...card, padding: '12px 16px' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Turnos del día · {rows.length}</p>
        {loading ? <p style={{ fontSize: 13, color: C.muted }}>Cargando…</p> : rows.length === 0 ? <p style={{ fontSize: 13, color: C.muted }}>No hay turnos registrados este día. Puedes agregar uno abajo.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 760 }}>
              <div style={{ ...grid, fontSize: 11, color: C.muted, fontWeight: 600, borderBottom: `1px solid ${C.border}`, padding: '4px 0' }}>
                <span>Persona</span><span style={r_}>Entrada</span><span style={r_}>Salida</span><span style={r_}>Turno</span><span style={r_}>Limpiando</span><span style={r_}>Traslado</span><span style={r_}>Muerto</span><span style={r_}>Costo</span><span />
              </div>
              {rows.map(r => (
                <div key={r.s.id}>
                  <div style={{ ...grid, fontSize: 13, borderTop: '1px solid #F1F5F9', padding: '7px 0', opacity: r.counts ? 1 : 0.6 }}>
                    <span style={{ minWidth: 0 }}>
                      <b style={{ color: C.ink }}>{r.s.name}</b> {r.s.closed ? '🔒' : <span style={{ color: C.green, fontSize: 11 }}>⏱ en turno</span>}
                      <span style={{ display: 'block', fontSize: 10, color: C.muted }}>{r.s.role || 'sin rol'}{!r.counts ? ' · no cuenta en costos' : r.s.rate == null ? ' · sin Cost/Hour' : ` · ${money(r.s.rate)}/h`}</span>
                    </span>
                    <span style={r_}>{fmtT(r.s.start)}</span><span style={r_}>{r.s.end ? fmtT(r.s.end) : '—'}</span>
                    <span style={{ ...r_, fontWeight: 600 }}>{fmtH(r.sp.total)}</span><span style={r_}>{fmtH(r.sp.clean)}</span><span style={r_}>{fmtH(r.sp.travel)}</span><span style={r_}>{fmtH(r.sp.dead)}</span>
                    <span style={{ ...r_, fontWeight: 600 }}>{r.cost == null ? '—' : money(r.cost)}</span>
                    <span style={r_}><button style={btn('#fff', C.primary, C.border)} onClick={() => setEdit(edit === r.s.id ? null : r.s.id)}>{edit === r.s.id ? 'Cerrar' : 'Editar'}</button></span>
                  </div>
                  {edit === r.s.id && <EditRow s={r.s} date={date} onSave={async (start, end, closed) => { try { await post('shiftSave', { id: r.s.id, start, end, closed, notes: r.s.notes }); setEdit(null); await load() } catch (e: any) { setErr(e.message) } }} />}
                </div>
              ))}
            </div>
          </div>
        )}
        <p style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>Costo = Cost/Hour × horas de turno (solo cleaners). Traslado = hueco entre limpiezas hasta {TRAVEL_CAP_MIN} min; lo que exceda es tiempo muerto.{noRate.length ? ` Sin Cost/Hour: ${noRate.join(', ')}.` : ''}</p>
      </div>

      <AddShift date={date} staff={staff.filter(s => isCleaner(s.role) && !shifts.some(x => x.staffId === s.id))} onAdd={async (staffId, name, start, end) => { try { await post('shiftAdd', { date, staffId, label: name.split(' ')[0], start, end }); await load() } catch (e: any) { setErr(e.message) } }} />
    </div>
  )
}

const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1.6fr .7fr .7fr .7fr .8fr .8fr .7fr .7fr 70px', gap: 8, alignItems: 'center' }
const r_: React.CSSProperties = { textAlign: 'right' }

function EditRow({ s, date, onSave }: { s: Sh; date: string; onSave: (start: string, end: string | null, closed: boolean) => Promise<void> }) {
  const [a, setA] = useState(toHm(s.start)); const [b, setB] = useState(toHm(s.end)); const [busy, setBusy] = useState(false)
  const bad = !!b && fromHm(date, b) < fromHm(date, a)
  const run = async (end: string | null, closed: boolean) => { setBusy(true); await onSave(fromHm(date, a), end ? fromHm(date, end) : null, closed); setBusy(false) }
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 10px', margin: '2px 0 6px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={lbl}>Entrada <input type="time" value={a} onChange={e => setA(e.target.value)} style={inp} /></label>
      <label style={lbl}>Salida <input type="time" value={b} onChange={e => setB(e.target.value)} style={inp} /></label>
      {bad && <span style={{ fontSize: 12, color: C.red }}>La salida es antes de la entrada</span>}
      <button disabled={busy || bad || !a} style={btn(C.primary)} onClick={() => run(b || null, !!b && s.closed)}>Guardar horas</button>
      {!s.closed && <button disabled={busy || bad || !a || !b} style={btn(C.red)} onClick={() => run(b, true)}>Marcar terminado</button>}
      {(s.closed || s.end) && <button disabled={busy} style={btn('#fff', C.slate, C.border)} onClick={() => run(null, false)}>Reabrir (quita salida)</button>}
      {s.notes && <span style={{ fontSize: 10, color: C.muted, whiteSpace: 'pre-line', flexBasis: '100%' }}>{s.notes}</span>}
    </div>
  )
}

function AddShift({ date, staff, onAdd }: { date: string; staff: St[]; onAdd: (id: string, name: string, start: string, end: string | null) => Promise<void> }) {
  const [id, setId] = useState(''); const [a, setA] = useState('08:00'); const [b, setB] = useState(''); const [busy, setBusy] = useState(false)
  if (!staff.length) return null
  const bad = !!b && fromHm(date, b) < fromHm(date, a)
  return (
    <div style={{ ...card, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <b style={{ fontSize: 13, color: C.ink }}>Agregar turno</b>
      <select value={id} onChange={e => setId(e.target.value)} style={inp}><option value="">Cleaner…</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <label style={lbl}>Entrada <input type="time" value={a} onChange={e => setA(e.target.value)} style={inp} /></label>
      <label style={lbl}>Salida (opcional) <input type="time" value={b} onChange={e => setB(e.target.value)} style={inp} /></label>
      <button disabled={busy || !id || !a || bad} style={btn(C.primary)} onClick={async () => { setBusy(true); await onAdd(id, staff.find(s => s.id === id)?.name || '', fromHm(date, a), b ? fromHm(date, b) : null); setBusy(false); setId(''); setB('') }}>Agregar</button>
    </div>
  )
}
