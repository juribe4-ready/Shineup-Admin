import { useCallback, useEffect, useMemo, useState } from 'react'

const C = { primary: '#6366F1', ink: '#0F172A', slate: '#475569', muted: '#94A3B8', border: '#E2E8F0', white: '#FFFFFF', green: '#059669', red: '#DC2626', amber: '#B45309' }
const card: React.CSSProperties = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px' }
const lbl: React.CSSProperties = { fontSize: 12, color: '#64748B', fontWeight: 500 }
const big: React.CSSProperties = { fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, margin: '2px 0' }
const inp: React.CSSProperties = { padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }
const btn = (bg: string, fg = '#fff', bd = bg): React.CSSProperties => ({ background: bg, color: fg, border: `1px solid ${bd}`, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' })

const todayET = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const addDays = (d: string, n: number) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA') }
const mondayOf = (d: string) => { const x = new Date(d + 'T12:00:00'); const wd = (x.getDay() + 6) % 7; return addDays(d, -wd) }
const money = (n: number) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const hm = (ms: number) => { const m = Math.round(ms / 60000); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` }
const hmShort = (ms: number) => { const m = Math.round(ms / 60000); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}` }
const toHm = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const fromHm = (date: string, t: string) => new Date(`${date}T${t}:00`).toISOString()
const fmtT = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'
const isCleaner = (role: string) => role.toLowerCase().includes('cleaner')
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

interface Sh { id: string; staffId: string | null; name: string; role: string; rate: number | null; date: string; start: string | null; end: string | null; closed: boolean; notes: string }

export default function WeekPayPage({ by }: { by: string }) {
  const [monday, setMonday] = useState(mondayOf(todayET()))
  const [shifts, setShifts] = useState<Sh[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [edit, setEdit] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])
  const sunday = addDays(monday, 6)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const today = todayET()

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const r = await fetch(`/api/getDashboard?action=shiftsRange&from=${monday}&to=${sunday}`)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `Error ${r.status}`)
      setShifts(j.shifts || [])
    } catch (e: any) { setErr(e.message || 'No se pudo cargar') } finally { setLoading(false) }
  }, [monday, sunday])
  useEffect(() => { load() }, [load])

  async function save(s: Sh, start: string, end: string | null, closed: boolean) {
    try {
      setEdit(null)
      const r = await fetch('/api/getDashboard?action=shiftSave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, start, end, closed, notes: s.notes, by }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `Error ${r.status}`)
      await load()
    } catch (e: any) { setErr(e.message); load() }
  }

  // Milisegundos de un turno: abierto hoy = hasta ahora; abierto de un día pasado = 0 (se marca "sin cerrar")
  const msOf = (s: Sh) => {
    const st = s.start ? Date.parse(s.start) : 0
    if (s.end) return Math.max(0, Date.parse(s.end) - st)
    return s.date === today ? Math.max(0, now - st) : 0
  }

  const people = useMemo(() => {
    const m = new Map<string, { id: string; name: string; rate: number; shifts: Sh[]; perDay: Record<string, number>; ms: number; unclosed: number }>()
    for (const s of shifts) {
      if (!s.staffId || !isCleaner(s.role)) continue
      const p = m.get(s.staffId) || { id: s.staffId, name: s.name, rate: s.rate || 0, shifts: [], perDay: {}, ms: 0, unclosed: 0 }
      p.shifts.push(s)
      const ms = msOf(s)
      p.perDay[s.date] = (p.perDay[s.date] || 0) + ms
      p.ms += ms
      if (!s.end) p.unclosed += 1
      m.set(s.staffId, p)
    }
    return [...m.values()].map(p => ({ ...p, pay: (p.ms / 3600000) * p.rate })).sort((a, b) => b.pay - a.pay || a.name.localeCompare(b.name))
    // eslint-disable-next-line
  }, [shifts, now])

  const tot = people.reduce((t, p) => ({ ms: t.ms + p.ms, pay: t.pay + p.pay, unclosed: t.unclosed + p.unclosed, noRate: t.noRate + (p.rate ? 0 : 1) }), { ms: 0, pay: 0, unclosed: 0, noRate: 0 })
  const label = `${new Date(monday + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${new Date(sunday + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`

  const copy = async () => {
    const lines = [`Pagos ${label}`, ...people.map(p => `${p.name}: ${hm(p.ms)} × $${p.rate}/h = ${money(p.pay)}`), `Total: ${hm(tot.ms)} · ${money(tot.pay)}`]
    try { await navigator.clipboard.writeText(lines.join('\n')) } catch { /* sin portapapeles */ }
  }
  const csv = () => {
    const rows = [['Cleaner', ...days, 'Horas', 'Tarifa', 'A pagar'], ...people.map(p => [p.name, ...days.map(d => ((p.perDay[d] || 0) / 3600000).toFixed(2)), (p.ms / 3600000).toFixed(2), String(p.rate), p.pay.toFixed(2)])]
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `pagos-${monday}.csv`; a.click()
  }

  const grid = '1.5fr repeat(7,.55fr) .8fr .6fr .85fr 24px'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button style={btn('#fff', C.slate, C.border)} onClick={() => setMonday(addDays(monday, -7))}>‹</button>
        <b style={{ fontSize: 14, color: C.ink }}>{label}</b>
        <button style={btn('#fff', C.slate, C.border)} onClick={() => setMonday(addDays(monday, 7))}>›</button>
        <button style={btn('#EEF0FF', C.primary, '#C7D2FE')} onClick={() => setMonday(mondayOf(today))}>Esta semana</button>
        <button style={btn('#EEF0FF', C.primary, '#C7D2FE')} onClick={() => setMonday(addDays(mondayOf(today), -7))}>Semana pasada</button>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={btn('#fff', C.primary, C.border)} onClick={load}>Actualizar</button>
          <button style={btn('#fff', C.slate, C.border)} onClick={copy}>Copiar resumen</button>
          <button style={btn(C.primary)} onClick={csv}>Descargar CSV</button>
        </span>
      </div>

      {err && <div style={{ ...card, borderColor: '#FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <div style={card}><p style={lbl}>Total a pagar</p><p style={{ ...big, color: C.green }}>{money(tot.pay)}</p></div>
        <div style={card}><p style={lbl}>Horas de turno</p><p style={big}>{hm(tot.ms)}</p></div>
        <div style={card}><p style={lbl}>Cleaners con turno</p><p style={big}>{people.length}</p></div>
        {(tot.unclosed > 0 || tot.noRate > 0) && (
          <div style={{ ...card, borderColor: '#FCD34D', background: '#FFFBEB' }}>
            <p style={{ ...lbl, color: '#92400E' }}>Revisar antes de pagar</p>
            <p style={{ fontSize: 12, color: '#92400E', marginTop: 4 }}>{tot.unclosed > 0 ? `${tot.unclosed} turno(s) sin cerrar` : ''}{tot.unclosed > 0 && tot.noRate > 0 ? ' · ' : ''}{tot.noRate > 0 ? `${tot.noRate} cleaner(s) sin tarifa` : ''}</p>
          </div>
        )}
      </div>

      <div style={card}>
        {loading ? <p style={{ fontSize: 13, color: C.muted }}>Cargando…</p> : people.length === 0 ? <p style={{ fontSize: 13, color: C.muted }}>No hay turnos registrados esta semana.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 900 }}>
              <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, fontSize: 11, color: C.muted, fontWeight: 600, borderBottom: `1px solid ${C.border}`, padding: '4px 0' }}>
                <span>Cleaner</span>{days.map((d, i) => <span key={d} style={{ textAlign: 'center' }}>{DOW[i]} {Number(d.slice(8))}</span>)}<span style={{ textAlign: 'right' }}>Horas</span><span style={{ textAlign: 'right' }}>Tarifa</span><span style={{ textAlign: 'right' }}>A pagar</span><span />
              </div>
              {people.map(p => (
                <div key={p.id}>
                  <div onClick={() => setOpen(open === p.id ? null : p.id)} style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, alignItems: 'center', fontSize: 13, borderTop: '1px solid #F1F5F9', padding: '9px 0', cursor: 'pointer', background: p.unclosed || !p.rate ? '#FFFDF5' : undefined }}>
                    <span><b style={{ color: C.ink }}>{p.name}</b>
                      {p.unclosed > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#92400E', borderRadius: 999, padding: '2px 8px' }}>{p.unclosed} sin cerrar</span>}
                      {!p.rate && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#92400E', borderRadius: 999, padding: '2px 8px' }}>sin tarifa</span>}
                    </span>
                    {days.map(d => { const ms = p.perDay[d]; const hasOpen = p.shifts.some(s => s.date === d && !s.end); return (
                      <span key={d} style={{ textAlign: 'center', fontWeight: 600, fontSize: 12, borderRadius: 6, padding: '3px 0', color: hasOpen ? '#92400E' : ms ? C.ink : '#CBD5E1', background: hasOpen ? '#FEF3C7' : undefined }}>{hasOpen && !ms ? (d === today ? 'en turno' : 'sin cerrar') : ms ? hmShort(ms) : '—'}</span>
                    ) })}
                    <span style={{ textAlign: 'right', fontWeight: 700 }}>{hm(p.ms)}</span>
                    <span style={{ textAlign: 'right', color: C.slate }}>{p.rate ? `$${p.rate}/h` : '—'}</span>
                    <span style={{ textAlign: 'right', fontWeight: 700 }}>{money(p.pay)}</span>
                    <span style={{ textAlign: 'right', color: C.muted }}>{open === p.id ? '⌃' : '⌄'}</span>
                  </div>
                  {open === p.id && (
                    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '8px 14px', margin: '2px 0 8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr .9fr .9fr .8fr .9fr 70px', gap: 8, fontSize: 11, color: C.muted, fontWeight: 600, padding: '2px 0 4px' }}>
                        <span>Día</span><span>Entrada</span><span>Salida</span><span style={{ textAlign: 'right' }}>Turno</span><span style={{ textAlign: 'right' }}>Monto</span><span />
                      </div>
                      {p.shifts.map(s => (
                        <div key={s.id}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr .9fr .9fr .8fr .9fr 70px', gap: 8, fontSize: 12, alignItems: 'center', borderTop: `1px solid ${C.border}`, padding: '6px 0' }}>
                            <span><b>{DOW[days.indexOf(s.date)]} {Number(s.date.slice(8))}</b> {s.closed ? '🔒' : ''}</span>
                            <span>{fmtT(s.start)}</span>
                            <span style={{ color: s.end ? C.ink : '#92400E', fontWeight: s.end ? 400 : 600 }}>{s.end ? fmtT(s.end) : s.date === today ? 'en turno' : 'sin cerrar'}</span>
                            <span style={{ textAlign: 'right', fontWeight: 600 }}>{hm(msOf(s))}</span>
                            <span style={{ textAlign: 'right', fontWeight: 600 }}>{money((msOf(s) / 3600000) * p.rate)}</span>
                            <span style={{ textAlign: 'right' }}><button style={btn('#fff', C.primary, C.border)} onClick={() => setEdit(edit === s.id ? null : s.id)}>{edit === s.id ? 'Cerrar' : 'Editar'}</button></span>
                          </div>
                          {edit === s.id && <EditRow s={s} onSave={(a, b, c) => save(s, a, b, c)} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, alignItems: 'center', borderTop: `2px solid ${C.border}`, padding: '10px 0', fontSize: 13 }}>
                <b>Total semana</b>{days.map(d => { const ms = people.reduce((t, p) => t + (p.perDay[d] || 0), 0); const pay = people.reduce((t, p) => t + ((p.perDay[d] || 0) / 3600000) * p.rate, 0); return <span key={d} style={{ textAlign: 'center', fontWeight: 700, fontSize: 12 }}>{ms ? hmShort(ms) : '—'}{ms ? <span style={{ display: 'block', fontWeight: 500, fontSize: 10, color: C.muted }}>{money(pay)}</span> : null}</span> })}
                <span style={{ textAlign: 'right', fontWeight: 700 }}>{hm(tot.ms)}</span><span /><span style={{ textAlign: 'right', fontWeight: 700, fontSize: 15 }}>{money(tot.pay)}</span><span />
              </div>
            </div>
          </div>
        )}
        <p style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>A pagar = todas las horas del turno (incluye traslado y tiempo muerto) × Cost/Hour de Staff. Un turno sin cerrar de días pasados cuenta 0h hasta que le pongas la salida con «Editar».</p>
      </div>
    </div>
  )
}

function EditRow({ s, onSave }: { s: Sh; onSave: (start: string, end: string | null, closed: boolean) => Promise<void> }) {
  const [a, setA] = useState(toHm(s.start)); const [b, setB] = useState(toHm(s.end)); const [busy, setBusy] = useState(false)
  const bad = !!b && fromHm(s.date, b) < fromHm(s.date, a)
  const run = async (end: string | null, closed: boolean) => { setBusy(true); await onSave(fromHm(s.date, a), end ? fromHm(s.date, end) : null, closed); setBusy(false) }
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', margin: '0 0 6px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
