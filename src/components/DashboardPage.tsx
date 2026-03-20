import { useState, useEffect, useCallback, useRef } from 'react'
import { Profile } from '../supabase'
import {
  MapPin, Clock, Users, RefreshCw, ChevronRight,
  CheckCircle2, Play, Calendar, X, ExternalLink, Camera
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
  status: string; scheduledTime: string | null; startTime: string | null
  endTime: string | null; staffList: { name: string; initials: string }[]
  staffListText: string; googleMapsUrl: string; thumbnail: string | null
  coords: { lat: number; lng: number } | null; bookUrl: string | null
}

interface TimelineGroup {
  staffListText: string
  cleanings: Cleaning[]
  total: number; done: number; inProgress: number; programmed: number
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

export default function DashboardPage({ profile }: Props) {
  const [data, setData]           = useState<DashboardData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [date, setDate]           = useState(today())
  const [selected, setSelected]   = useState<Cleaning | null>(null)
  const [mapReady, setMapReady]   = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObj    = useRef<any>(null)
  const markers   = useRef<any[]>([])
  const infoWindow = useRef<any>(null)

  const loadData = useCallback(async (d?: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/getDashboard?date=${d || date}`)
      if (!res.ok) throw new Error('Error al cargar')
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [date])

  // Load Google Maps script
  useEffect(() => {
    if (window.google) { setMapReady(true); return }
    const key = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY || ''
    window.initMap = () => setMapReady(true)
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=initMap&libraries=marker`
    script.async = true
    document.head.appendChild(script)
    return () => { delete window.initMap }
  }, [])

  useEffect(() => { loadData(date) }, [date])

  // Auto refresh every 2 minutes
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => loadData(date), 120000)
    return () => clearInterval(interval)
  }, [autoRefresh, date, loadData])

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

  return (
    <div className="space-y-6">

      {/* Stats + Date selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-black text-[22px]" style={{ color: C.ink }}>Dashboard</h2>
          <p className="text-[13px] font-medium mt-0.5" style={{ color: C.muted }}>
            {stats.total} limpiezas · {pct}% completado
          </p>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: C.ink, bg: C.white },
          { label: 'Programadas', value: stats.programmed, color: C.muted, bg: C.white },
          { label: 'En Progreso', value: stats.inProgress, color: C.blue, bg: '#EFF6FF' },
          { label: 'Terminadas', value: stats.done, color: C.green, bg: '#ECFDF5' },
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

      {/* Timeline */}
      <div className="rounded-3xl overflow-hidden shadow-sm" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <p className="font-black text-[14px]" style={{ color: C.ink }}>Timeline por Grupo</p>
          <p className="text-[12px] font-medium mt-0.5" style={{ color: C.muted }}>{data?.timeline.length || 0} grupos activos</p>
        </div>
        <div className="divide-y" style={{ borderColor: C.border }}>
          {(data?.timeline || []).map(group => {
            const groupPct = group.total > 0 ? Math.round((group.done / group.total) * 100) : 0
            return (
              <div key={group.staffListText} className="px-5 py-4">
                {/* Group header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {group.staffListText.split(',').slice(0, 4).map((name, i) => (
                        <div key={i} className="w-7 h-7 rounded-xl flex items-center justify-center font-black text-[10px] text-white"
                          style={{ background: C.primary, marginLeft: i > 0 ? '-4px' : 0, zIndex: 4 - i }}>
                          {name.trim().substring(0, 2).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <p className="font-bold text-[13px]" style={{ color: C.ink }}>{group.staffListText}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold" style={{ color: C.muted }}>{group.done}/{group.total}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: groupPct === 100 ? '#DCFCE7' : C.primaryLight, color: groupPct === 100 ? C.green : C.primary }}>
                      {groupPct}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: C.border }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${groupPct}%`, background: groupPct === 100 ? C.green : C.primary }} />
                </div>

                {/* Cleanings list */}
                <div className="space-y-2">
                  {group.cleanings.map(c => {
                    const sc = STATUS_COLORS[c.status] || STATUS_COLORS['Programmed']
                    return (
                      <button key={c.id} onClick={() => setSelected(c)}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl text-left hover:bg-slate-50 transition-colors active:scale-99"
                        style={{ border: `1px solid ${C.border}` }}>
                        {c.thumbnail ? (
                          <img src={c.thumbnail} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        ) : (
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.bg }}>
                            <MapPin className="w-4 h-4" style={{ color: C.muted }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[13px] truncate" style={{ color: C.ink }}>{c.propertyText}</p>
                          <p className="text-[11px] font-medium truncate" style={{ color: C.muted }}>{c.address}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                          <span className="text-[11px] font-mono" style={{ color: C.muted }}>{fmt(c.scheduledTime)}</span>
                          <ChevronRight className="w-4 h-4" style={{ color: C.muted }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {(!data?.timeline || data.timeline.length === 0) && (
            <div className="flex flex-col items-center py-12 gap-2" style={{ color: C.muted }}>
              <Calendar className="w-8 h-8 opacity-30" />
              <p className="text-[13px] font-medium">Sin limpiezas para esta fecha</p>
            </div>
          )}
        </div>
      </div>

      {/* CLEANING DETAIL MODAL */}
      {selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: 'rgba(15,23,42,0.7)' }} onClick={() => setSelected(null)}>
          <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl" style={{ background: C.white }}
            onClick={e => e.stopPropagation()}>

            {/* Thumbnail */}
            {selected.thumbnail && (
              <div className="w-full h-44 overflow-hidden" style={{ background: C.bg }}>
                <img src={selected.thumbnail} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 pr-4">
                  <p className="font-black text-[17px] leading-tight" style={{ color: C.ink }}>{selected.propertyText}</p>
                  <p className="text-[12px] font-medium mt-0.5" style={{ color: C.muted }}>{selected.address}</p>
                </div>
                <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: C.bg }}>
                  <X className="w-4 h-4" style={{ color: C.slate }} />
                </button>
              </div>

              {/* Status badge */}
              {(() => {
                const sc = STATUS_COLORS[selected.status] || STATUS_COLORS['Programmed']
                return (
                  <span className="text-[11px] font-bold px-3 py-1.5 rounded-full inline-block mb-4" style={{ background: sc.bg, color: sc.color }}>
                    {sc.label}
                  </span>
                )
              })()}

              {/* Times */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-2xl" style={{ background: C.bg }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.muted }}>Programada</p>
                  <p className="font-black text-[16px]" style={{ color: C.ink }}>{fmt(selected.scheduledTime)}</p>
                </div>
                <div className="p-3 rounded-2xl" style={{ background: C.bg }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.muted }}>Inicio Real</p>
                  <p className="font-black text-[16px]" style={{ color: selected.startTime ? C.green : C.muted }}>{fmt(selected.startTime)}</p>
                </div>
              </div>

              {/* Staff */}
              {selected.staffList?.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 shrink-0" style={{ color: C.muted }} />
                  <p className="text-[13px] font-semibold" style={{ color: C.slate }}>
                    {selected.staffList.map(s => s.name).join(', ')}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {selected.googleMapsUrl && (
                  <a href={selected.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[13px] font-bold transition-all"
                    style={{ background: C.primaryLight, color: C.primary }}>
                    <MapPin className="w-4 h-4" /> Ver en Maps
                  </a>
                )}
                <a href={`https://shineup-ops.vercel.app`} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-white text-[13px] font-bold transition-all"
                  style={{ background: C.primary }}>
                  <ExternalLink className="w-4 h-4" /> Ver Detalle
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
