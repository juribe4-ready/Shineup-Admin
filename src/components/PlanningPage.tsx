import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Clock, AlertCircle, RefreshCw } from 'lucide-react'

const C = {
  primary: '#6366F1', primaryDark: '#4F46E5', primaryLight: '#EEF2FF',
  headerBg: '#1E293B', ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', red: '#EF4444', amber: '#F59E0B',
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Confirmed':   { bg: '#DCFCE7', color: '#059669' },
  'Scheduled':   { bg: '#DBEAFE', color: '#2563EB' },
  'Lead':        { bg: '#FEF3C7', color: '#D97706' },
  'Cancelled':   { bg: '#FEE2E2', color: '#EF4444' },
  'Completed':   { bg: '#F1F5F9', color: '#475569' },
}

const BLOCK_TYPES = ['Appointment', 'Manual Block', 'STR', 'Holiday Block']

interface Squad {
  id: string; name: string; color: string; type: string
  startHour: number; endHour: number
}
interface Block {
  id: string; squadId: string; date: string
  startTime: string; endTime: string; type: string
  appointmentId: string | null; notes: string
}
interface Appointment {
  id: string; appointmentId: string; date: string | null; time: string | null
  datetime: string | null; duration: number; status: string
  clientName: string; address: string; notes: string; source: string
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()].substring(0, 3)}`
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const DAY_START = 8 * 60   // 8am
const DAY_END   = 18 * 60  // 6pm
const DAY_TOTAL = DAY_END - DAY_START

export default function PlanningPage() {
  const [weekStart, setWeekStart]       = useState(() => getMonday(new Date()))
  const [squads, setSquads]             = useState<Squad[]>([])
  const [blocks, setBlocks]             = useState<Block[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]           = useState(true)
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [toast, setToast]               = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [saving, setSaving]             = useState(false)
  const [blockTypes, setBlockTypes]     = useState<string[]>(['Appointment', 'Manual Block', 'STR', 'Holiday Block', 'Rest'])

  // Block form state
  const [bSquad, setBSquad]   = useState('')
  const [bDate, setBDate]     = useState('')
  const [bStart, setBStart]   = useState('08:00')
  const [bEnd, setBEnd]       = useState('12:00')
  const [bType, setBType]     = useState('Manual Block')
  const [bNotes, setBNotes]   = useState('')

  const weekStartStr = weekStart.toISOString().split('T')[0]

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load block types dynamically
      fetch('/api/getSquadBlockTypes').then(r => r.ok ? r.json() : null).then(d => {
        if (d?.types?.length) setBlockTypes(d.types)
      }).catch(() => {})

      const [squadsRes, apptRes] = await Promise.all([
        fetch(`/api/getSquads?weekStart=${weekStartStr}`),
        fetch(`/api/getAppointments?weekStart=${weekStartStr}`)
      ])
      if (squadsRes.ok) {
        const d = await squadsRes.json()
        setSquads(d.squads || [])
        setBlocks(d.blocks || [])
      }
      if (apptRes.ok) setAppointments(await apptRes.json())
    } catch { showToast('Error al cargar', 'err') }
    finally { setLoading(false) }
  }, [weekStartStr])

  useEffect(() => { loadData() }, [loadData])

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }
  const goToday  = () => setWeekStart(getMonday(new Date()))

  const openBlockForm = (squadId: string, date: string) => {
    setBSquad(squadId); setBDate(date)
    setBStart('08:00'); setBEnd('12:00'); setBType('Manual Block'); setBNotes('')
    setShowBlockForm(true)
  }

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/createSquadBlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId: bSquad, date: bDate, startTime: bStart, endTime: bEnd, type: bType, notes: bNotes })
      })
      if (!res.ok) throw new Error('Error al crear')
      showToast('Bloque creado ✓')
      setShowBlockForm(false)
      loadData()
    } catch { showToast('Error al crear bloque', 'err') }
    finally { setSaving(false) }
  }

  const handleDeleteBlock = async (blockId: string) => {
    try {
      await fetch('/api/deleteSquadBlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId })
      })
      setBlocks(prev => prev.filter(b => b.id !== blockId))
      showToast('Bloque eliminado')
    } catch { showToast('Error al eliminar', 'err') }
  }

  // Calculate availability percentage for a squad on a date
  const getAvailPct = (squad: Squad, date: string) => {
    const dayStart = squad.startHour * 60
    const dayEnd = squad.endHour * 60
    const dayTotal = dayEnd - dayStart
    if (dayTotal <= 0) return 0
    const dayBlocks = blocks.filter(b => b.squadId === squad.id && b.date === date)
    const occupied = dayBlocks.reduce((acc, b) => {
      const s = Math.max(timeToMin(b.startTime || `${squad.startHour}:00`), dayStart)
      const e = Math.min(timeToMin(b.endTime || `${squad.endHour}:00`), dayEnd)
      return acc + Math.max(0, e - s)
    }, 0)
    return Math.max(0, 100 - Math.round((occupied / dayTotal) * 100))
  }

  const monthLabel = (() => {
    const s = MONTHS_ES[weekStart.getMonth()]
    const e = dates[6] ? MONTHS_ES[new Date(dates[6] + 'T12:00:00').getMonth()] : s
    return s === e ? `${s} ${weekStart.getFullYear()}` : `${s} / ${e} ${weekStart.getFullYear()}`
  })()

  const weekNumber = (() => {
    const d = new Date(weekStart)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
    const week1 = new Date(d.getFullYear(), 0, 4)
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
  })()

  const weekRangeLabel = `${fmtDate(dates[0])} – ${fmtDate(dates[6])}`

  const weekdaySquads  = squads.filter(s => s.type === 'Weekday')
  const weekendSquads  = squads.filter(s => s.type === 'Weekend' || s.type === 'Weekend/Holiday')
  const flexibleSquads = squads.filter(s => s.type === 'Flexible')

  const isWeekend = (date: string) => {
    const d = new Date(date + 'T12:00:00').getDay()
    return d === 0 || d === 6
  }

  const relevantSquads = (date: string) => {
    if (isWeekend(date)) return [...weekendSquads, ...flexibleSquads]
    return [...weekdaySquads, ...flexibleSquads]
  }

  return (
    <div className="space-y-6" style={{ fontFamily: 'Poppins, sans-serif' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-xl text-white text-[13px] font-bold"
          style={{ background: toast.type === 'ok' ? C.green : C.red }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-black text-[22px]" style={{ color: C.ink }}>Planificación</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-[13px] font-medium" style={{ color: C.muted }}>{weekRangeLabel}</p>
            <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ background: C.primaryLight, color: C.primary }}>Sem {weekNumber}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all hover:bg-slate-100" style={{ border: `1.5px solid ${C.border}` }}>
            <ChevronLeft className="w-4 h-4" style={{ color: C.slate }} />
          </button>
          <button onClick={goToday} className="px-4 py-2 rounded-2xl text-[12px] font-bold transition-all"
            style={{ border: `1.5px solid ${C.border}`, color: C.slate, background: C.white }}>
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Appointments', value: appointments.length, color: C.primary, bg: C.primaryLight },
          { label: 'Confirmados',  value: appointments.filter(a => a.status === 'Confirmed').length,  color: C.green,  bg: '#ECFDF5' },
          { label: 'Leads',        value: appointments.filter(a => a.status === 'Lead').length,        color: C.amber,  bg: '#FFFBEB' },
          { label: 'Bloques',      value: blocks.length,                                              color: C.red,    bg: '#FEF2F2' },
        ].map(s => (
          <div key={s.label} className="rounded-3xl p-4 shadow-sm" style={{ background: s.bg, border: `1px solid ${C.border}` }}>
            <p className="font-black text-[26px] leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] font-semibold mt-1 uppercase tracking-wide" style={{ color: C.muted }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Weekly Grid */}
      <div className="rounded-3xl overflow-hidden shadow-sm" style={{ background: C.white, border: `1px solid ${C.border}` }}>

        {/* Day headers */}
        <div className="grid border-b" style={{ gridTemplateColumns: '140px repeat(7, 1fr)', borderColor: C.border }}>
          <div className="px-4 py-3" style={{ background: C.bg }} />
          {dates.map((date, i) => {
            const isToday = date === new Date().toISOString().split('T')[0]
            const weekend = isWeekend(date)
            const dayAppts = appointments.filter(a => a.date === date)
            return (
              <div key={date} className="px-2 py-3 text-center border-l" style={{ borderColor: C.border, background: isToday ? C.primaryLight : weekend ? '#FFFBEB' : C.bg }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: weekend ? C.amber : C.muted }}>{DAY_NAMES[i]}</p>
                <p className="font-black text-[15px] mt-0.5" style={{ color: isToday ? C.primary : C.ink }}>{fmtDate(date)}</p>
                {dayAppts.length > 0 && (
                  <div className="mt-1 flex justify-center gap-0.5">
                    {dayAppts.slice(0, 4).map(a => (
                      <div key={a.id} className="w-1.5 h-1.5 rounded-full" style={{ background: (STATUS_COLORS[a.status] || STATUS_COLORS['Scheduled']).color }} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Squad rows */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: C.border, borderTopColor: C.primary }} />
          </div>
        ) : squads.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-2" style={{ color: C.muted }}>
            <AlertCircle className="w-8 h-8 opacity-30" />
            <p className="text-[13px] font-medium">Sin squads configurados</p>
          </div>
        ) : (
          squads.map(squad => (
            <div key={squad.id} className="grid border-t" style={{ gridTemplateColumns: '140px repeat(7, 1fr)', borderColor: C.border }}>
              {/* Squad label */}
              <div className="px-3 py-3 flex items-center gap-2.5 border-r" style={{ borderColor: C.border, background: C.bg }}>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: squad.color }} />
                <div>
                  <p className="font-bold text-[12px]" style={{ color: C.ink }}>{squad.name}</p>
                  <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>{squad.type}</p>
                </div>
              </div>

              {/* Day cells */}
              {dates.map(date => {
                const available = relevantSquads(date).some(s => s.id === squad.id)
                const dayBlocks = blocks.filter(b => b.squadId === squad.id && b.date === date)
                const availPct = available ? getAvailPct(squad, date) : 0
                const dayAppts = appointments.filter(a => a.date === date)

                return (
                  <div key={date} className="border-l relative min-h-[80px] p-1.5 group"
                    style={{ borderColor: C.border, background: available ? C.white : '#F8FAFC' }}>
                    {!available ? (
                      <div className="absolute inset-0 group cursor-pointer" onClick={() => openBlockForm(squad.id, date)}>
                        <div className="w-full h-full opacity-10" style={{ background: `repeating-linear-gradient(45deg, ${C.muted} 0px, ${C.muted} 1px, transparent 1px, transparent 8px)` }} />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="w-4 h-4" style={{ color: C.muted }} />
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Availability bar */}
                        <div className="h-1 rounded-full overflow-hidden mb-1.5" style={{ background: C.border }}>
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${availPct}%`, background: availPct > 60 ? C.green : availPct > 30 ? C.amber : C.red }} />
                        </div>
                        <p className="text-[9px] font-bold mb-1" style={{ color: availPct > 60 ? C.green : availPct > 30 ? C.amber : C.red }}>{availPct}% libre</p>

                        {/* Blocks */}
                        {dayBlocks.map(block => (
                          <div key={block.id} className="rounded-xl px-2 py-1 mb-1 flex items-start justify-between gap-1 group/block"
                            style={{ background: `${squad.color}20`, border: `1px solid ${squad.color}40` }}>
                            <div className="min-w-0">
                              <p className="text-[9px] font-black truncate" style={{ color: squad.color }}>{block.type}</p>
                              <p className="text-[9px] font-medium" style={{ color: C.muted }}>{block.startTime}–{block.endTime}</p>
                            </div>
                            <button onClick={() => handleDeleteBlock(block.id)}
                              className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover/block:opacity-100 transition-opacity shrink-0 mt-0.5"
                              style={{ background: C.red }}>
                              <X className="w-2.5 h-2.5 text-white" />
                            </button>
                          </div>
                        ))}

                        {/* Appointment pills */}
                        {dayAppts.filter(a => a.status === 'Confirmed').map(appt => (
                          <button key={appt.id} onClick={() => setSelectedAppt(appt)}
                            className="w-full rounded-xl px-2 py-1 mb-1 text-left hover:opacity-80 transition-opacity"
                            style={{ background: '#DCFCE7', border: '1px solid #BBF7D0' }}>
                            <p className="text-[9px] font-black truncate" style={{ color: '#059669' }}>{appt.time} · {appt.clientName || appt.address}</p>
                          </button>
                        ))}

                        {/* Add block button - always available */}
                        <button onClick={() => openBlockForm(squad.id, date)}
                          className="w-full rounded-xl py-0.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                          style={{ border: `1px dashed ${C.border}` }}>
                          <Plus className="w-3 h-3" style={{ color: C.muted }} />
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* Appointments list */}
      {appointments.length > 0 && (
        <div className="rounded-3xl overflow-hidden shadow-sm" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: C.border }}>
            <p className="font-black text-[14px]" style={{ color: C.ink }}>Appointments de la Semana</p>
            <p className="text-[12px] font-medium mt-0.5" style={{ color: C.muted }}>{appointments.length} en total</p>
          </div>
          <div className="divide-y" style={{ borderColor: C.border }}>
            {appointments.map(appt => {
              const sc = STATUS_COLORS[appt.status] || STATUS_COLORS['Scheduled']
              return (
                <button key={appt.id} onClick={() => setSelectedAppt(appt)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors">
                  <div className="text-center shrink-0" style={{ width: '48px' }}>
                    <p className="font-black text-[13px]" style={{ color: C.ink }}>{appt.date ? fmtDate(appt.date) : '--'}</p>
                    <p className="text-[11px] font-medium" style={{ color: C.muted }}>{appt.time || '--'}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[13px] truncate" style={{ color: C.ink }}>{appt.clientName || 'Sin cliente'}</p>
                    <p className="text-[11px] font-medium truncate" style={{ color: C.muted }}>{appt.address || 'Sin dirección'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {appt.duration > 0 && (
                      <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: C.muted }}>
                        <Clock className="w-3 h-3" />{Math.round(appt.duration / 60)}h
                      </div>
                    )}
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: sc.bg, color: sc.color }}>{appt.status}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Appointment detail modal */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.7)' }} onClick={() => setSelectedAppt(null)}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: C.white }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${C.headerBg}, #334155)` }}>
              <p className="font-black text-[16px] text-white">Appointment</p>
              <button onClick={() => setSelectedAppt(null)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.muted }}>Cliente</p>
                <p className="font-bold text-[15px]" style={{ color: C.ink }}>{selectedAppt.clientName || 'Sin cliente'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.muted }}>Dirección</p>
                <p className="font-medium text-[13px]" style={{ color: C.slate }}>{selectedAppt.address || 'Sin dirección'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl" style={{ background: C.bg }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.muted }}>Fecha</p>
                  <p className="font-black text-[14px]" style={{ color: C.ink }}>{selectedAppt.date ? fmtDate(selectedAppt.date) : '--'}</p>
                </div>
                <div className="p-3 rounded-2xl" style={{ background: C.bg }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.muted }}>Hora</p>
                  <p className="font-black text-[14px]" style={{ color: C.ink }}>{selectedAppt.time || '--'}</p>
                </div>
              </div>
              {selectedAppt.duration > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-2xl" style={{ background: C.bg }}>
                  <Clock className="w-4 h-4 shrink-0" style={{ color: C.muted }} />
                  <p className="font-semibold text-[13px]" style={{ color: C.ink }}>
                    Duración estimada: {Math.floor(selectedAppt.duration / 60)}h {selectedAppt.duration % 60 > 0 ? `${selectedAppt.duration % 60}min` : ''}
                  </p>
                </div>
              )}
              {selectedAppt.notes && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.muted }}>Notas</p>
                  <p className="text-[13px] font-medium leading-relaxed" style={{ color: C.slate }}>{selectedAppt.notes}</p>
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-bold px-3 py-1.5 rounded-full" style={{ background: (STATUS_COLORS[selectedAppt.status] || STATUS_COLORS['Scheduled']).bg, color: (STATUS_COLORS[selectedAppt.status] || STATUS_COLORS['Scheduled']).color }}>
                  {selectedAppt.status}
                </span>
                {selectedAppt.source && <span className="text-[11px] font-medium" style={{ color: C.muted }}>{selectedAppt.source}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create block modal */}
      {showBlockForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.7)' }} onClick={() => setShowBlockForm(false)}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: C.white }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${C.headerBg}, #334155)` }}>
              <p className="font-black text-[16px] text-white">Nuevo Bloque</p>
              <button onClick={() => setShowBlockForm(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <form onSubmit={handleCreateBlock} className="p-5 space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Squad</p>
                <select value={bSquad} onChange={e => setBSquad(e.target.value)} required
                  className="w-full px-4 py-3 rounded-2xl text-[13px] font-medium outline-none"
                  style={{ fontFamily: 'Poppins, sans-serif', border: `1.5px solid ${C.border}`, color: C.ink }}>
                  <option value="">Seleccionar squad...</option>
                  {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Fecha</p>
                <input type="date" value={bDate} onChange={e => setBDate(e.target.value)} required
                  className="w-full px-4 py-3 rounded-2xl text-[13px] font-medium outline-none"
                  style={{ fontFamily: 'Poppins, sans-serif', border: `1.5px solid ${C.border}`, color: C.ink }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Inicio</p>
                  <input type="time" value={bStart} onChange={e => setBStart(e.target.value)} required
                    className="w-full px-4 py-3 rounded-2xl text-[13px] font-medium outline-none"
                    style={{ fontFamily: 'Poppins, sans-serif', border: `1.5px solid ${C.border}`, color: C.ink }} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Fin</p>
                  <input type="time" value={bEnd} onChange={e => setBEnd(e.target.value)} required
                    className="w-full px-4 py-3 rounded-2xl text-[13px] font-medium outline-none"
                    style={{ fontFamily: 'Poppins, sans-serif', border: `1.5px solid ${C.border}`, color: C.ink }} />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Tipo</p>
                <div className="grid grid-cols-2 gap-2">
                  {blockTypes.map(t => (
                    <button key={t} type="button" onClick={() => setBType(t)}
                      className="py-2 rounded-2xl text-[11px] font-bold transition-all"
                      style={{ border: `1.5px solid ${bType === t ? C.primary : C.border}`, background: bType === t ? C.primaryLight : C.bg, color: bType === t ? C.primary : C.muted }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Notas (opcional)</p>
                <textarea value={bNotes} onChange={e => setBNotes(e.target.value)} rows={2} placeholder="Razón del bloqueo..."
                  className="w-full px-4 py-3 rounded-2xl text-[13px] font-medium outline-none resize-none"
                  style={{ fontFamily: 'Poppins, sans-serif', border: `1.5px solid ${C.border}`, color: C.ink }} />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-3.5 rounded-2xl text-white font-black text-[14px] active:scale-95 transition-all"
                style={{ background: C.primary, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando...' : 'Crear Bloque'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
