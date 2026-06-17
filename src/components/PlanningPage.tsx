import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, RefreshCw, Rocket, CheckCircle2, AlertTriangle } from 'lucide-react'

const C = {
  primary: '#6366F1', primaryDark: '#4F46E5', primaryLight: '#EEF2FF',
  headerBg: '#1E293B', ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', greenLight: '#D1FAE5', red: '#EF4444', amber: '#F59E0B', teal: '#14B8A6',
}

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

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

interface WeekSummary {
  weekStart: string
  weekEnd: string
  summary: {
    total: number
    scheduled: number
    confirmed: number
    totalHH: number
    uniqueProperties: number
  }
  byDate: {
    date: string
    dayName: string
    dayNum: number
    appointments: WeekAppointment[]
    totalHH: number
    count: number
  }[]
  appointments: WeekAppointment[]
  alerts: { type: string; message: string }[]
}

interface WeekAppointment {
  id: string
  appointmentId: string
  date: string | null
  time: string | null
  propertyId: string
  propertyName: string
  labor: number
  status: string
  cleaningType: string
  clientName: string
  notes: string
  source: string
  relatedCleaning: string | null
}

interface StaffMember {
  id: string
  name: string
  initials: string
  role: string
  defaultAssignment: boolean
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(12, 0, 0, 0) // noon local time avoids any UTC date-shift when later converted
  return d
}

