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

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Standard STR Turnover': { bg: '#ECFDF5', border: '#10B981', text: '#047857' },
  'Residential Cleaning':  { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8' },
  'Deep Clean':            { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  'Move Out/In':           { bg: '#FCE7F3', border: '#EC4899', text: '#BE185D' },
}
const DEFAULT_TYPE_COLOR = { bg: '#F1F5F9', border: '#94A3B8', text: '#475569' }
const colorForType = (type: string | null) => (type && TYPE_COLORS[type]) || DEFAULT_TYPE_COLOR

const ZIP_PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6', '#EF4444', '#84CC16', '#F97316', '#14B8A6']
function colorForZip(zip: string | null): string | null {
  if (!zip) return null
  let hash = 0
  for (let i = 0; i < zip.length; i++) hash = (hash * 31 + zip.charCodeAt(i)) >>> 0
  return ZIP_PALETTE[hash % ZIP_PALETTE.length]
}

function pillDuration(startTime: string, endTime: string): string {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 && m > 0 ? `${h}h${m}m` : h > 0 ? `${h}h` : `${m}m`
}

interface Squad { id: string; name: string; color: string; type: string; startHour: number; endHour: number }
interface Block { id: string; squadId: string; date: string; startTime: string; endTime: string; type: string; cleaningId: string | null; notes: string }
interface Cleaning { id: string; date: string; scheduledTime: string | null; turnoTime: string | null; status: string; propertyText: string; zip: string | null; price: number | null; assignedStaff: string[]; appointmentCode: string | null; appointmentRecordId: string | null; cleaningType: string | null }

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
  return d.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return {
    short: d.toLocaleDateString('es-US', { weekday: 'short' }).toUpperCase().replace('.', ''),
    num: d.getDate(),
  }
}

function isWeekend(dateStr: string) {
  const dow = (new Date(dateStr + 'T12:00:00').getDay() + 6) % 7
  return dow >= 5
}

function fmt$(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US')
}

