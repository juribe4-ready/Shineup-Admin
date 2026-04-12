import { useState, useEffect, useCallback, useRef } from 'react'
import { Profile } from '../supabase'
import {
  MapPin, Users, RefreshCw,
  Calendar, X, ExternalLink,
  Clock, Filter, Zap
} from 'lucide-react'

const C = {
  primary:     '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight:'#EEF2FF',
  headerBg:    '#1E293B',
  headerMid:   '#334155',
  ink:         '#0F172A',
  slate:       '#475569',
  muted:       '#94A3B8',
  border:      '#E2E8F0',
  bg:          '#F8FAFC',
  white:       '#FFFFFF',
  green:       '#10B981',
  red:         '#EF4444',
  amber:       '#F59E0B',
  blue:        '#3B82F6',
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string; dot: string }> = {
  'Done':        { bg: '#DCFCE7', color: '#059669', label: 'Terminada',  dot: '#10B981' },
  'In Progress': { bg: '#DBEAFE', color: '#2563EB', label: 'En Progreso', dot: '#3B82F6' },
  'Opened':      { bg: '#FEF3C7', color: '#D97706', label: 'Abierta',    dot: '#F59E0B' },
  'Programmed':  { bg: '#F1F5F9', color: '#475569', label: 'Programada', dot: '#94A3B8' },
  'Scheduled':   { bg: '#F1F5F9', color: '#475569', label: 'Programada', dot: '#94A3B8' },
}

interface Cleaning {
  id: string; cleaningId: string; propertyText: string; address: string
  propertyId: string; status: string; scheduledTime: string | null
  startTime: string | null; endTime: string | null
  estimatedEndTime?: string | null
  rating?: number | null
  staffList: { name: string; initials: string; role?: string }[]
  staffListText: string; googleMapsUrl: string; thumbnail: string | null
  coords: { lat: number; lng: number } | null; bookUrl: string | null
  videoInicial?: string[]
  photosVideos?: { url: string; filename: string }[]
  storagePhoto?: string | null
  openComments?: string
  labor?: number
}

interface Incident {
  id: string; name: string; status: string; comment?: string; photoUrls: string[]
}

interface InventoryItem {
  id: string; status: string; comment?: string; photoUrls: string[]
}

interface TimelineGroup {
  staffListText: string
  cleanerStaff?: { name: string; initials: string; role?: string }[]
  cleanings: Cleaning[]
  total: number; done: number; inProgress: number; programmed: number
  avgRating?: number | null
  avgDurationMin?: number | null
  onTimeRate?: number | null
}

interface DashboardData {
  cleanings: Cleaning[]
  timeline: TimelineGroup[]
  stats: { total: number; done: number; inProgress: number; programmed: number; opened: number }
  date: string
}

interface Props {
  profile: Profile
}

