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

// Same palette as Pre-dispatch, so a cleaning type reads the same color everywhere
const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Standard STR Turnover': { bg: '#ECFDF5', border: '#10B981', text: '#047857' },
  'Residential Cleaning':  { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8' },
  'Deep Clean':            { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  'Move Out/In':           { bg: '#FCE7F3', border: '#EC4899', text: '#BE185D' },
}
const DEFAULT_TYPE_COLOR = { bg: '#F1F5F9', border: '#94A3B8', text: '#475569' }
const colorForType = (type: string | null) => (type && TYPE_COLORS[type]) || DEFAULT_TYPE_COLOR

interface Squad { id: string; name: string; color: string; type: string; startHour: number; endHour: number; defaultMemberIds: string[] }
interface Block { id: string; squadId: string; date: string; startTime: string; endTime: string; type: string; notes: string; cleaningId: string | null }
interface Cleaning { id: string; cleaningType: string | null; price: number | null; laborMinutes: number | null; status: string }
interface RosterOverride { id: string; squadId: string; date: string; staffIds: string[]; notes: string }
interface StaffMember { id: string; name: string; initials: string }
interface Availability {
  date: string; available: boolean; residualHours: number; reason: string | null
  breakdown?: {
    totalCapacityHours: number; usedHours: number; totalFreeHours: number
    unassignedApptCount: number; unassignedApptHours: number; bufferPct: number
    perSquad: { squadId: string; capacityHours: number; freeHours: number; blockedCount: number }[]
  }
}

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
  const [cleanings, setCleanings] = useState<Cleaning[]>([])
  const [rosterOverrides, setRosterOverrides] = useState<RosterOverride[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [rosterEditor, setRosterEditor] = useState<{ squadId: string; date: string } | null>(null)
  const [rosterStaffIds, setRosterStaffIds] = useState<string[]>([])
  const [rosterSaving, setRosterSaving] = useState(false)
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
        setCleanings(d.cleanings || [])
        setRosterOverrides(d.rosterOverrides || [])
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

  // Staff list doesn't change per week — load once
  useEffect(() => {
    fetch('/api/getStaff').then(r => r.ok ? r.json() : []).then(d => setStaffList(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  // Resolution order: day-specific override for this squad+date, else the squad's Default Members
  const resolveRoster = (squadId: string, date: string) => {
    const override = rosterOverrides.find(o => o.squadId === squadId && o.date === date)
    if (override) return { staffIds: override.staffIds, isOverride: true }
    const squad = squads.find(s => s.id === squadId)
    return { staffIds: squad?.defaultMemberIds || [], isOverride: false }
  }

  const staffLabel = (ids: string[]) => {
    if (ids.length === 0) return null
    return ids.map(id => staffList.find(s => s.id === id)?.initials || staffList.find(s => s.id === id)?.name?.slice(0, 2).toUpperCase() || '?').join(', ')
  }

  const openRosterEditor = (squadId: string, date: string) => {
    const { staffIds } = resolveRoster(squadId, date)
    setRosterStaffIds(staffIds)
    setRosterEditor({ squadId, date })
  }

  const toggleRosterStaff = (id: string) => {
    setRosterStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const saveRoster = async () => {
    if (!rosterEditor) return
    setRosterSaving(true)
    try {
      const r = await fetch('/api/getReports?type=squadRoster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId: rosterEditor.squadId, date: rosterEditor.date, staffIds: rosterStaffIds }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) { showToast(d.error || 'Error guardando roster', 'err'); return }
      showToast(d.cleaningCount > 0 ? `Guardado · aplicado a ${d.updated}/${d.cleaningCount} limpiezas de ese día` : 'Guardado')
      setRosterEditor(null)
      load()
    } catch { showToast('Error guardando roster', 'err') }
    finally { setRosterSaving(false) }
  }

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

  // Sat/Sun, same convention used by the backend (getAvailability): dow 0=Mon..6=Sun, weekend = 5 or 6
  const isWeekendDate = (date: string) => {
    const dow = (new Date(date + 'T12:00:00').getDay() + 6) % 7
    return dow >= 5
  }

  // Weekend squads can't be assigned Mon-Fri, and Weekday squads can't be assigned Sat/Sun.
  // Flexible squads have no restriction — they're built to cover either side.
  const squadBlockedOnDate = (squad: Squad, date: string) => {
    const weekend = isWeekendDate(date)
    if (squad.type === 'Weekend' || squad.type === 'Weekend/Holiday') return !weekend
    if (squad.type === 'Weekday') return weekend
    return false
  }

  // Group squads the same way Pre-dispatch does: Weekend, Weekday, Flexible — alphabetical within each
  const weekendSquads = squads.filter(s => s.type === 'Weekend' || s.type === 'Weekend/Holiday').sort((a, b) => a.name.localeCompare(b.name))
  const weekdaySquads = squads.filter(s => s.type === 'Weekday').sort((a, b) => a.name.localeCompare(b.name))
  const flexibleSquads = squads.filter(s => s.type === 'Flexible').sort((a, b) => a.name.localeCompare(b.name))
  const squadGroups = [
    { label: 'Flexible', items: flexibleSquads },
    { label: 'Weekday', items: weekdaySquads },
    { label: 'Weekend', items: weekendSquads },
  ]

  const openCreate = (squadId?: string, date?: string) => {
    setForm({ ...emptyForm, squadId: squadId || squads[0]?.id || '', date: date || dates[0] })
    setShowForm(true)
  }

  // Weekly summary per squad: count of cleanings by type, total revenue, total effort hours.
  // Deduplicates by cleaningId (in case more than one block ever pointed at the same cleaning,
  // e.g. from before the duplicate-assignment guard existed) and only counts cleanings whose
  // status matches what Cobranza counts as billable, so the two numbers are actually comparable.
  const BILLABLE_STATUSES = ['Done', 'In Progress', 'Opened', 'Scheduled', 'Programmed']
  const summaryForSquad = (squadId: string) => {
    const squadBlocks = blocks.filter(b => b.squadId === squadId && b.type === 'Appointment' && dates.includes(b.date))
    const seenCleaningIds = new Set<string>()
    const byType: Record<string, number> = {}
    let revenue = 0
    let effortMinutes = 0
    let total = 0
    for (const b of squadBlocks) {
      if (!b.cleaningId || seenCleaningIds.has(b.cleaningId)) continue
      seenCleaningIds.add(b.cleaningId)
      const cleaning = cleanings.find(c => c.id === b.cleaningId)
      if (!cleaning || !BILLABLE_STATUSES.includes(cleaning.status)) continue
      total++
      const typeLabel = cleaning.cleaningType || 'Otro'
      byType[typeLabel] = (byType[typeLabel] || 0) + 1
      if (cleaning.price) revenue += cleaning.price
      if (cleaning.laborMinutes) effortMinutes += cleaning.laborMinutes
    }
    return { byType, revenue, effortHours: Math.round((effortMinutes / 60) * 10) / 10, total }
  }

  const handleSave = async () => {
    if (!form.squadId || !form.date) { showToast('Squad and date required', 'err'); return }
    const squad = squads.find(s => s.id === form.squadId)
    if (squad && squadBlockedOnDate(squad, form.date)) {
      showToast(`${squad.name} es squad de ${squad.type === 'Weekday' ? 'weekday' : 'weekend'} — no se puede asignar ese día`, 'err')
      return
    }
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
            <Plus style={{ width: 15, height: 15 }} /> Bloqueo manual
          </button>
        </div>
      </div>

      {/* Weekly summary across all squads */}
      {(() => {
        const allBlocks = blocks.filter(b => b.type === 'Appointment' && dates.includes(b.date))
        const seenCleaningIds = new Set<string>()
        let revenue = 0, effortMinutes = 0, total = 0
        for (const b of allBlocks) {
          if (!b.cleaningId || seenCleaningIds.has(b.cleaningId)) continue
          seenCleaningIds.add(b.cleaningId)
          const cleaning = cleanings.find(c => c.id === b.cleaningId)
          if (!cleaning || !BILLABLE_STATUSES.includes(cleaning.status)) continue
          total++
          if (cleaning.price) revenue += cleaning.price
          if (cleaning.laborMinutes) effortMinutes += cleaning.laborMinutes
        }
        const effortHours = Math.round((effortMinutes / 60) * 10) / 10
        return (
          <div style={{ display: 'flex', gap: 20, marginBottom: 16, padding: '12px 16px', borderRadius: 14, background: C.primaryLight, flexWrap: 'wrap' }}>
            <div title="Incluye limpiezas Done, In Progress, Opened, Scheduled y Programmed de toda la semana (lunes–domingo), incluyendo las que aún no han pasado. Para comparar con Cobranza, usa el filtro 'Semana completa' ahí.">
              <p style={{ fontSize: 9.5, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Ingresos semana (programado)</p>
              <p style={{ fontSize: 17, fontWeight: 800, color: C.ink, margin: '2px 0 0' }}>${revenue}</p>
            </div>
            <div>
              <p style={{ fontSize: 9.5, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Esfuerzo total</p>
              <p style={{ fontSize: 17, fontWeight: 800, color: C.ink, margin: '2px 0 0' }}>{effortHours}h</p>
            </div>
            <div>
              <p style={{ fontSize: 9.5, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Limpiezas</p>
              <p style={{ fontSize: 17, fontWeight: 800, color: C.ink, margin: '2px 0 0' }}>{total}</p>
            </div>
          </div>
        )
      })()}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 11.5, color: C.muted, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: C.amber, display: 'inline-block' }} /> STR-only (from Rules)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: C.teal, display: 'inline-block' }} /> Manual block</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: C.green, display: 'inline-block' }} /> Appointment</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, display: 'inline-block', background: `repeating-linear-gradient(135deg, ${C.bg} 0px, ${C.bg} 3px, ${C.border} 3px, ${C.border} 6px)` }} />
          No disponible (squad de otro tipo de día)
        </span>
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
                <div key={date} style={{ padding: '8px 6px', textAlign: 'center', borderLeft: `1px solid ${C.border}` }}
                  title={avail.breakdown ? `Capacidad total: ${avail.breakdown.totalCapacityHours}h\nOcupado por squads (bloqueos + limpiezas ya asignadas): −${avail.breakdown.usedHours}h\nLibre en calendario: ${avail.breakdown.totalFreeHours}h\nConfirmadas sin asignar a squad: ${avail.breakdown.unassignedApptCount} (−${avail.breakdown.unassignedApptHours}h)\nBuffer de ruta: −${avail.breakdown.bufferPct}%\n\nPor squad:\n${avail.breakdown.perSquad.map(s => `  ${s.squadId.slice(-4)}: ${s.freeHours}h libres de ${s.capacityHours}h (${s.blockedCount} bloques)`).join('\n')}` : ''}>
                  <p style={{ fontSize: 11, fontWeight: 800, margin: 0, color: avail.available ? C.green : C.red }}>
                    {avail.available ? `${avail.residualHours}h libre` : 'Lleno'}
                  </p>
                  {avail.breakdown && (
                    <p style={{ fontSize: 8, color: C.muted, margin: '2px 0 0', lineHeight: 1.3 }}>
                      {avail.breakdown.totalCapacityHours}h cap → {avail.breakdown.totalFreeHours}h libre · −{avail.breakdown.unassignedApptHours}h pend · −{avail.breakdown.bufferPct}% buf
                    </p>
                  )}
                  {!avail.available && avail.reason && (
                    <p style={{ fontSize: 8.5, color: C.muted, margin: '2px 0 0', lineHeight: 1.2 }}>{avail.reason}</p>
                  )}
                </div>
              )
            })}
          </div>

          {squadGroups.map(group => group.items.length > 0 && (
            <div key={group.label}>
              <div style={{ padding: '6px 14px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 9.5, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{group.label}</p>
              </div>
              {group.items.map(squad => (
                <div key={squad.id} style={{ display: 'grid', gridTemplateColumns: '140px repeat(7, 1fr)', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderRight: `1px solid ${C.border}` }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: squad.color, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{squad.name}</p>
                      <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>{squad.type}</p>
                      {(() => {
                        const s = summaryForSquad(squad.id)
                        if (s.total === 0) return null
                        return (
                          <p style={{ fontSize: 9.5, fontWeight: 700, color: C.primary, margin: '2px 0 0' }}>
                            ${s.revenue} · {s.effortHours}h
                          </p>
                        )
                      })()}
                    </div>
                  </div>
                  {dates.map(date => {
                    const structural = isStructuralSTR(date)
                    const blocked = squadBlockedOnDate(squad, date)
                    const dayBlocks = blocks.filter(b => b.squadId === squad.id && b.date === date)
                    const dayManualBlocks = dayBlocks.filter(b => b.type !== 'Appointment')
                    const dayCleaningBlocks = dayBlocks.filter(b => b.type === 'Appointment')
                    // Group cleaning blocks by type for a compact summary chip instead of one pill per job
                    const byType: Record<string, number> = {}
                    for (const b of dayCleaningBlocks) {
                      const cleaning = cleanings.find(c => c.id === b.cleaningId)
                      const typeLabel = cleaning?.cleaningType || 'Otro'
                      byType[typeLabel] = (byType[typeLabel] || 0) + 1
                    }
                    return (
                      <div key={date}
                        onClick={() => {
                          if (blocked) { showToast(`${squad.name} es squad de ${squad.type === 'Weekday' ? 'weekday' : 'weekend'} — no se puede asignar ese día`, 'err'); return }
                          openCreate(squad.id, date)
                        }}
                        className="group relative"
                        title={blocked ? `${squad.name} (${squad.type}) no opera ese día` : undefined}
                        style={{
                          padding: '6px', minHeight: 56, borderLeft: `1px solid ${C.border}`,
                          background: blocked
                            ? `repeating-linear-gradient(135deg, ${C.bg} 0px, ${C.bg} 6px, ${C.border} 6px, ${C.border} 12px)`
                            : (structural ? '#FFFBEB' : C.white),
                          cursor: blocked ? 'not-allowed' : 'pointer',
                        }}>
                        {!blocked && (
                          <Plus className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-60 transition-opacity"
                            style={{ width: 13, height: 13, color: C.primary }} />
                        )}
                        {!blocked && (() => {
                          const { staffIds, isOverride } = resolveRoster(squad.id, date)
                          const label = staffLabel(staffIds)
                          return (
                            <div onClick={e => { e.stopPropagation(); openRosterEditor(squad.id, date) }}
                              title="Click para cambiar el personal de este squad ese día"
                              style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4, cursor: 'pointer' }}>
                              <span style={{ fontSize: 8.5, fontWeight: 700, color: isOverride ? C.primary : C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                👥 {label || 'Sin personal'}
                              </span>
                              {isOverride && <span style={{ fontSize: 7, fontWeight: 800, color: C.primary, background: C.primaryLight, borderRadius: 4, padding: '0 3px' }}>AJUSTE</span>}
                            </div>
                          )
                        })()}
                        {structural && dayBlocks.length === 0 && (
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: C.amber, textAlign: 'center', padding: '4px 0' }}>STR-only</div>
                        )}
                        {Object.entries(byType).map(([type, count]) => {
                          const tc = colorForType(type)
                          return (
                            <div key={type} onClick={e => e.stopPropagation()}
                              style={{ background: tc.bg, border: `1px solid ${tc.border}40`, borderRadius: 7, padding: '3px 6px', marginBottom: 3 }}>
                              <span style={{ fontSize: 9.5, fontWeight: 700, color: tc.text }}>{count}× {type}</span>
                            </div>
                          )
                        })}
                        {dayManualBlocks.map(b => (
                          <div key={b.id} onClick={e => e.stopPropagation()}
                            style={{ background: C.bg, border: `1px solid ${C.teal}30`, borderRadius: 7, padding: '3px 6px', marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: C.teal, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {b.type} {b.startTime}–{b.endTime}
                            </span>
                            <button onClick={() => handleDelete(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                              <X style={{ width: 9, height: 9, color: C.muted }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ))}
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

      {/* Roster editor modal — set who's actually working a squad on a specific day.
          Saving creates/updates ONE override row and cascades it to every cleaning already
          dispatched to that squad that day, so nothing needs to be edited one-by-one. */}
      {rosterEditor && (() => {
        const squad = squads.find(s => s.id === rosterEditor.squadId)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 }}>
            <div style={{ background: C.white, borderRadius: 18, padding: 24, width: 360, maxWidth: '90vw' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>Personal del día</p>
                <button onClick={() => setRosterEditor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                  <X style={{ width: 18, height: 18, color: C.muted }} />
                </button>
              </div>
              <p style={{ fontSize: 12, color: C.muted, margin: '0 0 18px' }}>
                {squad?.name} · {rosterEditor.date}
              </p>

              <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Staff</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {staffList.map(s => {
                  const selected = rosterStaffIds.includes(s.id)
                  return (
                    <button key={s.id} onClick={() => toggleRosterStaff(s.id)}
                      style={{ height: 32, padding: '0 12px', borderRadius: 9, border: `1.5px solid ${selected ? C.primary : C.border}`, background: selected ? C.primaryLight : C.white, color: selected ? C.primary : C.slate, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {s.name}
                    </button>
                  )
                })}
                {staffList.length === 0 && <p style={{ fontSize: 12, color: C.muted }}>No hay staff cargado.</p>}
              </div>

              <p style={{ fontSize: 11.5, color: C.muted, margin: '0 0 18px', lineHeight: 1.4 }}>
                Si {squad?.name} ya tiene limpiezas asignadas ese día, esto las actualiza automáticamente — no hace falta cambiarlas una por una.
              </p>

              <button onClick={saveRoster} disabled={rosterSaving}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C.primary} 0%, #4F46E5 100%)`, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {rosterSaving ? <RefreshCw style={{ width: 14, height: 14 }} className="animate-spin" /> : null}
                Guardar y aplicar
              </button>
            </div>
          </div>
        )
      })()}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} .animate-spin{animation:spin 1s linear infinite}`}</style>
    </div>
  )
}