export default function PreDispatchPage() {
  const [squads, setSquads]   = useState<Squad[]>([])
  const [blocks, setBlocks]   = useState<Block[]>([])
  const [cleanings, setCleanings] = useState<Cleaning[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [resequencingKey, setResequencingKey] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState(
    getMonday(new Date()).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  )
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  )
  const [mobileStart, setMobileStart] = useState(0)

  const [draggedCleaningId, setDraggedCleaningId] = useState<string | null>(null)
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null)
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null)
  const [pendingCleaningIds, setPendingCleaningIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const inFlightRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }

  const dates = Array.from({ length: 7 }, (_, i) => addDaysToISO(weekStart, i))
  const visibleDates = isMobile ? dates.slice(mobileStart, mobileStart + 3) : dates
  const gridCols = isMobile ? '100px repeat(3, 1fr)' : '140px repeat(7, 1fr)'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/getSquads?weekStart=${weekStart}`)
      if (r.ok) {
        const d = await r.json()
        setSquads(d.squads || [])
        setBlocks(d.blocks || [])
        setCleanings(d.cleanings || [])
      }
    } catch { showToast('Error cargando datos', 'err') }
    finally { setLoading(false) }
  }, [weekStart])

  useEffect(() => { loadData() }, [loadData])

  const prevWeek = () => setWeekStart(w => addDaysToISO(w, -7))
  const nextWeek = () => setWeekStart(w => addDaysToISO(w, 7))
  const goToday  = () => setWeekStart(getMonday(new Date()).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }))

  // ── Computed stats ──────────────────────────────────────────────
  const totalRevenue = cleanings.reduce((s, c) => s + (c.price || 0), 0)
  const assignedCount = new Set(blocks.filter(b => b.cleaningId).map(b => b.cleaningId)).size
  const unassignedCleanings = cleanings.filter(c => !blocks.some(b => b.cleaningId === c.id))

  const revenueByDate: Record<string, number> = {}
  const jobsByDate: Record<string, { total: number; assigned: number }> = {}
  for (const d of dates) {
    const dayCleanings = cleanings.filter(c => c.date === d)
    revenueByDate[d] = dayCleanings.reduce((s, c) => s + (c.price || 0), 0)
    jobsByDate[d] = {
      total: dayCleanings.length,
      assigned: blocks.filter(b => b.date === d && b.cleaningId).length,
    }
  }

  const squadStats: Record<string, { revenue: number; jobs: number }> = {}
  for (const sq of squads) {
    const sqBlocks = blocks.filter(b => b.squadId === sq.id && b.cleaningId)
    squadStats[sq.id] = {
      jobs: sqBlocks.length,
      revenue: sqBlocks.reduce((s, b) => {
        const c = cleanings.find(c => c.id === b.cleaningId)
        return s + (c?.price || 0)
      }, 0),
    }
  }

  const busiest = dates.reduce((best, d) =>
    (jobsByDate[d]?.total || 0) > (jobsByDate[best]?.total || 0) ? d : best, dates[0])

  // ── Squad grouping ───────────────────────────────────────────────
  const flexibleSquads = squads.filter(s => s.type === 'Flexible').sort((a, b) => a.name.localeCompare(b.name))
  const weekdaySquads  = squads.filter(s => s.type === 'Weekday').sort((a, b) => a.name.localeCompare(b.name))
  const weekendSquads  = squads.filter(s => s.type === 'Weekend' || s.type === 'Weekend/Holiday').sort((a, b) => a.name.localeCompare(b.name))

  const relevantSquads = (date: string) => {
    const dow = (new Date(date + 'T12:00:00').getDay() + 6) % 7
    const weekend = dow >= 5
    return squads.filter(s => {
      if (s.type === 'Flexible') return true
      if (s.type === 'Weekday') return !weekend
      return weekend
    })
  }

  // ── Handlers ────────────────────────────────────────────────────
  const handleDropCleaning = (squadId: string, date: string, cleaningId: string) => {
    const cleaning = cleanings.find(c => c.id === cleaningId)
    if (!cleaning) return
    const squad = squads.find(s => s.id === squadId)
    if (!squad) return
    if (inFlightRef.current.has(cleaningId)) return
    inFlightRef.current.add(cleaningId)
    setPendingCleaningIds(prev => new Set([...prev, cleaningId]))
    assignCleaning(squad, date, cleaning)
  }

  const assignCleaning = async (squad: Squad, date: string, cleaning: Cleaning) => {
    const rawTime = cleaning.scheduledTime
      ? new Date(cleaning.scheduledTime).toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false })
      : null
    const validStart = rawTime || `${String(squad.startHour).padStart(2, '0')}:00`
    const [startH, startM] = validStart.split(':').map(Number)
    const endMinTotal = startH * 60 + startM + 120
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
      try { data = await res.json() } catch { /* handled below */ }
      if (!res.ok || !data) { showToast(data?.error || `Error del servidor (${res.status})`, 'err'); return }

      if (data.dateChanged) {
        showToast(`Asignado a ${squad.name} ✓`)
        loadData()
      } else {
        setBlocks(prev => [...prev, {
          id: data.id, squadId: squad.id, date,
          startTime: validStart, endTime, type: 'Appointment',
          cleaningId: cleaning.id,
          notes: cleaning.appointmentCode ? `${cleaning.propertyText} (${cleaning.appointmentCode})` : (cleaning.propertyText || ''),
        }])
        showToast(`Asignado a ${squad.name} ✓`)
      }
    } catch (e: any) { showToast('Error de red: ' + (e?.message || 'desconocido'), 'err') }
    finally {
      setSaving(false)
      setPendingCleaningIds(prev => { const next = new Set(prev); next.delete(cleaning.id); return next })
      inFlightRef.current.delete(cleaning.id)
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    try {
      await fetch('/api/deleteSquadBlock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId })
      })
      setBlocks(prev => prev.filter(b => b.id !== blockId))
      showToast('Asignación eliminada')
    } catch { showToast('Error al eliminar', 'err') }
  }

  const handleReorderBlocks = async (squadId: string, date: string, fromBlockId: string, toBlockId: string) => {
    setDraggedBlockId(null); setDragOverBlockId(null)
    if (fromBlockId === toBlockId) return
    const squad = squads.find(s => s.id === squadId)
    const dayBlocks = blocks.filter(b => b.squadId === squadId && b.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime))
    const fromIdx = dayBlocks.findIndex(b => b.id === fromBlockId)
    const toIdx   = dayBlocks.findIndex(b => b.id === toBlockId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...dayBlocks]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const key = `${squadId}-${date}`
    setResequencingKey(key)
    try {
      const res = await fetch('/api/getReports?type=resequence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId, date, orderedBlockIds: reordered.map(b => b.id), squadStartHour: squad?.startHour ?? 8 }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) { showToast(data?.error || 'Error al reordenar', 'err'); return }
      if (data.times) {
        setBlocks(prev => prev.map(b => {
          const updated = data.times[b.id]
          return updated ? { ...b, startTime: updated.start, endTime: updated.end } : b
        }))
      }
      showToast(`Reordenado · ${data.updated} horario(s) actualizado(s)`)
    } catch (e: any) { showToast('Error de red: ' + (e?.message || 'desconocido'), 'err') }
    finally { setResequencingKey(null) }
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 p-4 max-w-full">

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl text-[13px] font-bold text-white shadow-lg"
          style={{ background: toast.type === 'ok' ? C.green : C.red }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: C.primaryLight }}>
            <Users className="w-5 h-5" style={{ color: C.primary }} />
          </div>
          <div>
            <h2 className="font-black text-[20px]" style={{ color: C.ink }}>Pre-dispatch</h2>
            <p className="text-[12px] font-medium" style={{ color: C.muted }}>Asigna squad a limpiezas ya lanzadas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ border: `1.5px solid ${C.border}` }}>
            <ChevronLeft className="w-4 h-4" style={{ color: C.slate }} />
          </button>
          <button onClick={goToday} className="px-4 py-2 rounded-2xl text-[12px] font-bold" style={{ border: `1.5px solid ${C.border}`, color: C.slate }}>
            Hoy
          </button>
          <button onClick={nextWeek} className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ border: `1.5px solid ${C.border}` }}>
            <ChevronRight className="w-4 h-4" style={{ color: C.slate }} />
          </button>
          <button onClick={loadData} disabled={loading} className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ border: `1.5px solid ${C.border}` }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: C.muted }} />
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {!loading && (
        <div className="flex flex-wrap gap-3 px-4 py-3 rounded-2xl" style={{ background: C.primaryLight, border: `1px solid ${C.primary}20` }}>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: C.primary }}>Ingresos semana</p>
            <p className="text-[16px] font-black" style={{ color: C.ink }}>{fmt$(totalRevenue)}</p>
          </div>
          <div style={{ width: 1, background: C.border, alignSelf: 'stretch' }} />
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: C.primary }}>Limpiezas</p>
            <p className="text-[16px] font-black" style={{ color: C.ink }}>{cleanings.length}</p>
          </div>
          <div style={{ width: 1, background: C.border, alignSelf: 'stretch' }} />
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: unassignedCleanings.length > 0 ? C.amber : C.green }}>Sin squad</p>
            <p className="text-[16px] font-black" style={{ color: unassignedCleanings.length > 0 ? C.amber : C.green }}>{unassignedCleanings.length}</p>
          </div>
          {busiest && jobsByDate[busiest]?.total > 0 && (
            <>
              <div style={{ width: 1, background: C.border, alignSelf: 'stretch' }} />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Día más cargado</p>
                <p className="text-[16px] font-black" style={{ color: C.ink }}>
                  {new Date(busiest + 'T12:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric' })} · {jobsByDate[busiest]?.total} jobs
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Type legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(TYPE_COLORS).map(([type, tc]) => (
          <span key={type} className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
            <span className="w-2.5 h-2.5 rounded shrink-0" style={{ background: tc.border }} />{type}
          </span>
        ))}
      </div>

      {/* Mobile day navigation */}
      {isMobile && (
        <div className="flex items-center justify-between">
          <button onClick={() => setMobileStart(Math.max(0, mobileStart - 3))} disabled={mobileStart === 0}
            className="px-3 py-1.5 rounded-xl text-[12px] font-bold" style={{ border: `1.5px solid ${C.border}`, color: mobileStart === 0 ? C.muted : C.slate, opacity: mobileStart === 0 ? 0.4 : 1 }}>
            ← Anterior
          </button>
          <p className="text-[11px] font-bold" style={{ color: C.muted }}>
            {new Date(visibleDates[0] + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })} — {new Date(visibleDates[visibleDates.length - 1] + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
          </p>
          <button onClick={() => setMobileStart(Math.min(4, mobileStart + 3))} disabled={mobileStart + 3 >= 7}
            className="px-3 py-1.5 rounded-xl text-[12px] font-bold" style={{ border: `1.5px solid ${C.border}`, color: mobileStart + 3 >= 7 ? C.muted : C.slate, opacity: mobileStart + 3 >= 7 ? 0.4 : 1 }}>
            Siguiente →
          </button>
        </div>
      )}

      {/* Grid — single overflow wrapper ensures ALL rows share the same column widths */}
      <div className="rounded-3xl overflow-hidden shadow-sm" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ minWidth: isMobile ? 360 : 900 }}>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ background: C.bg }} />
              {visibleDates.map(date => {
                const { short, num } = fmtDay(date)
                const weekend = isWeekend(date)
                const jobs = jobsByDate[date]
                const rev = revenueByDate[date]
                const overloaded = (jobs?.total || 0) >= 8
                return (
                  <div key={date} className="px-2 py-2 text-center border-l" style={{ borderColor: C.border, background: weekend ? C.amberLight : C.bg }}>
                    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: weekend ? C.amber : C.muted }}>{short}</p>
                    <p className="font-black text-[15px]" style={{ color: C.ink }}>{num}</p>
                    {jobs && jobs.total > 0 && (
                      <>
                        <p className="text-[9px] font-bold mt-0.5" style={{ color: overloaded ? C.red : C.green }}>
                          {jobs.assigned}/{jobs.total} jobs
                        </p>
                        <p className="text-[8.5px]" style={{ color: C.muted }}>{fmt$(rev)}</p>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Sin squad row */}
            {!loading && unassignedCleanings.some(c => visibleDates.includes(c.date)) && (
              <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: `1px solid ${C.border}`, background: '#FFFBEB' }}>
                <div className="px-3 py-3 flex items-start border-r" style={{ borderColor: C.border }}>
                  <p className="font-bold text-[11px]" style={{ color: C.amber }}>Sin squad</p>
                </div>
                {visibleDates.map(date => {
                  const dayUnassigned = unassignedCleanings
                    .filter(c => c.date === date)
                    .sort((a, b) => (a.zip || '').localeCompare(b.zip || '') || a.propertyText.localeCompare(b.propertyText))
                  return (
                    <div key={date} className="border-l p-1.5 overflow-y-auto" style={{ borderColor: C.border, maxHeight: 220, minHeight: 56 }}>
                      {dayUnassigned.map(c => {
                        const isPending = pendingCleaningIds.has(c.id)
                        const tc = colorForType(c.cleaningType)
                        const zipColor = colorForZip(c.zip)
                        const time = timeFromScheduled(c.scheduledTime)
                        return (
                          <div key={c.id}
                            draggable={!isPending}
                            onDragStart={() => !isPending && setDraggedCleaningId(c.id)}
                            onDragEnd={() => setDraggedCleaningId(null)}
                            title={c.zip ? `ZIP ${c.zip}` : undefined}
                            className="rounded-xl px-2 py-1 mb-1"
                            style={{
                              background: isPending ? '#F1F5F9' : tc.bg,
                              border: `1px solid ${isPending ? C.border : tc.border}40`,
                              borderLeft: zipColor && !isPending ? `4px solid ${zipColor}` : undefined,
                              opacity: isPending ? 0.5 : (draggedCleaningId === c.id ? 0.4 : 1),
                              cursor: isPending ? 'not-allowed' : 'grab',
                            }}>
                            <p className="text-[9px] font-black truncate" style={{ color: isPending ? C.muted : tc.text }}>
                              {time ? `${time} · ` : ''}{c.propertyText}{isPending ? ' · asignando…' : ''}
                            </p>
                            {c.zip && !isPending && (
                              <p className="text-[7.5px] font-bold" style={{ color: zipColor || C.muted }}>{c.zip}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Squad rows */}
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
                  {/* Group label row */}
                  <div style={{ display: 'grid', gridTemplateColumns: gridCols }}>
                    <div className="px-3 py-1.5" style={{ background: C.bg }}>
                      <p className="text-[9.5px] font-black uppercase tracking-wide" style={{ color: C.muted }}>{group.label}</p>
                    </div>
                    {visibleDates.map(d => <div key={d} style={{ background: C.bg }} />)}
                  </div>

                  {/* Squad rows */}
                  {group.items.map(squad => {
                    const stats = squadStats[squad.id] || { revenue: 0, jobs: 0 }
                    return (
                      <div key={squad.id} style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: `1px solid ${C.border}` }}>
                        {/* Squad name cell */}
                        <div className="px-3 py-3 flex items-center gap-2 border-r" style={{ borderColor: C.border }}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: squad.color }} />
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold truncate" style={{ color: C.ink }}>{squad.name}</p>
                            <p className="text-[9px]" style={{ color: C.muted }}>{squad.type}</p>
                            {stats.jobs > 0 && (
                              <p className="text-[9px] font-bold" style={{ color: C.primary }}>
                                {fmt$(stats.revenue)} · {stats.jobs} jobs
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Day cells */}
                        {visibleDates.map(date => {
                          const isRelevant = relevantSquads(date).some(s => s.id === squad.id)
                          const dayBlocks = blocks.filter(b => b.squadId === squad.id && b.date === date)
                          const isReseq = resequencingKey === `${squad.id}-${date}`
                          return (
                            <div key={date}
                              onDragOver={e => isRelevant && e.preventDefault()}
                              onDrop={() => draggedCleaningId && isRelevant && handleDropCleaning(squad.id, date, draggedCleaningId)}
                              className="border-l p-1.5 min-h-[60px] relative"
                              style={{ borderColor: C.border, background: isRelevant ? C.white : C.bg, opacity: isRelevant ? 1 : 0.4 }}>

                              {/* Resequencing overlay */}
                              {isReseq && (
                                <div className="absolute inset-0 flex items-center justify-center rounded z-10"
                                  style={{ background: 'rgba(99,102,241,0.08)' }}>
                                  <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: C.primary + '40', borderTopColor: C.primary }} />
                                </div>
                              )}

                              {dayBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(b => {
                                const relatedCleaning = cleanings.find(c => c.id === b.cleaningId)
                                const tc = colorForType(relatedCleaning?.cleaningType || null)
                                const dur = b.startTime && b.endTime ? pillDuration(b.startTime, b.endTime) : ''
                                const isDraggingThis = draggedBlockId === b.id
                                const isDragTarget = dragOverBlockId === b.id && draggedBlockId !== null && draggedBlockId !== b.id
                                return (
                                  <div key={b.id}
                                    draggable={!!b.cleaningId}
                                    title={b.cleaningId ? 'Arrastrá sobre otra limpieza del mismo squad para reordenar' : undefined}
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
                                      {b.startTime && (
                                        <p className="text-[9px] font-black truncate" style={{ color: tc.text }}>
                                          {b.startTime}{dur ? ` · ${dur}` : ''}
                                        </p>
                                      )}
                                      {b.notes && (
                                        <p className="text-[8.5px] truncate" style={{ color: C.muted }}>{b.notes}</p>
                                      )}
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
                    )
                  })}
                </div>
              ))
            )}

          </div>{/* end min-width wrapper */}
        </div>{/* end overflow-x: auto */}
      </div>{/* end rounded card */}

      {saving && (
        <div className="fixed bottom-5 right-5 px-4 py-2 rounded-xl text-[12px] font-bold text-white shadow-lg" style={{ background: C.primary }}>
          Guardando...
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} .animate-spin{animation:spin 1s linear infinite}`}</style>
    </div>
  )
}
