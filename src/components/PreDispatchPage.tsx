import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Users, X } from 'lucide-react'

const C = {
  primary: '#6366F1', primaryLight: '#EEF2FF',
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', greenLight: '#ECFDF5',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  red: '#EF4444',
}

// Distinct color per cleaning type, so pills are visually distinguishable at a glance
const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Standard STR Turnover': { bg: '#ECFDF5', border: '#10B981', text: '#047857' },
  'Residential Cleaning':  { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8' },
  'Deep Clean':            { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  'Move Out/In':           { bg: '#FCE7F3', border: '#EC4899', text: '#BE185D' },
}
const DEFAULT_TYPE_COLOR = { bg: '#F1F5F9', border: '#94A3B8', text: '#475569' }
const colorForType = (type: string | null) => (type && TYPE_COLORS[type]) || DEFAULT_TYPE_COLOR

// Deterministic color per zipcode (same zip = same color every load), so pills from the
// same area are visually groupable at a glance in the "Sin squad" row. Picked for mutual
// contrast against each other and against the white pill background.
const ZIP_PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6', '#EF4444', '#84CC16', '#F97316', '#14B8A6']
function colorForZip(zip: string | null): string | null {
  if (!zip) return null
  let hash = 0
  for (let i = 0; i < zip.length; i++) hash = (hash * 31 + zip.charCodeAt(i)) >>> 0
  return ZIP_PALETTE[hash % ZIP_PALETTE.length]
}

interface Squad { id: string; name: string; color: string; type: string; startHour: number; endHour: number }
interface Block { id: string; squadId: string; date: string; startTime: string; endTime: string; type: string; cleaningId: string | null; notes: string }
interface Cleaning { id: string; date: string; scheduledTime: string | null; status: string; propertyText: string; zip: string | null; assignedStaff: string[]; appointmentCode: string | null; appointmentRecordId: string | null; cleaningType: string | null }

function getMonday(d: Date) {
  const dow = (d.getDay() + 6) % 7
  const m = new Date(d)
  m.setDate(d.getDate() - dow)
  m.setHours(12, 0, 0, 0)
  return m
}

function addDaysToISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().split('T')[0]
}