function addDaysToISO(iso: string, days: number): string {
  // Pure string-based date math — never touches Date/timezone conversion
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().split('T')[0]
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()].substring(0, 3)}`
}

export default function PlanningPage() {
  const [weekStart, setWeekStart]       = useState(() => getMonday(new Date()))
  const [blocks, setBlocks]             = useState<Block[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]           = useState(true)
  const [toast, setToast]               = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // Week Launcher state
  const [weekSummary, setWeekSummary]   = useState<WeekSummary | null>(null)
  const [launchingWeek, setLaunchingWeek] = useState(false)
  const [selectedWeekTab, setSelectedWeekTab] = useState<'this' | 'next'>('next')
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false)
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const [defaultRating, setDefaultRating] = useState(2)

  const weekStartStr = weekStart.toISOString().split('T')[0]

  const dates = Array.from({ length: 7 }, (_, i) => addDaysToISO(weekStartStr, i))

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [squadsRes, apptRes] = await Promise.all([
        fetch(`/api/getSquads?weekStart=${weekStartStr}`),
        fetch(`/api/getAppointments?weekStart=${weekStartStr}`)
      ])

      if (squadsRes.ok) {
        const d = await squadsRes.json()
        setBlocks(d.blocks || [])
      }

      if (apptRes.ok) {
        setAppointments(await apptRes.json())
      } else {
        console.error('[Planning] getAppointments failed', apptRes.status, await apptRes.text())
      }
    } catch { showToast('Error al cargar', 'err') }
    finally { setLoading(false) }
  }, [weekStartStr])

  useEffect(() => { loadData() }, [loadData])

  // Load week summary for launcher
  const loadWeekSummary = useCallback(async () => {
    try {
      const targetWeek = selectedWeekTab === 'next' 
        ? new Date(getMonday(new Date()).getTime() + 7 * 24 * 60 * 60 * 1000)
        : getMonday(new Date())
      const weekStartStr = targetWeek.toISOString().split('T')[0]
      
      const res = await fetch(`/api/getAppointments?action=summary&weekStart=${weekStartStr}`)
      if (res.ok) {
        const data = await res.json()
        setWeekSummary(data)
      }
    } catch (err) {
      console.error('Error loading week summary:', err)
    }
  }, [selectedWeekTab])

  useEffect(() => { loadWeekSummary() }, [loadWeekSummary])

  // Load staff for selector - use Default Assignment field
  useEffect(() => {
    fetch('/api/getAppointments?action=defaultStaff')
      .then(r => r.ok ? r.json() : { staff: [] })
      .then(data => {
        const staff = data.staff || []
        setStaffList(staff)
        // Pre-select staff with Default Assignment checked
        const defaultIds = staff
          .filter((s: StaffMember) => s.defaultAssignment)
          .map((s: StaffMember) => s.id)
        setSelectedStaffIds(defaultIds)
      })
      .catch(() => {})
  }, [])

  // Launch week - create cleanings from appointments
  const handleLaunchWeek = async () => {
    if (!weekSummary) return
    
    const toConvert = weekSummary.appointments.filter(a => 
      a.status === 'Projected' || a.status === 'Confirmed'
    )
    
    if (toConvert.length === 0) {
      showToast('No hay appointments para convertir', 'err')
      return
    }

    setLaunchingWeek(true)
    try {
      const res = await fetch('/api/getAppointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentIds: toConvert.map(a => a.id),
          defaultRating,
          assignedStaffIds: selectedStaffIds
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        showToast(`✓ ${data.created} limpiezas creadas`)
        setShowLaunchConfirm(false)
        loadWeekSummary()
        loadData()
      } else {
        showToast(data.error || 'Error al lanzar semana', 'err')
      }
    } catch (err) {
      showToast('Error de conexión', 'err')
    } finally {
      setLaunchingWeek(false)
    }
  }

  // Toggle staff selection
  const toggleStaff = (id: string) => {
    setSelectedStaffIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }
  const goToday  = () => setWeekStart(getMonday(new Date()))

  const weekNumber = (() => {
    const d = new Date(weekStart)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
    const week1 = new Date(d.getFullYear(), 0, 4)
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
  })()

  const weekRangeLabel = `${fmtDate(dates[0])} – ${fmtDate(dates[6])}`

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

      {/* ==================== WEEK LAUNCHER ==================== */}
      <div className="rounded-3xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.teal}08, ${C.primary}08)`, border: `2px solid ${C.teal}40` }}>
        {/* Header with tabs and actions */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: C.teal, color: 'white' }}>
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-[16px]" style={{ color: C.ink }}>Lanzador de Semana</h3>
              <p className="text-[11px]" style={{ color: C.muted }}>Convierte appointments en limpiezas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Launch button - compact */}
            {weekSummary && weekSummary.summary.confirmed > 0 && (
              <button 
                onClick={() => setShowLaunchConfirm(true)}
                className="px-4 py-2 rounded-xl font-bold text-[12px] text-white flex items-center gap-2 transition-all hover:opacity-90"
                style={{ background: C.green }}>
                <Rocket className="w-4 h-4" />
                Lanzar ({weekSummary.summary.confirmed})
              </button>
            )}
            {weekSummary && weekSummary.summary.confirmed === 0 && weekSummary.summary.scheduled > 0 && (
              <div className="px-3 py-1.5 rounded-xl flex items-center gap-1.5" style={{ background: C.greenLight }}>
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: C.green }} />
                <span className="font-bold text-[11px]" style={{ color: C.green }}>Lanzada</span>
              </div>
            )}
            {/* Refresh button */}
            <button 
              onClick={loadWeekSummary} 
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-slate-100" 
              style={{ border: `1.5px solid ${C.border}` }}
              title="Actualizar"
            >
              <RefreshCw className="w-4 h-4" style={{ color: C.muted }} />
            </button>
            {/* Week tabs */}
            <div className="flex rounded-xl overflow-hidden" style={{ border: `1.5px solid ${C.border}` }}>
              <button onClick={() => setSelectedWeekTab('this')}
                className="px-3 py-1.5 text-[11px] font-bold transition-all"
                style={{ background: selectedWeekTab === 'this' ? C.teal : C.white, color: selectedWeekTab === 'this' ? 'white' : C.slate }}>
                Esta Semana
              </button>
              <button onClick={() => setSelectedWeekTab('next')}
                className="px-3 py-1.5 text-[11px] font-bold transition-all"
                style={{ background: selectedWeekTab === 'next' ? C.teal : C.white, color: selectedWeekTab === 'next' ? 'white' : C.slate }}>
                Próxima Semana
              </button>
            </div>
          </div>
        </div>

        {weekSummary ? (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-4 gap-px" style={{ background: C.border }}>
              <div className="p-4 text-center" style={{ background: C.white }}>
                <p className="text-[24px] font-black" style={{ color: C.primary }}>{weekSummary.summary.total}</p>
                <p className="text-[10px] font-bold uppercase" style={{ color: C.muted }}>Limpiezas</p>
              </div>
              <div className="p-4 text-center" style={{ background: C.white }}>
                <p className="text-[24px] font-black" style={{ color: C.teal }}>{weekSummary.summary.totalHH}h</p>
                <p className="text-[10px] font-bold uppercase" style={{ color: C.muted }}>HH Estimadas</p>
              </div>
              <div className="p-4 text-center" style={{ background: C.white }}>
                <p className="text-[24px] font-black" style={{ color: C.amber }}>{weekSummary.summary.uniqueProperties}</p>
                <p className="text-[10px] font-bold uppercase" style={{ color: C.muted }}>Casas</p>
              </div>
              <div className="p-4 text-center" style={{ background: C.white }}>
                <p className="text-[24px] font-black" style={{ color: weekSummary.summary.confirmed > 0 ? C.green : C.muted }}>
                  {weekSummary.summary.confirmed}
                </p>
                <p className="text-[10px] font-bold uppercase" style={{ color: C.muted }}>Por Lanzar</p>
              </div>
            </div>

            {/* Daily breakdown */}
            <div className="p-4" style={{ background: C.white, borderTop: `1px solid ${C.border}` }}>
              <p className="text-[11px] font-bold uppercase mb-3" style={{ color: C.muted }}>Distribución por día</p>
              <div className="space-y-2">
                {weekSummary.byDate.map(day => (
                  <div key={day.date} className="flex items-center gap-3">
                    <div className="w-12 text-center">
                      <p className="text-[11px] font-black" style={{ color: C.ink }}>{day.dayName}</p>
                      <p className="text-[9px]" style={{ color: C.muted }}>{day.dayNum}</p>
                    </div>
                    <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: C.bg }}>
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${Math.min((day.count / Math.max(...weekSummary.byDate.map(d => d.count), 1)) * 100, 100)}%`,
                          background: day.count > 5 ? C.amber : C.teal
                        }}
                      />
                    </div>
                    <div className="w-20 text-right">
                      <span className="text-[12px] font-bold" style={{ color: C.ink }}>{day.count}</span>
                      <span className="text-[10px] ml-1" style={{ color: C.muted }}>({day.totalHH.toFixed(1)}h)</span>
                    </div>
                    <div className="w-32">
                      <p className="text-[9px] truncate" style={{ color: C.muted }}>
                        {day.appointments.slice(0, 2).map(a => a.propertyName.split(' ')[0]).join(', ')}
                        {day.appointments.length > 2 && ` +${day.appointments.length - 2}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts */}
            {weekSummary.alerts.length > 0 && (
              <div className="px-4 pb-4" style={{ background: C.white }}>
                <div className="p-3 rounded-2xl space-y-1" style={{ background: '#FEF3C7' }}>
                  {weekSummary.alerts.map((alert, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: C.amber }} />
                      <p className="text-[10px] font-medium" style={{ color: '#92400E' }}>{alert.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center" style={{ background: C.white }}>
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" style={{ color: C.muted }} />
            <p className="text-[12px]" style={{ color: C.muted }}>Cargando...</p>
          </div>
        )}
      </div>
      {/* ==================== END WEEK LAUNCHER ==================== */}
      {showLaunchConfirm && weekSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.8)' }} onClick={() => setShowLaunchConfirm(false)}>
          <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl" style={{ background: C.white }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.green})` }}>
              <div className="flex items-center gap-3">
                <Rocket className="w-6 h-6 text-white" />
                <p className="font-black text-[16px] text-white">Confirmar Lanzamiento</p>
              </div>
              <button onClick={() => setShowLaunchConfirm(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Summary */}
              <div className="p-4 rounded-2xl" style={{ background: C.bg }}>
                <p className="text-[12px] font-medium mb-3" style={{ color: C.slate }}>
                  Se crearán <b>{weekSummary.summary.confirmed}</b> limpiezas para la semana del <b>{weekSummary.weekStart}</b> al <b>{weekSummary.weekEnd}</b>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl" style={{ background: C.white }}>
                    <p className="text-[20px] font-black" style={{ color: C.teal }}>{weekSummary.summary.totalHH}h</p>
                    <p className="text-[10px]" style={{ color: C.muted }}>HH Estimadas</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: C.white }}>
                    <p className="text-[20px] font-black" style={{ color: C.amber }}>{weekSummary.summary.uniqueProperties}</p>
                    <p className="text-[10px]" style={{ color: C.muted }}>Propiedades</p>
                  </div>
                </div>
              </div>

              {/* Staff Selection */}
              <div>
                <p className="text-[11px] font-bold uppercase mb-2" style={{ color: C.muted }}>
                  Staff asignado por defecto
                </p>
                <div className="flex flex-wrap gap-2">
                  {staffList.map(staff => {
                    const isSelected = selectedStaffIds.includes(staff.id)
                    const isDefault = staff.defaultAssignment
                    return (
                      <button
                        key={staff.id}
                        onClick={() => toggleStaff(staff.id)}
                        className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all"
                        style={{
                          background: isSelected ? (isDefault ? C.teal : C.primary) : C.bg,
                          color: isSelected ? 'white' : C.slate,
                          border: `1.5px solid ${isSelected ? 'transparent' : C.border}`
                        }}
                      >
                        {staff.initials || staff.name?.substring(0, 2).toUpperCase()}
                        {isDefault && ' ★'}
                      </button>
                    )
                  })}
                </div>
                {selectedStaffIds.length === 0 && (
                  <p className="text-[10px] mt-2" style={{ color: C.amber }}>
                    ⚠️ No hay staff seleccionado
                  </p>
                )}
                {selectedStaffIds.length > 0 && (
                  <p className="text-[10px] mt-2" style={{ color: C.muted }}>
                    {selectedStaffIds.length} seleccionado(s): {staffList.filter(s => selectedStaffIds.includes(s.id)).map(s => s.name).join(', ')}
                  </p>
                )}
              </div>

              {/* Rating Selection */}
              <div>
                <p className="text-[11px] font-bold uppercase mb-2" style={{ color: C.muted }}>
                  Rating por defecto (condición esperada)
                </p>
                <div className="flex gap-2">
                  {[
                    { value: 3, label: 'Bueno', emoji: '😊', color: C.green },
                    { value: 2, label: 'Normal', emoji: '😐', color: C.amber },
                    { value: 1, label: 'Malo', emoji: '😟', color: C.red },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDefaultRating(opt.value)}
                      className="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all"
                      style={{
                        background: defaultRating === opt.value ? opt.color : C.bg,
                        color: defaultRating === opt.value ? 'white' : C.slate,
                        border: `1.5px solid ${defaultRating === opt.value ? 'transparent' : C.border}`
                      }}
                    >
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info box */}
              <div className="p-3 rounded-2xl" style={{ background: C.primaryLight }}>
                <p className="text-[10px] font-medium" style={{ color: C.primary }}>
                  ℹ️ Cada Cleaning se creará con Status: <b>Scheduled</b>
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowLaunchConfirm(false)}
                  className="flex-1 py-3 rounded-2xl font-bold text-[13px]"
                  style={{ border: `2px solid ${C.border}`, color: C.slate }}>
                  Cancelar
                </button>
                <button onClick={handleLaunchWeek} disabled={launchingWeek}
                  className="flex-1 py-3 rounded-2xl font-black text-[13px] text-white flex items-center justify-center gap-2"
                  style={{ background: launchingWeek ? C.muted : C.teal }}>
                  {launchingWeek ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" />
                      Lanzar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
