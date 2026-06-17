import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Users, X } from 'lucide-react'

const C = {
  primary: '#6366F1', primaryLight: '#EEF2FF',
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', greenLight: '#ECFDF5',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  red: '#EF4444',
}

interface Squad { id: string; name: string; color: string; type: string; startHour: number; endHour: number }
interface Block { id: string; squadId: string; date: string; startTime: string; endTime: string; type: string; cleaningId: string | null; notes: string }
interface Cleaning { id: string; date: string; scheduledTime: string | null; status: string; propertyText: string; assignedStaff: string[] }

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
  if (!scheduledTime) return '--:--'
  const t = scheduledTime.split('T')[1]
  return t ? t.substring(0, 5) : '--:--'
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

  // Cleanings already launched, scheduled, but with no squad block linked yet
  const assignedCleaningIds = new Set(blocks.map(b => b.cleaningId).filter(Boolean))
  const unassignedCleanings = cleanings.filter(c => !assignedCleaningIds.has(c.id))

  // Drag and drop: assign a launched Cleaning to a squad on a given date
  const handleDropCleaning = async (squadId: string, date: string, cleaningId: string) => {
    setDraggedCleaningId(null)
    const cleaning = cleanings.find(c => c.id === cleaningId)
    const squad = squads.find(s => s.id === squadId)
    if (!cleaning || !squad) return

    const startTime = timeFromScheduled(cleaning.scheduledTime)
    const validStart = startTime !== '--:--' ? startTime : `${String(squad.startHour).padStart(2, '0')}:00`
    const [h, m] = validStart.split(':').map(Number)
    const endMinTotal = h * 60 + m + 120 // default 2h block; refine once real duration field exists
    const endTime = `${String(Math.floor(endMinTotal / 60)).padStart(2, '0')}:${String(endMinTotal % 60).padStart(2, '0')}`

    setSaving(true)
    try {
      const res = await fetch('/api/createSquadBlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          squadId, date, startTime: validStart, endTime,
          type: 'Appointment', cleaningId,
          notes: cleaning.propertyText || '',
        })
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Conflicto de horario', 'err'); return }
      showToast(`Asignado a ${squad.name} ✓`)
      loadData()
    } catch { showToast('Error al asignar', 'err') }
    finally { setSaving(false) }
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
        </p>
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
              const dayUnassigned = unassignedCleanings.filter(c => c.date === date)
              return (
                <div key={date} className="border-l p-1.5 overflow-y-auto" style={{ borderColor: C.border, maxHeight: 220, minHeight: 60 }}>
                  {dayUnassigned.map(c => (
                    <div key={c.id}
                      draggable
                      onDragStart={() => setDraggedCleaningId(c.id)}
                      onDragEnd={() => setDraggedCleaningId(null)}
                      className="rounded-xl px-2 py-1 mb-1 cursor-grab active:cursor-grabbing transition-opacity"
                      style={{ background: '#FEF3C7', border: '1px solid #FDE68A', opacity: draggedCleaningId === c.id ? 0.4 : 1 }}>
                      <p className="text-[9px] font-black truncate" style={{ color: '#92400E' }}>{timeFromScheduled(c.scheduledTime)} · {c.propertyText}</p>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* Squad rows — grouped by Weekend, Weekday, Flexible; alphabetical within each */}
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
            { label: 'Weekend', items: weekendSquads },
            { label: 'Weekday', items: weekdaySquads },
            { label: 'Flexible', items: flexibleSquads },
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
                        {dayBlocks.map(b => (
                          <div key={b.id} className="rounded-xl px-2 py-1 mb-1 flex items-center justify-between gap-1" style={{ background: C.greenLight, border: `1px solid ${C.green}30` }}>
                            <div className="min-w-0">
                              <p className="text-[9px] font-black truncate" style={{ color: C.green }}>{b.startTime}–{b.endTime}</p>
                              {b.notes && <p className="text-[8.5px] truncate" style={{ color: C.muted }}>{b.notes}</p>}
                            </div>
                            <button onClick={() => handleDeleteBlock(b.id)} className="shrink-0 flex" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                              <X className="w-2.5 h-2.5" style={{ color: C.muted }} />
                            </button>
                          </div>
                        ))}
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
    </div>
  )
}
