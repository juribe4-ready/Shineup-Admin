import { useState, useEffect, useCallback, useMemo } from 'react'
import { DollarSign, Download, RefreshCw, AlertCircle, TrendingUp, Clock, CheckCircle2, AlertTriangle, SlidersHorizontal, Send, Banknote, X } from 'lucide-react'

const C = {
  primary: '#6366F1', primaryLight: '#EEF2FF',
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', greenLight: '#ECFDF5',
  red: '#EF4444', redLight: '#FEF2F2',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  teal: '#14B8A6', tealLight: '#F0FDFA',
}

const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const thirtyAgo = () => {
  const d = new Date(); d.setDate(d.getDate() - 30)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

interface Cleaning {
  id: string; date: string | null; property: string; clientName: string | null
  cleaningType: string | null; paymentStatus: string | null; status: string | null
  price: number | null; hoursWorked: number | null; hoursTotal: number | null
  staffCount: number; rating: string | null; hasPrice: boolean; source: string | null
}
interface Summary {
  total: number; noPrice: number
  unpaidCount: number; invoicedCount: number; paidCount: number; overdueCount: number
  unpaidAmount: number; invoicedAmount: number; paidAmount: number; overdueAmount: number
  totalRevenue: number
}

const PAY: Record<string, { label: string; bg: string; color: string; Icon: any }> = {
  unpaid:   { label: 'Sin Cobrar', bg: C.amberLight, color: C.amber,  Icon: Clock },
  invoiced: { label: 'Facturado',  bg: C.tealLight,  color: C.teal,   Icon: TrendingUp },
  paid:     { label: 'Cobrado',    bg: C.greenLight,  color: C.green, Icon: CheckCircle2 },
  overdue:  { label: 'Vencido',    bg: C.redLight,    color: C.red,   Icon: AlertTriangle },
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Done':        { bg: '#DCFCE7', color: '#059669' },
  'In Progress': { bg: '#DBEAFE', color: '#2563EB' },
  'Opened':      { bg: '#FEF3C7', color: '#D97706' },
  'Scheduled':   { bg: '#F1F5F9', color: '#475569' },
}

const fmt$ = (n: number | null) => n === null ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
}

const RATING_STYLE: Record<string, { color: string; bg: string }> = {
  '⭐⭐⭐ Bueno':  { color: '#059669', bg: '#DCFCE7' },
  '⭐⭐ Normal': { color: '#6B7280', bg: '#F3F4F6' },
  '⭐ Malo':    { color: '#DC2626', bg: '#FEE2E2' },
}

const sel = (active: boolean) => ({
  height: 38, padding: '0 12px', borderRadius: 10,
  border: `1.5px solid ${active ? C.primary : C.border}`,
  background: active ? C.primaryLight : C.white,
  color: active ? C.primary : C.slate,
  fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer',
} as React.CSSProperties)

// Grid: checkbox | date | property | client | type | #cleaners | rating | status | price | HH | HH Total | pay status
const GRID = '28px 70px 130px 120px 130px 72px 72px 88px 88px 48px 80px 100px'
const COLS = ['', 'Fecha','Propiedad','Cliente','Tipo','#Cleaners','Rating','Status','Precio','HH','HH Total','Cobro']

