import { useState, useEffect, useCallback, useRef } from 'react'
import { Profile } from '../supabase'
import {
  MapPin, Users, RefreshCw,
  Calendar, X, ExternalLink
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
  staffList: { name: string; initials: string }[]
  staffListText: string; googleMapsUrl: string; thumbnail: string | null
  coords: { lat: number; lng: number } | null; bookUrl: string | null
}

interface Incident {
  id: string; name: string; status: string; comment?: string; photoUrls: string[]
}

interface InventoryItem {
  id: string; status: string; comment?: string; photoUrls: string[]
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

      <div className="overflow-x-auto">
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
            return (
              <div key={group.staffListText} className="border-b last:border-0" style={{ borderColor: C.border }}>
                {/* Group header row */}
                <div className="flex items-center" style={{ background: '#FAFBFC' }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ width: '180px', minWidth: '180px' }}>
                    <div className="flex items-center">
                      {group.staffListText.split(',').slice(0, 3).map((name, i) => (
                        <div key={i} className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-[9px] text-white border border-white"
                          style={{ background: C.primary, marginLeft: i > 0 ? '-4px' : 0 }}>
                          {name.trim().substring(0, 2).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold truncate" style={{ color: C.ink }}>
                        {group.staffListText.split(',')[0]?.trim()}
                        {group.staffListText.split(',').length > 1 && <span style={{ color: C.muted }}> +{group.staffListText.split(',').length - 1}</span>}
                      </p>
                      <p className="text-[10px] font-semibold" style={{ color: groupPct === 100 ? C.green : C.primary }}>{groupPct}% · {group.done}/{group.total}</p>
                    </div>
                  </div>
                  <div className="flex-1 relative py-2 pr-4" style={{ height: '48px' }}>
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

                  // Estimate duration: default 2hrs, adjust if we have start+end
                  let durationPct = (2 / TOTAL_HOURS) * 100
                  if (c.startTime && c.endTime) {
                    const start = timeToPercent(c.startTime) || schedPct || 0
                    const end = timeToPercent(c.endTime) || start + durationPct
                    durationPct = end - start
                  }

                  const barLeft = schedPct ?? 0
                  const realLeft = c.startTime ? (timeToPercent(c.startTime) ?? barLeft) : null

                  return (
                    <div key={c.id} className="flex items-center border-t" style={{ borderColor: C.border }}>
                      <div className="px-4 py-1.5 flex items-center gap-2" style={{ width: '180px', minWidth: '180px' }}>
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sc.dot }} />
                        <p className="text-[11px] font-medium truncate" style={{ color: C.slate }}>{c.propertyText}</p>
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
                        {/* Scheduled bar (gray) */}
                        {schedPct !== null && (
                          <div className="absolute rounded-xl flex items-center px-2 overflow-hidden"
                            style={{
                              left: `${barLeft}%`,
                              width: `${Math.max(durationPct, 4)}%`,
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

      {/* Gantt Timeline */}
      {data && data.timeline.length > 0 && <GanttTimeline timeline={data.timeline} onSelect={setSelected} />}
      {(!data?.timeline || data.timeline.length === 0) && (
        <div className="rounded-3xl flex flex-col items-center py-12 gap-2 shadow-sm" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.muted }}>
          <Calendar className="w-8 h-8 opacity-30" />
          <p className="text-[13px] font-medium">Sin limpiezas para esta fecha</p>
        </div>
      )}

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
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 pr-4">
                  <p className="font-black text-[17px] leading-tight" style={{ color: C.ink }}>{selected.propertyText}</p>
                  <p className="text-[12px] font-medium mt-0.5" style={{ color: C.muted }}>{selected.address}</p>
                </div>
                <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: C.bg }}>
                  <X className="w-4 h-4" style={{ color: C.slate }} />
                </button>
              </div>

              {/* Status */}
              {(() => {
                const sc = STATUS_COLORS[selected.status] || STATUS_COLORS['Programmed']
                return <span className="text-[11px] font-bold px-3 py-1.5 rounded-full inline-block mb-3" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
              })()}

              {/* Times grid */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: 'Inicio Prog.', value: selected.scheduledTime, color: C.ink },
                  { label: 'Inicio Real', value: selected.startTime, color: selected.startTime ? C.green : C.muted },
                  { label: 'Fin Prog.', value: selected.estimatedEndTime, color: C.ink },
                  { label: 'Fin Real', value: selected.endTime, color: selected.endTime ? C.green : C.muted },
                ].map(t => (
                  <div key={t.label} className="p-2.5 rounded-2xl" style={{ background: C.bg }}>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: C.muted }}>{t.label}</p>
                    <p className="font-black text-[15px]" style={{ color: t.color }}>{fmt(t.value)}</p>
                  </div>
                ))}
              </div>

              {/* Staff */}
              {selected.staffList?.length > 0 && (
                <div className="flex items-center gap-2 mb-3 p-2.5 rounded-2xl" style={{ background: C.bg }}>
                  <Users className="w-3.5 h-3.5 shrink-0" style={{ color: C.muted }} />
                  <p className="text-[12px] font-semibold" style={{ color: C.slate }}>{selected.staffList.map(s => s.name).join(', ')}</p>
                </div>
              )}

              {/* Incidents */}
              {loadingDetail ? (
                <div className="flex justify-center py-3"><div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: C.border, borderTopColor: C.primary }} /></div>
              ) : (
                <>
                  {incidents.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Incidentes ({incidents.length})</p>
                      <div className="space-y-1.5">
                        {incidents.map(inc => (
                          <div key={inc.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: '#FEF3C7' }}>
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.amber }} />
                            <p className="text-[12px] font-semibold flex-1 truncate" style={{ color: C.ink }}>{inc.name}</p>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: C.amber, color: 'white' }}>{inc.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {inventory.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Inventario ({inventory.length})</p>
                      <div className="space-y-1.5">
                        {inventory.map(inv => (
                          <div key={inv.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: inv.status === 'Out of Stock' ? '#FEE2E2' : '#FEF3C7' }}>
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: inv.status === 'Out of Stock' ? C.red : C.amber }} />
                            <p className="text-[12px] font-semibold flex-1 truncate" style={{ color: C.ink }}>{inv.comment || inv.status}</p>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: inv.status === 'Out of Stock' ? C.red : C.amber, color: 'white' }}>{inv.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-1">
                {selected.googleMapsUrl && (
                  <a href={selected.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[12px] font-bold"
                    style={{ background: C.primaryLight, color: C.primary }}>
                    <MapPin className="w-3.5 h-3.5" /> Maps
                  </a>
                )}
                <a href="https://shineup-ops.vercel.app" target="_blank" rel="noopener noreferrer"
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
