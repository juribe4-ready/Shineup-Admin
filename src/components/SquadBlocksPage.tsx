import { useState, useEffect } from 'react'
import { CalendarClock, Plus, X, RefreshCw } from 'lucide-react'

const C = {
  primary: '#6366F1', primaryLight: '#EEF2FF',
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', greenLight: '#ECFDF5',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  red: '#EF4444', redLight: '#FEF2F2',
  teal: '#14B8A6',
}

interface Squad { id: string; name: string; color: string; type: string; startHour: number; endHour: number }
interface Block { id: string; squadId: string; date: string; startTime: string; endTime: string; type: string; notes: string }
interface Availability { date: string; available: boolean; residualHours: number; reason: string | null }

function getMonday(d: Date) {
  const dow = (d.getDay() + 6) % 7
  const m = new Date(d)
  m.setDate(d.getDate() - dow)
  return m
}

const emptyForm = { squadId: '', date: '', startTime: '08:00', endTime: '18:00', type: 'Manual Block', notes: '' }

export default function SquadBlocksPage() {
  const [squads, setSquads] = useState<Squad[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [strOnlyDays, setStrOnlyDays] = useState<number[]>([])
  const [strOnlyDates, setStrOnlyDates] = useState<string[]>([])
  const [availability, setAvailability] = useState<Record<string, Availability>>({})
  const [loadingAvail, setLoadingAvail] = useState(false)
  const [weekStart, setWeekStart] = useState(getMonday(new Date()).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2800) }

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const load = async () => {
    setLoading(true)
    try {
      const [squadRes, configRes] = await Promise.all([
        fetch(`/api/getSquads?weekStart=${weekStart}`),
        fetch('/api/getReports?type=tarsConfig'),
      ])
      if (squadRes.ok) {
        const d = await squadRes.json()
        setSquads(d.squads || [])
        setBlocks(d.blocks || [])
      }
      if (configRes.ok) {
        const c = await configRes.json()
        setStrOnlyDays(c.config?.strOnlyDays || [])
        setStrOnlyDates(c.config?.strOnlyDates || [])
      }
    } catch { showToast('Error loading data', 'err') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [weekStart])

  const loadAvailability = async () => {
    setLoadingAvail(true)
    try {
      const results = await Promise.all(
        dates.map(date =>
          fetch(`/api/getReports?type=availability&date=${date}&durationHours=2.5`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      )
      const map: Record<string, Availability> = {}
      results.forEach((r, i) => {
        if (r) map[dates[i]] = r
      })
      setAvailability(map)
    } finally { setLoadingAvail(false) }
  }

  useEffect(() => { loadAvailability() }, [weekStart])

  const shiftWeek = (dir: number) => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + dir * 7)
    setWeekStart(d.toISOString().split('T')[0])
  }

  const isStructuralSTR = (date: string) => {
    const dow = (new Date(date + 'T12:00:00').getDay() + 6) % 7
    return strOnlyDays.includes(dow) || strOnlyDates.includes(date)
  }

  const openCreate = (squadId?: string, date?: string) => {
    setForm({ ...emptyForm, squadId: squadId || squads[0]?.id || '', date: date || dates[0] })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.squadId || !form.date) { showToast('Squad and date required', 'err'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/createSquadBlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const d = await r.json()
      if (!r.ok) { showToast(d.error || 'Error creating block', 'err'); return }
      showToast('Block created')
      setShowForm(false)
      load()
      loadAvailability()
    } catch { showToast('Error creating block', 'err') }
    finally { setSaving(false) }
  }

  const handleDelete = async (blockId: string) => {
    try {
      await fetch('/api/deleteSquadBlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId })
      })
      setBlocks(prev => prev.filter(b => b.id !== blockId))
      showToast('Block deleted')
      loadAvailability()
    } catch { showToast('Error deleting', 'err') }
  }

  const fmtDay = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')
    return { short: d.toLocaleDateString('en-US', { weekday: 'short' }), num: d.getDate() }
  }

  return (
    <div style={{ maxWidth: 980, fontFamily: "'Inter', sans-serif" }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: toast.type === 'ok' ? C.ink : C.red, color: 'white', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CalendarClock style={{ width: 20, height: 20, color: C.primary }} />
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>Squad Blocks</p>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Structural calendar — recurring rules + manual overrides</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => shiftWeek(-1)} style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.white, cursor: 'pointer' }}>‹</button>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.slate, minWidth: 130, textAlign: 'center' }}>
            {dates[0]} – {dates[6]}
          </span>
          <button onClick={() => shiftWeek(1)} style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.white, cursor: 'pointer' }}>›</button>
          <button onClick={load} disabled={loading}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw style={{ width: 13, height: 13, color: C.muted }} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => openCreate()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', borderRadius: 9, border: 'none', background: `linear-gradient(135deg, ${C.primary} 0%, #4F46E5 100%)`, color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            <Plus style={{ width: 14, height: 14 }} /> Block
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 11.5, color: C.muted }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: C.amber, display: 'inline-block' }} /> STR-only (from Rules)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: C.teal, display: 'inline-block' }} /> Manual block</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: C.green, display: 'inline-block' }} /> Appointment</span>
      </div>

      {/* Empty squads state */}
      {!loading && squads.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 24px', background: C.bg, borderRadius: 16, border: `1px dashed ${C.border}` }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '0 0 4px' }}>No squads yet</p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Create squads in TARS Core → Squads before managing blocks.</p>
        </div>
      )}

      {/* Grid */}
      {squads.length > 0 && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(7, 1fr)', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ padding: '10px 14px', background: C.bg }} />
            {dates.map(date => {
              const { short, num } = fmtDay(date)
              const structural = isStructuralSTR(date)
              return (
                <div key={date} style={{ padding: '10px 8px', textAlign: 'center', background: structural ? C.amberLight : C.bg }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: structural ? C.amber : C.muted, textTransform: 'uppercase', margin: 0 }}>{short}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '2px 0 0' }}>{num}</p>
                </div>
              )
            })}
          </div>

          {/* Availability row — live from getAvailability, shows residual hours per day */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(7, 1fr)', borderBottom: `2px solid ${C.border}`, background: C.bg }}>
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.slate, margin: 0 }}>Disponibilidad</p>
            </div>
            {dates.map(date => {
              const avail = availability[date]
              if (loadingAvail && !avail) {
                return <div key={date} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>…</p>
                </div>
              }
              if (!avail) {
                return <div key={date} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: `1px solid ${C.border}` }} />
              }
              return (
                <div key={date} style={{ padding: '8px 6px', textAlign: 'center', borderLeft: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 11, fontWeight: 800, margin: 0, color: avail.available ? C.green : C.red }}>
                    {avail.available ? `${avail.residualHours}h libre` : 'Lleno'}
                  </p>
                  {!avail.available && avail.reason && (
                    <p style={{ fontSize: 8.5, color: C.muted, margin: '2px 0 0', lineHeight: 1.2 }}>{avail.reason}</p>
                  )}
                </div>
              )
            })}
          </div>

          {squads.map(squad => (
            <div key={squad.id} style={{ display: 'grid', gridTemplateColumns: '140px repeat(7, 1fr)', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderRight: `1px solid ${C.border}` }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: squad.color, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{squad.name}</p>
                  <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>{squad.type}</p>
                </div>
              </div>
              {dates.map(date => {
                const structural = isStructuralSTR(date)
                const dayBlocks = blocks.filter(b => b.squadId === squad.id && b.date === date)
                return (
                  <div key={date} onClick={() => openCreate(squad.id, date)}
                    style={{ padding: '6px', minHeight: 56, borderLeft: `1px solid ${C.border}`, background: structural ? '#FFFBEB' : C.white, cursor: 'pointer' }}>
                    {structural && dayBlocks.length === 0 && (
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: C.amber, textAlign: 'center', padding: '4px 0' }}>STR-only</div>
                    )}
                    {dayBlocks.map(b => (
                      <div key={b.id} onClick={e => e.stopPropagation()}
                        style={{ background: b.type === 'Appointment' ? C.greenLight : C.bg, border: `1px solid ${b.type === 'Appointment' ? C.green : C.teal}30`, borderRadius: 7, padding: '3px 6px', marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: b.type === 'Appointment' ? C.green : C.teal, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.startTime}–{b.endTime}
                        </span>
                        {b.type !== 'Appointment' && (
                          <button onClick={() => handleDelete(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                            <X style={{ width: 9, height: 9, color: C.muted }} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 }}>
          <div style={{ background: C.white, borderRadius: 18, padding: 24, width: 380, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>New block</p>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X style={{ width: 18, height: 18, color: C.muted }} />
              </button>
            </div>

            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Squad</p>
            <select value={form.squadId} onChange={e => setForm(f => ({ ...f, squadId: e.target.value }))}
              style={{ width: '100%', height: 40, padding: '0 10px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', marginBottom: 14, boxSizing: 'border-box' }}>
              {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</p>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', marginBottom: 14, boxSizing: 'border-box' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start</p>
                <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                  style={{ width: '100%', height: 40, padding: '0 10px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>End</p>
                <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                  style={{ width: '100%', height: 40, padding: '0 10px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {['Manual Block', 'Rest', 'Holiday Block', 'STR'].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                  style={{ flex: '1 0 auto', height: 34, padding: '0 10px', borderRadius: 9, border: `1.5px solid ${form.type === t ? C.primary : C.border}`, background: form.type === t ? C.primaryLight : C.white, color: form.type === t ? C.primary : C.muted, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                  {t}
                </button>
              ))}
            </div>

            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes (optional)</p>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. squad rest day"
              style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', marginBottom: 20, boxSizing: 'border-box' }} />

            <button onClick={handleSave} disabled={saving}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C.primary} 0%, #4F46E5 100%)`, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? <RefreshCw style={{ width: 14, height: 14 }} className="animate-spin" /> : <Plus style={{ width: 14, height: 14 }} />}
              Create block
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} .animate-spin{animation:spin 1s linear infinite}`}</style>
    </div>
  )
}