export default function BillingPage() {
  const [dateFrom, setDateFrom] = useState(thirtyAgo())
  const [dateTo,   setDateTo]   = useState(todayStr())
  const [quickRange, setQuickRange] = useState('custom')
  const [cleanings, setCleanings] = useState<Cleaning[]>([])
  const [summary,   setSummary]   = useState<Summary | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [propFilter,   setPropFilter]   = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [sourceFilter,  setSourceFilter]  = useState('all')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/getReports?type=billing&dateFrom=${dateFrom}&dateTo=${dateTo}`)
      if (!r.ok) throw new Error('Error')
      const d = await r.json()
      setCleanings(d.cleanings || [])
      setSummary(d.summary || null)
    } catch { showToast('Error al cargar datos') }
    finally { setLoading(false) }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])
  // Auto-refresh when filters change
  useEffect(() => { load() }, [propFilter, clientFilter, sourceFilter])
  // Limpiar selección cuando cambian los filtros o se recarga
  useEffect(() => { setSelected(new Set()) }, [statusFilter, propFilter, clientFilter, sourceFilter, dateFrom, dateTo])

  // ---- Rango rápido: antes eran 5 botones sueltos, ahora un solo select ----
  const quickRanges = useMemo(() => {
    const tz = { timeZone: 'America/New_York' }
    const today = new Date().toLocaleDateString('en-CA', tz)
    const now = new Date()
    const dow = (now.getDay() + 6) % 7 // 0=Mon
    const mon = new Date(now); mon.setDate(now.getDate() - dow)
    const monStr = mon.toLocaleDateString('en-CA', tz)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    const sunStr = sun.toLocaleDateString('en-CA', tz)
    const weekNum = (() => {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      return Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7)
    })()
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA', tz)
    const ytdStart = `${now.getFullYear()}-01-01`
    return [
      { key: 'today', label: 'Hoy',                  from: today,    to: today },
      { key: 'wtd',   label: `Semana ${weekNum} (a la fecha)`, from: monStr, to: today,
        title: 'Lunes a hoy — solo lo que ya pasó.' },
      { key: 'wfull', label: `Semana ${weekNum} completa`,     from: monStr, to: sunStr,
        title: 'Lunes a domingo completos, incluye lo programado a futuro.' },
      { key: 'mtd',   label: 'Mes a la fecha',        from: mtdStart, to: today },
      { key: 'ytd',   label: 'Año a la fecha',        from: ytdStart, to: today },
    ]
  }, [])

  const applyQuickRange = (key: string) => {
    setQuickRange(key)
    const r = quickRanges.find(q => q.key === key)
    if (r) { setDateFrom(r.from); setDateTo(r.to) }
  }

  const properties = [...new Set(cleanings.map(c => c.property).filter(Boolean))].sort()
  const clients    = [...new Set(cleanings.map(c => c.clientName).filter(Boolean))].sort() as string[]
  const sources    = [...new Set(cleanings.map(c => c.source).filter(Boolean))].sort() as string[]
  // preFiltered: respects prop/client/source but NOT statusFilter — used for pill counts
  const preFiltered = cleanings.filter(c => {
    if (propFilter   !== 'all' && c.property   !== propFilter)   return false
    if (clientFilter !== 'all' && c.clientName !== clientFilter) return false
    if (sourceFilter  !== 'all') {
      if (sourceFilter === '__blank__' && c.source) return false
      if (sourceFilter !== '__blank__' && c.source !== sourceFilter) return false
    }
    return true
  })

  const filtered = preFiltered.filter(c => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'noPrice')    return !c.hasPrice && c.status === 'Done'
    if (statusFilter === 'inprogress') return c.status !== 'Done' && !c.paymentStatus
    return c.paymentStatus === statusFilter
  })

  // ---- Selección ----
  const selectableIds = filtered.filter(c => c.hasPrice).map(c => c.id) // solo tiene sentido marcar las que ya tienen precio
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id))
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectableIds))
  }
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const applyStatus = async (status: 'Invoiced' | 'Paid') => {
    if (selected.size === 0) return
    setApplying(true)
    try {
      const r = await fetch('/api/getReports?type=updateBillingStatus', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), status }),
      })
      const d = await r.json()
      if (!r.ok || d.error) throw new Error(d.error || 'Error')
      showToast(`✓ ${d.updated} marcadas como ${status === 'Invoiced' ? 'Facturado' : 'Cobrado'}${d.failed ? ` (${d.failed} fallaron)` : ''}`)
      setSelected(new Set())
      await load()
    } catch (e: any) {
      showToast('Error al actualizar: ' + (e.message || 'desconocido'))
    } finally { setApplying(false) }
  }

  const exportCSV = () => {
    const headers = ['Fecha','Propiedad','Cliente','Tipo','#Cleaners','Rating','Status','Precio','HH Casa','HH Total','Source','Estado Cobro']
    const cleanRating = (r: string | null) => {
      if (!r) return ''
      return r.replace(/⭐+\s*/g, '').trim()
    }
    const rows = filtered.map(c => [
      c.date||'', `"${c.property}"`, `"${c.clientName||''}"`,
      `"${c.cleaningType||''}"`, typeof c.staffCount === 'number' ? c.staffCount : '',
      `"${cleanRating(c.rating)}"`,
      c.status||'', c.price??'', c.hoursWorked??'', c.hoursTotal??'',
      `"${c.source||''}"`, c.paymentStatus||''
    ])
    const csv = [headers,...rows].map(r=>r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url
    a.download=`cobranza_${dateFrom}_${dateTo}.csv`; a.click()
    URL.revokeObjectURL(url); showToast('CSV exportado ✓')
  }

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {toast && (
        <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', zIndex:100, background:C.ink, color:'white', padding:'10px 20px', borderRadius:12, fontSize:13, fontWeight:600 }}>
          {toast}
        </div>
      )}

      {/* Controles principales — antes eran ~18, ahora el rango rápido es 1 select y Source vive detrás de "Más filtros" */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value); setQuickRange('custom')}}
          style={{ height:38, padding:'0 12px', borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, color:C.ink, outline:'none' }} />
        <span style={{ color:C.muted, fontSize:13 }}>—</span>
        <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value); setQuickRange('custom')}}
          style={{ height:38, padding:'0 12px', borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, color:C.ink, outline:'none' }} />

        <select value={quickRange} onChange={e=>applyQuickRange(e.target.value)} style={sel(quickRange!=='custom')}>
          <option value="custom">Rango personalizado</option>
          {quickRanges.map(q => <option key={q.key} value={q.key}>{q.label}</option>)}
        </select>

        <select value={propFilter} onChange={e=>setPropFilter(e.target.value)} style={sel(propFilter!=='all')}>
          <option value="all">Todas las propiedades</option>
          {properties.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={clientFilter} onChange={e=>setClientFilter(e.target.value)} style={sel(clientFilter!=='all')}>
          <option value="all">Todos los clientes</option>
          {clients.map(cl=><option key={cl} value={cl}>{cl}</option>)}
        </select>

        <button onClick={()=>setShowAdvanced(v=>!v)}
          title="Filtro de source (poco usado para el check semanal)"
          style={{ ...sel(showAdvanced || sourceFilter!=='all'), display:'flex', alignItems:'center', gap:6 }}>
          <SlidersHorizontal style={{ width:13, height:13 }} /> Más filtros
        </button>

        <button onClick={load} disabled={loading}
          style={{ width:38, height:38, borderRadius:10, border:`1.5px solid ${C.border}`, background:C.white, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <RefreshCw style={{ width:15, height:15, color:C.muted }} className={loading?'animate-spin':''} />
        </button>
        {(propFilter!=='all'||clientFilter!=='all'||sourceFilter!=='all') && (
          <button onClick={()=>{setPropFilter('all');setClientFilter('all');setSourceFilter('all')}}
            style={{ height:38, padding:'0 10px', borderRadius:10, border:`1.5px solid ${C.border}`, background:C.white, color:C.muted, fontSize:13, cursor:'pointer' }}>×</button>
        )}
        <button onClick={exportCSV} style={{ display:'flex', alignItems:'center', gap:6, height:38, padding:'0 16px', borderRadius:10, border:`1.5px solid ${C.green}`, background:C.greenLight, color:C.green, cursor:'pointer', fontSize:12, fontWeight:700, marginLeft:'auto' }}>
          <Download style={{ width:14, height:14 }} /> Exportar CSV
        </button>
      </div>

      {/* Filtro avanzado (Source), oculto por defecto */}
      {showAdvanced && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, padding:'10px 12px', background:C.bg, borderRadius:10, border:`1px dashed ${C.border}` }}>
          <span style={{ fontSize:11, color:C.muted, fontWeight:600 }}>SOURCE:</span>
          <select value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)} style={sel(sourceFilter!=='all')}>
            <option value="all">Todos los sources</option>
            <option value="__blank__">Sin source</option>
            {sources.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:10, marginBottom:16 }}>
          {[
            { label:'Total Generado', amount:preFiltered.reduce((a,x)=>a+(x.price||0),0), count:preFiltered.length, bg:C.primaryLight, color:C.primary, Icon:DollarSign },
            { label:'Sin Cobrar',  amount:preFiltered.filter(x=>x.paymentStatus==='unpaid').reduce((a,x)=>a+(x.price||0),0),   count:preFiltered.filter(x=>x.paymentStatus==='unpaid').length,   bg:C.amberLight, color:C.amber,  Icon:Clock },
            { label:'Facturado',   amount:preFiltered.filter(x=>x.paymentStatus==='invoiced').reduce((a,x)=>a+(x.price||0),0), count:preFiltered.filter(x=>x.paymentStatus==='invoiced').length, bg:C.tealLight,  color:C.teal,   Icon:TrendingUp },
            { label:'Cobrado',     amount:preFiltered.filter(x=>x.paymentStatus==='paid').reduce((a,x)=>a+(x.price||0),0),     count:preFiltered.filter(x=>x.paymentStatus==='paid').length,     bg:C.greenLight, color:C.green,  Icon:CheckCircle2 },
            ...(preFiltered.filter(x=>x.paymentStatus==='overdue').length>0?[{ label:'Vencido', amount:preFiltered.filter(x=>x.paymentStatus==='overdue').reduce((a,x)=>a+(x.price||0),0), count:preFiltered.filter(x=>x.paymentStatus==='overdue').length, bg:C.redLight, color:C.red, Icon:AlertTriangle }]:[]),
            ...(preFiltered.filter(x=>!x.hasPrice&&x.status==='Done').length>0?[{ label:'Sin Precio', amount:null, count:preFiltered.filter(x=>!x.hasPrice&&x.status==='Done').length, bg:'#FEF3C7', color:'#D97706', Icon:AlertCircle }]:[]),
          ].map(s=>(
            <div key={s.label} style={{ background:s.bg, borderRadius:14, padding:'14px 16px', border:`1px solid ${s.color}25` }}>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
                <s.Icon style={{ width:13, height:13, color:s.color }} />
                <span style={{ fontSize:10, fontWeight:700, color:s.color, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</span>
              </div>
              <p style={{ fontSize:20, fontWeight:900, color:s.color, margin:0 }}>{s.amount!==null?fmt$(s.amount):s.count}</p>
              <p style={{ fontSize:10, color:C.muted, marginTop:2 }}>{s.amount!==null?`${s.count} limpiezas`:'requieren precio'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status filter pills */}
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
        {[
          { key:'all',      label:`Todas (${preFiltered.length})`,                                                            bg:C.bg,         color:C.slate },
          { key:'unpaid',   label:`Sin Cobrar (${preFiltered.filter(c=>c.paymentStatus==='unpaid').length})`,                 bg:C.amberLight, color:C.amber },
          { key:'invoiced', label:`Facturado (${preFiltered.filter(c=>c.paymentStatus==='invoiced').length})`,                bg:C.tealLight,  color:C.teal },
          { key:'paid',     label:`Cobrado (${preFiltered.filter(c=>c.paymentStatus==='paid').length})`,                     bg:C.greenLight, color:C.green },
          { key:'inprogress',label:`En Curso (${preFiltered.filter(c=>c.status!=='Done'&&!c.paymentStatus).length})`,        bg:'#DBEAFE',    color:'#2563EB' },
          { key:'noPrice',  label:`Sin Precio (${preFiltered.filter(c=>!c.hasPrice&&c.status==='Done').length})`,            bg:'#FEF3C7',    color:'#D97706' },
        ].map(f=>(
          <button key={f.key} onClick={()=>setStatusFilter(f.key)}
            style={{ padding:'6px 14px', borderRadius:10, border:`1.5px solid ${statusFilter===f.key?f.color:C.border}`, background:statusFilter===f.key?f.bg:C.white, color:statusFilter===f.key?f.color:C.muted, fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Barra de acción masiva — aparece solo si hay algo seleccionado */}
      {selected.size > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, padding:'10px 14px', background:C.primaryLight, borderRadius:12, border:`1.5px solid ${C.primary}` }}>
          <span style={{ fontSize:13, fontWeight:700, color:C.primary }}>{selected.size} seleccionada{selected.size!==1?'s':''}</span>
          <button onClick={()=>applyStatus('Invoiced')} disabled={applying}
            style={{ display:'flex', alignItems:'center', gap:6, height:34, padding:'0 14px', borderRadius:9, border:`1.5px solid ${C.teal}`, background:C.tealLight, color:C.teal, fontSize:12, fontWeight:700, cursor:applying?'default':'pointer', opacity:applying?0.6:1 }}>
            <Send style={{ width:13, height:13 }} /> Marcar Facturado
          </button>
          <button onClick={()=>applyStatus('Paid')} disabled={applying}
            style={{ display:'flex', alignItems:'center', gap:6, height:34, padding:'0 14px', borderRadius:9, border:`1.5px solid ${C.green}`, background:C.greenLight, color:C.green, fontSize:12, fontWeight:700, cursor:applying?'default':'pointer', opacity:applying?0.6:1 }}>
            <Banknote style={{ width:13, height:13 }} /> Marcar Cobrado
          </button>
          <button onClick={()=>setSelected(new Set())}
            style={{ display:'flex', alignItems:'center', gap:4, height:34, padding:'0 10px', borderRadius:9, border:'none', background:'transparent', color:C.muted, fontSize:12, fontWeight:600, cursor:'pointer', marginLeft:'auto' }}>
            <X style={{ width:13, height:13 }} /> Cancelar
          </button>
        </div>
      )}

      {/* Table with sticky header + scroll */}
      <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden' }}>
        {/* Sticky header */}
        <div style={{ display:'grid', gridTemplateColumns:GRID, padding:'10px 16px', background:C.bg, borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, zIndex:10 }}>
          {COLS.map((h,i)=>(
            i===0 ? (
              <input key="checkall" type="checkbox" checked={allSelected} onChange={toggleAll}
                disabled={selectableIds.length===0}
                style={{ width:15, height:15, cursor:selectableIds.length===0?'default':'pointer' }} />
            ) : (
              <span key={h} style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.05em', textAlign: i < 5 ? 'left' : 'center', display:'block' }}>{h}</span>
            )
          ))}
        </div>

        {/* Scrollable body */}
        <div style={{ maxHeight:480, overflowY:'auto' }}>
          {loading ? (
            <div style={{ padding:48, textAlign:'center' }}>
              <RefreshCw style={{ width:24, height:24, color:C.muted, margin:'0 auto 8px' }} className="animate-spin" />
              <p style={{ color:C.muted, fontSize:13 }}>Cargando...</p>
            </div>
          ) : filtered.length===0 ? (
            <div style={{ padding:48, textAlign:'center' }}>
              <DollarSign style={{ width:40, height:40, color:C.muted, margin:'0 auto 12px', opacity:0.3 }} />
              <p style={{ color:C.muted, fontSize:13 }}>No hay limpiezas en este rango</p>
            </div>
          ) : filtered.map((c,i)=>{
            const pc = c.paymentStatus ? (PAY[c.paymentStatus]||null) : null
            const sc = c.status ? (STATUS_COLORS[c.status]||{ bg:C.bg, color:C.muted }) : null
            const canSelect = c.hasPrice
            return (
              <div key={c.id} style={{
                display:'grid', gridTemplateColumns:GRID,
                padding:'10px 16px', borderBottom:i<filtered.length-1?`1px solid ${C.border}`:'none',
                alignItems:'center', background: selected.has(c.id) ? C.primaryLight : (!c.hasPrice&&c.status==='Done'?'#FFFBEB':'white'),
              }}>
                {/* Checkbox */}
                <input type="checkbox" checked={selected.has(c.id)} onChange={()=>toggleOne(c.id)}
                  disabled={!canSelect} title={!canSelect?'Necesita precio antes de poder marcarse':undefined}
                  style={{ width:15, height:15, cursor:canSelect?'pointer':'not-allowed', opacity:canSelect?1:0.3 }} />
                {/* Fecha */}
                <span style={{ fontSize:11, color:C.slate, fontWeight:500 }}>{fmtDate(c.date)}</span>
                {/* Propiedad */}
                <span style={{ fontSize:12, fontWeight:700, color:C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.property}</span>
                {/* Cliente */}
                <span style={{ fontSize:11, color:C.slate, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.clientName||'—'}</span>
                {/* Tipo */}
                <span style={{ fontSize:11, color:C.slate, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.cleaningType||'—'}</span>
                {/* #Cleaners */}
                <span style={{ fontSize:12, fontWeight:700, color:C.slate, textAlign:'center', display:'block' }}>{c.staffCount}</span>
                {/* Rating */}
                {(() => {
                  const rs = c.rating ? RATING_STYLE[c.rating] : null
                  const label = c.rating?.replace(/⭐+\s*/,'') || '—'
                  return (
                    <div style={{ display:'flex', justifyContent:'center' }}>
                      {rs ? <span style={{ fontSize:10, fontWeight:700, background:rs.bg, color:rs.color, padding:'3px 8px', borderRadius:6 }}>{label}</span>
                      : <span style={{ fontSize:11, color:C.muted }}>—</span>}
                    </div>
                  )
                })()}
                {/* Status */}
                <div style={{ display:'flex', justifyContent:'center' }}>
                  {sc ? <span style={{ fontSize:10, fontWeight:700, background:sc.bg, color:sc.color, padding:'3px 8px', borderRadius:6 }}>{c.status}</span>
                  : <span style={{ fontSize:11, color:C.muted }}>—</span>}
                </div>
                {/* Precio */}
                <span style={{ fontSize:13, fontWeight:700, color:c.hasPrice?C.ink:C.amber, textAlign:'center', display:'block' }}>
                  {c.hasPrice?fmt$(c.price):'⚠️ —'}
                </span>
                {/* HH */}
                <span style={{ fontSize:12, color:C.slate, textAlign:'center', display:'block' }}>{c.hoursWorked?`${c.hoursWorked}h`:'—'}</span>
                {/* HH Total */}
                <span style={{ fontSize:12, color:C.slate, textAlign:'center', display:'block' }}>
                  {c.hoursTotal?`${c.hoursTotal}h`:'—'}
                  {c.staffCount>1&&<span style={{ fontSize:10, color:C.muted }}> ×{c.staffCount}</span>}
                </span>
                {/* Cobro */}
                {pc ? (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, background:pc.bg, padding:'4px 8px', borderRadius:8 }}>
                    <pc.Icon style={{ width:11, height:11, color:pc.color }} />
                    <span style={{ fontSize:11, fontWeight:700, color:pc.color }}>{pc.label}</span>
                  </div>
                ) : (
                  <span style={{ fontSize:11, color:C.muted, textAlign:'center', display:'block' }}>—</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