function timeFromScheduled(scheduledTime: string | null): string {
  if (!scheduledTime) return ''
  const d = new Date(scheduledTime)
  if (isNaN(d.getTime())) return ''
  // Format the absolute instant in Eastern time, letting Intl handle DST correctly.
  // (Previously this subtracted a hardcoded 6 hours — a workaround for when the Airtable
  // field's timezone was misconfigured to Pacific/Easter, which is UTC-6 year-round. That
  // hardcoded offset broke once the field's timezone setting changed. This approach doesn't
  // care what timezone the Airtable field is set to — it works off the real UTC instant.)
  return d.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function PreDispatchPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [squads, setSquads] = useState<Squad[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [cleanings, setCleanings] = useState<Cleaning[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [draggedCleaningId, setDraggedCleaningId] = useState<string | null>(null)
  // Separate from draggedCleaningId — this is for reordering blocks ALREADY assigned to a
  // squad within the same day cell (drag one pill over another to resequence their times).
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null)
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null)
  const [resequencing, setResequencing] = useState(false)

  const weekStartStr = weekStart.toISOString().split('T')[0]
  const dates = Array.from({ length: 7 }, (_, i) => addDaysToISO(weekStartStr, i))

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/getSquads?weekStart=${weekStartStr}`)
      if (res.ok) {
        const d = await res.json()
        setSquads(d.squads || [])
        setBlocks(d.blocks || [])
        setCleanings(d.cleanings || [])
      } else {
        showToast('Error al cargar datos', 'err')
      }
    } catch { showToast('Error al cargar', 'err') }
    finally { setLoading(false) }
  }, [weekStartStr])

  useEffect(() => { loadData() }, [loadData])

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }
  const goToday = () => setWeekStart(getMonday(new Date()))

  const isWeekend = (date: string) => {
    const d = new Date(date + 'T12:00:00').getDay()
    return d === 0 || d === 6
  }

  const weekdaySquads = squads.filter(s => s.type === 'Weekday').sort((a, b) => a.name.localeCompare(b.name))
  const weekendSquads = squads.filter(s => s.type === 'Weekend' || s.type === 'Weekend/Holiday').sort((a, b) => a.name.localeCompare(b.name))
  const flexibleSquads = squads.filter(s => s.type === 'Flexible').sort((a, b) => a.name.localeCompare(b.name))

  // Flexible squads work every day, so they're always "relevant" alongside whichever
  // group (weekday/weekend) matches the date.
  const relevantSquads = (date: string) => {
    if (isWeekend(date)) return [...weekendSquads, ...flexibleSquads]
    return [...weekdaySquads, ...flexibleSquads]
  }

  // Cleanings already launched, scheduled, but with no squad block linked yet.
  // Pending ones (mid-assignment) stay visible but grayed out — not removed —
  // so the user sees immediate feedback instead of the pill vanishing abruptly.
  const [pendingCleaningIds, setPendingCleaningIds] = useState<Set<string>>(new Set())
  const inFlightRef = useRef<Set<string>>(new Set())
  const assignedCleaningIds = new Set(blocks.map(b => b.cleaningId).filter(Boolean))
  const unassignedCleanings = cleanings.filter(c => !assignedCleaningIds.has(c.id))

  // Drag and drop: assign a launched Cleaning to a squad on a given date
  const handleDropCleaning = (squadId: string, date: string, cleaningId: string) => {
    setDraggedCleaningId(null)

    // Guard: this cleaning is already mid-assignment (sync ref, immune to render timing),
    // or already has a confirmed block (stale UI before refresh caught up)
    if (inFlightRef.current.has(cleaningId) || assignedCleaningIds.has(cleaningId)) return
    inFlightRef.current.add(cleaningId)

    const cleaning = cleanings.find(c => c.id === cleaningId)
    const squad = squads.find(s => s.id === squadId)
    if (!cleaning || !squad) { inFlightRef.current.delete(cleaningId); return }

    // Mark as pending IMMEDIATELY so the pill grays out right away in the UI
    setPendingCleaningIds(prev => new Set(prev).add(cleaningId))

    // Only ask for confirmation when the drop date doesn't match the cleaning's real date —
    // same-day assignment proceeds immediately, no popup, to keep the workflow fast.
    const dateMismatch = cleaning.date !== date
    if (dateMismatch) {
      const ok = window.confirm(`Esta limpieza es del ${cleaning.date}, la estás moviendo al ${date}. ¿Confirmas?`)
      if (!ok) {
        inFlightRef.current.delete(cleaningId)
        setPendingCleaningIds(prev => { const next = new Set(prev); next.delete(cleaningId); return next })
        return
      }
    }

    assignCleaning(squad, date, cleaning)
  }

  const assignCleaning = async (squad: Squad, date: string, cleaning: Cleaning) => {
    // Always use the squad's startHour — never cleaning.scheduledTime, which the resequencer
    // may have overwritten to a computed value. Re-assigning then inherited that stale value.
    const validStart = `${String(squad.startHour).padStart(2, '0')}:00`
    const endMinTotal = squad.startHour * 60 + 120
    const endTime = `${String(Math.floor(endMinTotal / 60)).padStart(2, '0')}:${String(endMinTotal % 60).padStart(2, '0')}`

    setSaving(true)
    try {
      const res = await fetch('/api/createSquadBlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          squadId: squad.id, date, startTime: validStart, endTime,
          type: 'Appointment', cleaningId: cleaning.id, appointmentId: cleaning.appointmentRecordId || undefined,
          notes: cleaning.appointmentCode ? `${cleaning.propertyText} (${cleaning.appointmentCode})` : (cleaning.propertyText || ''),
        })
      })
      let data: any = null
      try { data = await res.json() } catch { /* response wasn't valid JSON — handled below */ }
      if (!res.ok || !data) { showToast(data?.error || `Error del servidor (${res.status})`, 'err'); return }

      // Fix point 1: update local state optimistically instead of calling loadData() —
      // loadData() causes a full page flicker/refresh on every single assignment, which
      // makes rapid multi-assignment painful. We already know everything we need to build
      // the block locally (same pattern as handleDeleteBlock's setBlocks(prev => ...)).
      setBlocks(prev => [...prev, {
        id: data.id,
        squadId: squad.id,
        date,
        startTime: validStart,
        endTime,
        type: 'Appointment',
        cleaningId: cleaning.id,
        notes: cleaning.appointmentCode ? `${cleaning.propertyText} (${cleaning.appointmentCode})` : (cleaning.propertyText || ''),
      }])
      showToast(`Asignado a ${squad.name} ✓`)
    } catch (e: any) { showToast('Error de red: ' + (e?.message || 'desconocido'), 'err') }
    finally {
      setSaving(false)
      setPendingCleaningIds(prev => { const next = new Set(prev); next.delete(cleaning.id); return next })
      inFlightRef.current.delete(cleaning.id)
    }
  }

  // Remove a squad assignment — the cleaning returns to the unassigned row automatically
  const handleDeleteBlock = async (blockId: string) => {
    try {
      await fetch('/api/deleteSquadBlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId })
      })
      setBlocks(prev => prev.filter(b => b.id !== blockId))
      showToast('Asignación eliminada')
    } catch { showToast('Error al eliminar', 'err') }
  }

  // Drag one block pill onto another, within the same squad+day cell, to reorder them.
  // The dropped-on pill's position becomes where the dragged one lands; everything from
  // there forward gets its time recomputed: previous job's end + travel buffer = next start.
  const handleReorderBlocks = async (squadId: string, date: string, fromBlockId: string, toBlockId: string) => {
    setDraggedBlockId(null)
    setDragOverBlockId(null)
    if (fromBlockId === toBlockId) return

    const squad = squads.find(s => s.id === squadId)
    const dayBlocks = blocks
      .filter(b => b.squadId === squadId && b.date === date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))

    const fromIdx = dayBlocks.findIndex(b => b.id === fromBlockId)
    const toIdx = dayBlocks.findIndex(b => b.id === toBlockId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...dayBlocks]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const orderedBlockIds = reordered.map(b => b.id)

    setResequencing(true)
    try {
      const res = await fetch('/api/getReports?type=resequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Pass the squad's startHour as the fixed anchor — the sequence always begins at
        // the squad's configured start time (e.g. 08:00 or 10:00). Using the cleaning's
        // current Scheduled Time was the root of point 3: after the first resequence the
        // Scheduled Time of the first cleaning was already overwritten, so the second
        // resequence anchored to a computed/drifted time instead of the real squad start.
        body: JSON.stringify({ squadId, date, orderedBlockIds, squadStartHour: squad?.startHour ?? 8 }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) { showToast(data?.error || 'Error al reordenar', 'err'); return }

      // Update local block times immediately (same no-refresh approach as assignCleaning)
      if (data.times) {
        setBlocks(prev => prev.map(b => {
          const updated = data.times[b.id]
          return updated ? { ...b, startTime: updated.start, endTime: updated.end } : b
        }))
      }
      showToast(`Reordenado · ${data.updated} horario(s) actualizado(s)`)
    } catch (e: any) { showToast('Error de red: ' + (e?.message || 'desconocido'), 'err') }
    finally { setResequencing(false) }
  }

  const fmtDay = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')
    return { short: d.toLocaleDateString('es-ES', { weekday: 'short' }), num: d.getDate() }
  }

  return (
    <div className="space-y-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-xl text-white text-[13px] font-bold"
          style={{ background: toast.type === 'ok' ? C.green : C.red }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: C.primaryLight }}>
            <Users className="w-5 h-5" style={{ color: C.primary }} />
          </div>
          <div>
            <h2 className="font-black text-[22px]" style={{ color: C.ink }}>Pre-dispatch</h2>
            <p className="text-[13px] font-medium" style={{ color: C.muted }}>Asigna squad a limpiezas ya lanzadas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all hover:bg-slate-100" style={{ border: `1.5px solid ${C.border}` }}>
            <ChevronLeft className="w-4 h-4" style={{ color: C.slate }} />
          </button>
          <button onClick={goToday} className="px-4 py-2 rounded-2xl text-[12px] font-bold transition-all" style={{ border: `1.5px solid ${C.border}`, color: C.slate, background: C.white }}>
            Hoy
          </button>
          <button onClick={nextWeek} className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all hover:bg-slate-100" style={{ border: `1.5px solid ${C.border}` }}>
            <ChevronRight className="w-4 h-4" style={{ color: C.slate }} />
          </button>
          <button onClick={loadData} disabled={loading} className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ border: `1.5px solid ${C.border}`, background: C.white }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: C.muted }} />
          </button>
        </div>
      </div>

      {/* Note on what this page does */}
      <div className="rounded-2xl p-3" style={{ background: C.amberLight, border: `1px solid ${C.amber}30` }}>
        <p className="text-[11.5px]" style={{ color: '#92400E' }}>
          Aquí solo aparecen limpiezas ya <strong>lanzadas</strong> (Cleanings reales). Si falta una limpieza, primero lánzala desde Plan → Week.
          {' '}Arrastrá una limpieza ya asignada sobre otra del mismo squad para reordenarlas — los horarios se recalculan solos (duración real + buffer de viaje configurado en Reglas).
        </p>
      </div>

      {/* Color legend by cleaning type */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(TYPE_COLORS).map(([type, tc]) => (
          <span key={type} className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
            <span className="w-2.5 h-2.5 rounded shrink-0" style={{ background: tc.border }} />
            {type}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className="rounded-3xl overflow-hidden shadow-sm" style={{ background: C.white, border: `1px solid ${C.border}` }}>

        {/* Day headers */}
        <div className="grid border-b" style={{ gridTemplateColumns: '140px repeat(7, 1fr)', borderColor: C.border }}>
          <div className="px-4 py-3" style={{ background: C.bg }} />
          {dates.map(date => {
            const { short, num } = fmtDay(date)
            const weekend = isWeekend(date)
            return (
              <div key={date} className="px-2 py-3 text-center border-l" style={{ borderColor: C.border, background: weekend ? C.amberLight : C.bg }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: weekend ? C.amber : C.muted }}>{short}</p>
                <p className="font-black text-[15px] mt-0.5" style={{ color: C.ink }}>{num}</p>
              </div>
            )
          })}
        </div>

        {/* Unassigned cleanings row — drag these into a squad cell below */}
        {!loading && unassignedCleanings.length > 0 && (
          <div className="grid border-b" style={{ gridTemplateColumns: '140px repeat(7, 1fr)', borderColor: C.border, background: '#FFFBEB' }}>
            <div className="px-3 py-3 flex items-start border-r" style={{ borderColor: C.border }}>
              <p className="font-bold text-[11px]" style={{ color: C.amber }}>Sin squad</p>
            </div>
            {dates.map(date => {
              const dayUnassigned = unassignedCleanings
                .filter(c => c.date === date)
                .sort((a, b) => (a.zip || '').localeCompare(b.zip || '') || a.propertyText.localeCompare(b.propertyText))
              return (
                <div key={date} className="border-l p-1.5 overflow-y-auto" style={{ borderColor: C.border, maxHeight: 220, minHeight: 60 }}>
                  {dayUnassigned.map(c => {
                    const isPending = pendingCleaningIds.has(c.id)
                    const tc = colorForType(c.cleaningType)
                    const zipColor = colorForZip(c.zip)
                    return (
                      <div key={c.id}
                        draggable={!isPending}
                        onDragStart={() => !isPending && setDraggedCleaningId(c.id)}
                        onDragEnd={() => setDraggedCleaningId(null)}
                        title={c.zip ? `ZIP ${c.zip}` : undefined}
                        className="rounded-xl px-2 py-1 mb-1 transition-opacity"
                        style={{
                          background: isPending ? '#F1F5F9' : tc.bg,
                          border: `1px solid ${isPending ? C.border : tc.border}40`,
                          borderLeft: zipColor && !isPending ? `4px solid ${zipColor}` : undefined,
                          opacity: isPending ? 0.5 : (draggedCleaningId === c.id ? 0.4 : 1),
                          cursor: isPending ? 'not-allowed' : 'grab',
                        }}>
                        <p className="text-[9px] font-black truncate" style={{ color: isPending ? C.muted : tc.text }}>
                          {timeFromScheduled(c.scheduledTime) ? `${timeFromScheduled(c.scheduledTime)} · ` : ''}{c.propertyText}{isPending ? ' · asignando…' : ''}
                        </p>
                        {c.zip && !isPending && (
                          <p className="text-[7.5px] font-bold truncate" style={{ color: zipColor || C.muted }}>{c.zip}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* Squad rows — grouped by Flexible, Weekday, Weekend; alphabetical within each */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: C.border, borderTopColor: C.primary }} />
          </div>
        ) : squads.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-2" style={{ color: C.muted }}>
            <p className="text-[13px] font-semibold">No hay squads activos</p>
            <p className="text-[11px]">Crea squads en TARS Core → Squads</p>
          </div>
        ) : (
          [
            { label: 'Flexible', items: flexibleSquads },
            { label: 'Weekday', items: weekdaySquads },
            { label: 'Weekend', items: weekendSquads },
          ].map(group => group.items.length > 0 && (
            <div key={group.label}>
              <div className="grid" style={{ gridTemplateColumns: '140px repeat(7, 1fr)' }}>
                <div className="px-3 py-1.5" style={{ background: C.bg }}>
                  <p className="text-[9.5px] font-black uppercase tracking-wide" style={{ color: C.muted }}>{group.label}</p>
                </div>
                <div className="col-span-7" style={{ background: C.bg }} />
              </div>
              {group.items.map(squad => (
                <div key={squad.id} className="grid border-b" style={{ gridTemplateColumns: '140px repeat(7, 1fr)', borderColor: C.border }}>
                  <div className="px-3 py-3 flex items-center gap-2 border-r" style={{ borderColor: C.border }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: squad.color }} />
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold truncate" style={{ color: C.ink }}>{squad.name}</p>
                      <p className="text-[10px]" style={{ color: C.muted }}>{squad.type}</p>
                    </div>
                  </div>
                  {dates.map(date => {
                    const isRelevant = relevantSquads(date).some(s => s.id === squad.id)
                    const dayBlocks = blocks.filter(b => b.squadId === squad.id && b.date === date)
                    return (
                      <div key={date}
                        onDragOver={e => isRelevant && e.preventDefault()}
                        onDrop={() => draggedCleaningId && isRelevant && handleDropCleaning(squad.id, date, draggedCleaningId)}
                        className="border-l p-1.5 min-h-[60px]"
                        style={{ borderColor: C.border, background: isRelevant ? C.white : C.bg, opacity: isRelevant ? 1 : 0.4 }}>
                        {dayBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(b => {
                          const relatedCleaning = cleanings.find(c => c.id === b.cleaningId)
                          const tc = colorForType(relatedCleaning?.cleaningType || null)
                          const hasRealTime = relatedCleaning ? !!timeFromScheduled(relatedCleaning.scheduledTime) : true
                          const isDraggingThis = draggedBlockId === b.id
                          const isDragTarget = dragOverBlockId === b.id && draggedBlockId !== null && draggedBlockId !== b.id
                          return (
                            <div key={b.id}
                              draggable={!!b.cleaningId}
                              title={b.cleaningId ? 'Arrastrá sobre otra limpieza del mismo squad para reordenar y recalcular horarios' : undefined}
                              onDragStart={e => { e.stopPropagation(); setDraggedBlockId(b.id) }}
                              onDragEnd={() => { setDraggedBlockId(null); setDragOverBlockId(null) }}
                              onDragOver={e => { if (draggedBlockId) { e.preventDefault(); e.stopPropagation(); setDragOverBlockId(b.id) } }}
                              onDragLeave={() => setDragOverBlockId(prev => prev === b.id ? null : prev)}
                              onDrop={e => { if (draggedBlockId) { e.preventDefault(); e.stopPropagation(); handleReorderBlocks(squad.id, date, draggedBlockId, b.id) } }}
                              className="rounded-xl px-2 py-1 mb-1 flex items-center justify-between gap-1 transition-all"
                              style={{
                                background: tc.bg,
                                border: `1.5px solid ${isDragTarget ? C.primary : tc.border + '40'}`,
                                opacity: isDraggingThis ? 0.4 : 1,
                                cursor: b.cleaningId ? 'grab' : 'default',
                                transform: isDragTarget ? 'scale(1.03)' : 'scale(1)',
                              }}>
                              <div className="min-w-0">
                                {hasRealTime && <p className="text-[9px] font-black truncate" style={{ color: tc.text }}>{b.startTime}–{b.endTime}</p>}
                                {b.notes && <p className="text-[8.5px] truncate" style={{ color: hasRealTime ? C.muted : tc.text, fontWeight: hasRealTime ? 400 : 700 }}>{b.notes}</p>}
                              </div>
                              <button onClick={() => handleDeleteBlock(b.id)} className="shrink-0 flex" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X className="w-2.5 h-2.5" style={{ color: C.muted }} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {saving && (
        <div className="fixed bottom-5 right-5 px-4 py-2 rounded-xl text-[12px] font-bold text-white" style={{ background: C.primary }}>
          Guardando...
        </div>
      )}
      {resequencing && (
        <div className="fixed bottom-5 right-5 px-4 py-2 rounded-xl text-[12px] font-bold text-white" style={{ background: C.primary }}>
          Recalculando horarios...
        </div>
      )}
    </div>
  )
}