const fmt = (v?: string | null) => {
  if (!v) return '--:--'
  try { return new Date(v).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '--:--' }
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

declare global {
  interface Window { google: any; initMap: () => void }
}


// ─── Gantt Timeline ───────────────────────────────────────────────────────────
const HOUR_START = 7  // 7am
const HOUR_END   = 20 // 8pm
const TOTAL_HOURS = HOUR_END - HOUR_START

function timeToPercent(isoString: string | null): number | null {
  if (!isoString) return null
  const d = new Date(isoString)
  const hours = d.getHours() + d.getMinutes() / 60
  const clamped = Math.max(HOUR_START, Math.min(HOUR_END, hours))
  return ((clamped - HOUR_START) / TOTAL_HOURS) * 100
}

function GanttTimeline({ timeline, onSelect }: { timeline: TimelineGroup[]; onSelect: (c: Cleaning) => void }) {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => HOUR_START + i)
  const nowPct = timeToPercent(new Date().toISOString())

  return (
    <div className="rounded-3xl overflow-hidden shadow-sm" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <p className="font-black text-[14px]" style={{ color: C.ink }}>Timeline por Grupo</p>
        <p className="text-[12px] font-medium mt-0.5" style={{ color: C.muted }}>{timeline.length} grupos · eje horario {HOUR_START}am–{HOUR_END - 12}pm</p>
      </div>

      <div className="overflow-x-auto" style={{ position: 'relative' }}>
        <div style={{ minWidth: '700px' }}>

          {/* Hour axis */}
          <div className="flex border-b" style={{ borderColor: C.border }}>
            <div style={{ width: '180px', minWidth: '180px' }} className="px-4 py-2" />
            <div className="flex-1 relative px-0 py-2">
              <div className="flex justify-between px-0">
                {hours.map(h => (
                  <span key={h} className="text-[10px] font-bold" style={{ color: C.muted }}>
                    {h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Groups */}
          {timeline.map(group => {
            const groupPct = group.total > 0 ? Math.round((group.done / group.total) * 100) : 0
            // Use cleanerStaff from API (already filtered to cleaners only)
            const cleanerStaff = group.cleanerStaff || []
            return (
              <div key={group.staffListText} className="border-b last:border-0" style={{ borderColor: C.border }}>
                {/* Group header row */}
                <div className="flex items-center" style={{ background: '#FAFBFC' }}>
                  <div className="px-3 py-3 flex flex-col gap-1.5" style={{ width: '180px', minWidth: '180px', position: 'sticky', left: 0, background: '#FAFBFC', zIndex: 10 }}>
                    <div className="flex flex-wrap gap-1 items-center">
                      {cleanerStaff.map((s, i) => {
                        const roleColor = s.role?.includes('Wknd') ? '#D97706' : s.role?.toLowerCase().includes('prueba') ? '#EC4899' : C.primary
                        return (
                          <div key={i} className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-[9px] text-white"
                            style={{ background: roleColor }}>
                            {s.initials || s.name.substring(0, 2).toUpperCase()}
                          </div>
                        )
                      })}
                      {group.avgRating && (
                        <div className="ml-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md" 
                          style={{ background: group.avgRating >= 2.5 ? '#DCFCE7' : group.avgRating >= 1.5 ? '#FEF3C7' : '#FEE2E2' }}>
                          <span style={{ fontSize: '10px' }}>⭐</span>
                          <span className="text-[9px] font-bold" style={{ color: group.avgRating >= 2.5 ? '#059669' : group.avgRating >= 1.5 ? '#D97706' : '#DC2626' }}>
                            {group.avgRating.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-semibold" style={{ color: groupPct === 100 ? C.green : C.primary }}>{groupPct}% · {group.done}/{group.total}</p>
                  </div>
                  <div className="flex-1 relative py-2 pr-4" style={{ height: '56px' }}>
                    {/* Grid lines */}
                    {hours.map((h, i) => (
                      <div key={h} className="absolute top-0 bottom-0 w-px" style={{ left: `${(i / TOTAL_HOURS) * 100}%`, background: C.border, opacity: 0.5 }} />
                    ))}
                    {/* Now line */}
                    {nowPct !== null && (
                      <div className="absolute top-0 bottom-0 w-0.5 z-10" style={{ left: `${nowPct}%`, background: C.red, opacity: 0.7 }} />
                    )}
                  </div>
                </div>

                {/* Cleaning bars */}
                {group.cleanings.map(c => {
                  const sc = STATUS_COLORS[c.status] || STATUS_COLORS['Programmed']
                  const schedPct = timeToPercent(c.scheduledTime)
                  const estEndPct = timeToPercent(c.estimatedEndTime || null)

                  // Calculate duration from scheduled to estimated end, or use actual times if available
                  let durationPct = (1.5 / TOTAL_HOURS) * 100 // default 1.5hrs if no estimate
                  if (c.startTime && c.endTime) {
                    // Use actual duration for completed cleanings
                    const start = timeToPercent(c.startTime) || schedPct || 0
                    const end = timeToPercent(c.endTime) || start + durationPct
                    durationPct = Math.max(end - start, 2)
                  } else if (schedPct !== null && estEndPct !== null) {
                    // Use estimated duration
                    durationPct = Math.max(estEndPct - schedPct, 2)
                  }

                  const barLeft = schedPct ?? 0
                  const realLeft = c.startTime ? (timeToPercent(c.startTime) ?? barLeft) : null

                  return (
                    <div key={c.id} className="flex items-center border-t" style={{ borderColor: C.border }}>
                      <div className="px-3 py-1.5 flex items-center gap-2" style={{ width: '180px', minWidth: '180px', position: 'sticky', left: 0, background: C.white, zIndex: 10 }}>
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5" style={{ background: sc.dot }} />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium truncate leading-tight" style={{ color: C.slate }}>{c.propertyText}</p>
                          <p className="text-[9px] font-bold" style={{ color: C.muted }}>
                            {c.scheduledTime ? new Date(c.scheduledTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}
                            {c.estimatedEndTime ? ` → ${new Date(c.estimatedEndTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex-1 relative py-2 pr-4 cursor-pointer" style={{ height: '40px' }} onClick={() => onSelect(c)}>
                        {/* Grid lines */}
                        {hours.map((h, i) => (
                          <div key={h} className="absolute top-0 bottom-0 w-px" style={{ left: `${(i / TOTAL_HOURS) * 100}%`, background: C.border, opacity: 0.3 }} />
                        ))}
                        {/* Now line */}
                        {nowPct !== null && (
                          <div className="absolute top-0 bottom-0 w-0.5 z-10" style={{ left: `${nowPct}%`, background: C.red, opacity: 0.5 }} />
                        )}
                        {/* Scheduled bar (gray) - width based on estimated duration */}
                        {schedPct !== null && (
                          <div className="absolute rounded-xl flex items-center px-2 overflow-hidden"
                            style={{
                              left: `${barLeft}%`,
                              width: `${Math.max(durationPct, 3)}%`,
                              top: '6px', bottom: '6px',
                              background: '#E2E8F0',
                              opacity: c.startTime ? 0.5 : 1,
                            }}>
                            <span className="text-[9px] font-bold truncate" style={{ color: C.muted }}>{c.scheduledTime ? new Date(c.scheduledTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          </div>
                        )}
                        {/* Real bar (colored) */}
                        {realLeft !== null && (
                          <div className="absolute rounded-xl flex items-center px-2 overflow-hidden hover:opacity-90 transition-opacity"
                            style={{
                              left: `${realLeft}%`,
                              width: `${Math.max(c.status === 'Done' && c.endTime ? (timeToPercent(c.endTime)! - realLeft) : durationPct * 0.6, 3)}%`,
                              top: '4px', bottom: '4px',
                              background: sc.dot,
                            }}>
                            <span className="text-[9px] font-black text-white truncate">
                              {c.status === 'Done' ? '✓' : c.status === 'In Progress' ? '▶' : ''} {c.startTime ? new Date(c.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage({ profile: _profile }: Props) {
  const [data, setData]           = useState<DashboardData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [date, setDate]           = useState(today())
  const [selected, setSelected]     = useState<Cleaning | null>(null)
  const [incidents, setIncidents]   = useState<Incident[]>([])
  const [inventory, setInventory]   = useState<InventoryItem[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [mapReady, setMapReady]   = useState(false)
  const [autoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [ganttFilter, setGanttFilter] = useState<'all' | 'inProgress' | 'done'>('all')
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObj    = useRef<any>(null)
  const markers   = useRef<any[]>([])
  const infoWindow = useRef<any>(null)

  const loadDetail = async (cleaning: Cleaning) => {
    setSelected(cleaning)
    setIncidents([]); setInventory([])
    if (!cleaning.propertyId) return
    setLoadingDetail(true)
    try {
      const [incRes, invRes] = await Promise.all([
        fetch(`/api/getIncidents?propertyId=${cleaning.propertyId}`),
        fetch(`/api/getInventory?propertyId=${cleaning.propertyId}`)
      ])
      if (incRes.ok) setIncidents(await incRes.json())
      if (invRes.ok) setInventory(await invRes.json())
    } catch {}
    finally { setLoadingDetail(false) }
  }

  const loadData = useCallback(async (d?: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/getDashboard?date=${d || date}`)
      if (!res.ok) throw new Error('Error al cargar')
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [date])

  // Load Google Maps script
  useEffect(() => {
    if (window.google?.maps) { setMapReady(true); return }
    const key = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY || ''
    ;(window as any).initMap = () => setMapReady(true)
    const existing = document.getElementById('gmaps-script')
    if (!existing) {
      const script = document.createElement('script')
      script.id = 'gmaps-script'
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=initMap&loading=async`
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
    return () => { (window as any).initMap = undefined }
  }, [])

  useEffect(() => { loadData(date) }, [date])

  // Auto refresh every 2 minutes
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => loadData(date), 120000)
    return () => clearInterval(interval)
  }, [autoRefresh, date, loadData])

  // Geocode addresses in frontend
  useEffect(() => {
    if (!data || !window.google?.maps) return
    const geocoder = new window.google.maps.Geocoder()
    data.cleanings.forEach(c => {
      if (c.coords || !c.address) return
      geocoder.geocode({ address: c.address }, (results: any, status: any) => {
        if (status === 'OK' && results[0]) {
          c.coords = {
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          }
          // Force re-render markers
          setData(prev => prev ? { ...prev } : prev)
        }
      })
    })
  }, [data, mapReady])

  // Initialize map
  useEffect(() => {
    if (!mapReady || !mapRef.current || !data) return
    if (!mapObj.current) {
      mapObj.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 39.9612, lng: -82.9988 }, // Columbus, OH
        zoom: 11,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })
      infoWindow.current = new window.google.maps.InfoWindow()
    }

    // Clear existing markers
    markers.current.forEach(m => m.setMap(null))
    markers.current = []

    // Add markers
    for (const c of data.cleanings) {
      if (!c.coords) continue
      const sc = STATUS_COLORS[c.status] || STATUS_COLORS['Programmed']
      const marker = new window.google.maps.Marker({
        position: c.coords,
        map: mapObj.current,
        title: c.propertyText,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: sc.dot,
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      })
      marker.addListener('click', () => setSelected(c))
      markers.current.push(marker)
    }

    // Fit bounds
    if (data.cleanings.filter(c => c.coords).length > 0) {
      const bounds = new window.google.maps.LatLngBounds()
      data.cleanings.filter(c => c.coords).forEach(c => bounds.extend(c.coords!))
      mapObj.current.fitBounds(bounds)
    }
  }, [mapReady, data])

  const handleDateChange = (d: string) => {
    setDate(d)
    loadData(d)
  }

  if (loading && !data) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: C.border, borderTopColor: C.primary }} />
    </div>
  )

  const stats = data?.stats || { total: 0, done: 0, inProgress: 0, programmed: 0, opened: 0 }
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

  // Filter timeline
  const filteredTimeline = data?.timeline.map(group => {
    if (ganttFilter === 'all') return group
    const filtered = group.cleanings.filter(c => {
      if (ganttFilter === 'inProgress') return c.status === 'In Progress' || c.status === 'Opened'
      if (ganttFilter === 'done') return c.status === 'Done'
      return true
    })
    return { ...group, cleanings: filtered, total: filtered.length }
  }).filter(g => g.cleanings.length > 0) || []

  return (
    <div className="space-y-6">

      {/* Stats + Date selector + LIVE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-black text-[22px]" style={{ color: C.ink }}>Dashboard</h2>
            {date === today() && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: '#DCFCE7' }}>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.green }} />
                <span className="text-[10px] font-black uppercase" style={{ color: C.green }}>Live</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[13px] font-medium" style={{ color: C.muted }}>
              {stats.total} limpiezas · {pct}% completado
            </p>
            {lastUpdated && (
              <span className="text-[11px]" style={{ color: C.muted }}>
                · {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={e => handleDateChange(e.target.value)}
            className="px-3 py-2 rounded-2xl text-[13px] font-medium outline-none"
            style={{ border: `1.5px solid ${C.border}`, fontFamily: 'Poppins, sans-serif', color: C.ink }} />
          <button onClick={() => handleDateChange(today())}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[12px] font-bold transition-all"
            style={{ background: date === today() ? C.primaryLight : C.bg, color: date === today() ? C.primary : C.muted, border: `1.5px solid ${C.border}` }}>
            <Calendar className="w-3.5 h-3.5" /> Hoy
          </button>
          <button onClick={() => loadData(date)} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[12px] font-bold transition-all"
            style={{ background: C.bg, color: C.slate, border: `1.5px solid ${C.border}` }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',       value: stats.total,      color: C.ink,     bg: C.white },
          { label: 'Programadas', value: stats.programmed, color: C.muted,   bg: C.white },
          { label: 'Abiertas',    value: stats.opened,     color: '#D97706', bg: '#FFFBEB' },
          { label: 'En Progreso', value: stats.inProgress, color: C.blue,    bg: '#EFF6FF' },
          { label: 'Terminadas',  value: stats.done,       color: C.green,   bg: '#ECFDF5' },
        ].map(s => (
          <div key={s.label} className="rounded-3xl p-4 shadow-sm" style={{ background: s.bg, border: `1px solid ${C.border}` }}>
            <p className="font-black text-[28px] leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] font-semibold mt-1 uppercase tracking-wide" style={{ color: C.muted }}>{s.label}</p>
            {s.label === 'Terminadas' && stats.total > 0 && (
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: '#D1FAE5' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.green }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="rounded-3xl overflow-hidden shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
          <p className="font-black text-[14px]" style={{ color: C.ink }}>Mapa de Limpiezas</p>
          <div className="flex items-center gap-4 text-[11px] font-semibold">
            {Object.entries(STATUS_COLORS).filter(([k]) => ['Done', 'In Progress', 'Opened', 'Programmed'].includes(k)).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: v.dot }} />
                <span style={{ color: C.muted }}>{v.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div ref={mapRef} style={{ height: '420px', background: C.bg }}>
          {!mapReady && (
            <div className="flex items-center justify-center h-full" style={{ color: C.muted }}>
              <div className="text-center">
                <div className="w-8 h-8 border-3 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: C.border, borderTopColor: C.primary }} />
                <p className="text-[13px] font-medium">Cargando mapa...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gantt Timeline con filtros */}
      {data && data.timeline.length > 0 && (
        <div className="space-y-3">
          {/* Filtros */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4" style={{ color: C.muted }} />
            {[
              { key: 'all', label: 'Todos' },
              { key: 'inProgress', label: '▶ En Progreso' },
              { key: 'done', label: '✓ Terminados' },
            ].map(f => (
              <button key={f.key} onClick={() => setGanttFilter(f.key as typeof ganttFilter)}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all"
                style={{
                  background: ganttFilter === f.key ? C.primary : C.bg,
                  color: ganttFilter === f.key ? C.white : C.slate,
                  border: `1.5px solid ${ganttFilter === f.key ? C.primary : C.border}`,
                }}>
                {f.label}
              </button>
            ))}
          </div>
          <GanttTimeline timeline={filteredTimeline} onSelect={loadDetail} />
        </div>
      )}
      {(!data?.timeline || data.timeline.length === 0) && (
        <div className="rounded-3xl flex flex-col items-center py-12 gap-2 shadow-sm" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.muted }}>
          <Calendar className="w-8 h-8 opacity-30" />
          <p className="text-[13px] font-medium">Sin limpiezas para esta fecha</p>
        </div>
      )}

      {/* Panel de Métricas */}
      {data && data.timeline.length > 0 && (
        <div className="rounded-3xl overflow-hidden shadow-sm" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
            <p className="font-black text-[14px]" style={{ color: C.ink }}>Métricas del Día</p>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Avance */}
            <div className="p-3 rounded-2xl" style={{ background: pct === 100 ? '#DCFCE7' : C.bg }}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: C.muted }}>Avance</p>
              <p className="font-black text-[28px] leading-none" style={{ color: pct === 100 ? C.green : C.primary }}>{pct}%</p>
              <p className="text-[10px] font-medium mt-1" style={{ color: C.slate }}>{stats.done}/{stats.total}</p>
            </div>
            {/* Rating Promedio */}
            {(() => {
              const withRating = data.timeline.filter(g => g.avgRating)
              const avgRating = withRating.length > 0 ? withRating.reduce((s, g) => s + (g.avgRating || 0), 0) / withRating.length : null
              return (
                <div className="p-3 rounded-2xl" style={{ background: avgRating && avgRating >= 2.5 ? '#DCFCE7' : avgRating ? '#FEF3C7' : C.bg }}>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: C.muted }}>Rating</p>
                  {avgRating ? (
                    <div className="flex items-center gap-1">
                      <span className="font-black text-[28px] leading-none" style={{ color: avgRating >= 2.5 ? C.green : C.amber }}>{avgRating.toFixed(1)}</span>
                      <span className="text-[16px]">⭐</span>
                    </div>
                  ) : (
                    <p className="font-black text-[18px]" style={{ color: C.muted }}>--</p>
                  )}
                </div>
              )
            })()}
            {/* Tiempo Promedio */}
            {(() => {
              const withDuration = data.timeline.filter(g => g.avgDurationMin)
              const avgMin = withDuration.length > 0 ? Math.round(withDuration.reduce((s, g) => s + (g.avgDurationMin || 0), 0) / withDuration.length) : null
              const h = avgMin ? Math.floor(avgMin / 60) : 0
              const m = avgMin ? avgMin % 60 : 0
              return (
                <div className="p-3 rounded-2xl" style={{ background: C.bg }}>
                  <div className="flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3" style={{ color: C.muted }} />
                    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Tiempo Prom</p>
                  </div>
                  <p className="font-black text-[22px] leading-none" style={{ color: C.slate }}>
                    {avgMin ? (h > 0 ? `${h}h ${m}m` : `${m}m`) : '--'}
                  </p>
                </div>
              )
            })()}
            {/* Puntualidad */}
            {(() => {
              const withOnTime = data.timeline.filter(g => g.onTimeRate !== null && g.onTimeRate !== undefined)
              const avgOnTime = withOnTime.length > 0 ? Math.round(withOnTime.reduce((s, g) => s + (g.onTimeRate || 0), 0) / withOnTime.length) : null
              return (
                <div className="p-3 rounded-2xl" style={{ background: avgOnTime && avgOnTime >= 80 ? '#DCFCE7' : avgOnTime ? '#FEF3C7' : C.bg }}>
                  <div className="flex items-center gap-1 mb-1">
                    <Zap className="w-3 h-3" style={{ color: C.muted }} />
                    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Puntualidad</p>
                  </div>
                  <p className="font-black text-[28px] leading-none" style={{ color: avgOnTime && avgOnTime >= 80 ? C.green : avgOnTime ? C.amber : C.muted }}>
                    {avgOnTime !== null ? `${avgOnTime}%` : '--'}
                  </p>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* CLEANING DETAIL MODAL */}
      {selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: 'rgba(15,23,42,0.7)' }} onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl" style={{ background: C.white, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="sticky top-0 z-10 px-5 py-4 flex items-start justify-between" style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
              <div className="flex-1 pr-4">
                <p className="font-black text-[17px] leading-tight" style={{ color: C.ink }}>{selected.propertyText}</p>
                <p className="text-[12px] font-medium mt-0.5" style={{ color: C.muted }}>{selected.address}</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: C.bg }}>
                <X className="w-4 h-4" style={{ color: C.slate }} />
              </button>
            </div>

            <div className="p-5 space-y-4">

              {/* Status + times */}
              <div>
                {(() => {
                  const sc = STATUS_COLORS[selected.status] || STATUS_COLORS['Programmed']
                  return <span className="text-[11px] font-bold px-3 py-1.5 rounded-full inline-block mb-3" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                })()}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Inicio Prog.', value: selected.scheduledTime, color: C.ink },
                    { label: 'Inicio Real',  value: selected.startTime,     color: selected.startTime ? C.green : C.muted },
                    { label: 'Fin Prog.',    value: selected.estimatedEndTime, color: C.ink },
                    { label: 'Fin Real',     value: selected.endTime,       color: selected.endTime ? C.green : C.muted },
                  ].map(t => (
                    <div key={t.label} className="p-2.5 rounded-2xl" style={{ background: C.bg }}>
                      <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: C.muted }}>{t.label}</p>
                      <p className="font-black text-[15px]" style={{ color: t.color }}>{fmt(t.value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff */}
              {selected.staffList?.length > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-2xl" style={{ background: C.bg }}>
                  <Users className="w-3.5 h-3.5 shrink-0" style={{ color: C.muted }} />
                  <p className="text-[12px] font-semibold" style={{ color: C.slate }}>{selected.staffList.map(s => s.name).join(', ')}</p>
                </div>
              )}

              {/* Open comments */}
              {selected.openComments && (
                <div className="p-3 rounded-2xl" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.amber }}>Notas de apertura</p>
                  <p className="text-[12px] font-medium leading-relaxed" style={{ color: C.ink }}>{selected.openComments}</p>
                </div>
              )}

              {/* VIDEO INICIAL */}
              {selected.videoInicial && selected.videoInicial.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Video Inicial ({selected.videoInicial.length})</p>
                  <div className="flex gap-2 flex-wrap">
                    {selected.videoInicial.map((url, i) => {
                      const isVid = url.includes('/video/') || /\.(mp4|mov|webm)$/i.test(url)
                      return (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="relative w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center hover:opacity-80 transition-opacity"
                          style={{ background: isVid ? C.ink : C.bg, border: `2px solid ${C.border}` }}>
                          {isVid ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-2xl">🎥</span>
                              <span className="text-[8px] font-black text-white">VER</span>
                            </div>
                          ) : (
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.4)' }}>
                            <ExternalLink className="w-5 h-5 text-white" />
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* FOTOS/VIDEOS DE CIERRE */}
              {selected.photosVideos && selected.photosVideos.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Fotos/Videos de Cierre ({selected.photosVideos.length})</p>
                  <div className="flex gap-2 flex-wrap">
                    {selected.photosVideos.map((photo, i) => {
                      const isVid = photo.url.includes('/video/') || /\.(mp4|mov|webm)$/i.test(photo.filename || '')
                      return (
                        <a key={i} href={photo.url} target="_blank" rel="noopener noreferrer"
                          className="relative w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center hover:opacity-80 transition-opacity"
                          style={{ background: isVid ? C.ink : C.bg, border: `2px solid ${C.border}` }}>
                          {isVid ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-2xl">🎥</span>
                              <span className="text-[8px] font-black text-white">VER</span>
                            </div>
                          ) : (
                            <img src={photo.url} alt="" className="w-full h-full object-cover"
                              onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.4)' }}>
                            <ExternalLink className="w-5 h-5 text-white" />
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* FOTO DEL ALMACÉN */}
              {selected.storagePhoto && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Foto del Almacén</p>
                  <a href={selected.storagePhoto} target="_blank" rel="noopener noreferrer"
                    className="relative block rounded-2xl overflow-hidden hover:opacity-90 transition-opacity" style={{ height: '120px' }}>
                    <img src={selected.storagePhoto} alt="almacén" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.3)' }}>
                      <ExternalLink className="w-6 h-6 text-white" />
                    </div>
                  </a>
                </div>
              )}

              {/* INCIDENTES + RUPTURAS */}
              {loadingDetail ? (
                <div className="flex justify-center py-3"><div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: C.border, borderTopColor: C.primary }} /></div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {/* Incidentes */}
                  <div className="rounded-2xl p-3" style={{ background: incidents.length > 0 ? '#FEF3C7' : C.bg, border: `1px solid ${incidents.length > 0 ? '#FDE68A' : C.border}` }}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.muted }}>Incidentes</p>
                    <p className="font-black text-[28px] leading-none mb-1" style={{ color: incidents.length > 0 ? C.amber : C.muted }}>{incidents.length}</p>
                    {incidents.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {incidents.slice(0, 3).map(inc => (
                          <p key={inc.id} className="text-[10px] font-semibold truncate" style={{ color: C.slate }}>• {inc.name}</p>
                        ))}
                        {incidents.length > 3 && <p className="text-[10px] font-bold" style={{ color: C.amber }}>+{incidents.length - 3} más</p>}
                      </div>
                    )}
                  </div>
                  {/* Rupturas */}
                  <div className="rounded-2xl p-3" style={{ background: inventory.length > 0 ? '#FEE2E2' : C.bg, border: `1px solid ${inventory.length > 0 ? '#FECACA' : C.border}` }}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.muted }}>Rupturas</p>
                    <p className="font-black text-[28px] leading-none mb-1" style={{ color: inventory.length > 0 ? C.red : C.muted }}>{inventory.length}</p>
                    {inventory.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {inventory.slice(0, 3).map(inv => (
                          <p key={inv.id} className="text-[10px] font-semibold truncate" style={{ color: C.slate }}>• {inv.comment || inv.status}</p>
                        ))}
                        {inventory.length > 3 && <p className="text-[10px] font-bold" style={{ color: C.red }}>+{inventory.length - 3} más</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {selected.googleMapsUrl && (
                  <a href={selected.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[12px] font-bold"
                    style={{ background: C.primaryLight, color: C.primary }}>
                    <MapPin className="w-3.5 h-3.5" /> Maps
                  </a>
                )}
                <a href={`https://shineup-ops.vercel.app/?cleaning=${selected.id}`} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-white text-[12px] font-bold"
                  style={{ background: C.primary }}>
                  <ExternalLink className="w-3.5 h-3.5" /> Ver en Ops
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
