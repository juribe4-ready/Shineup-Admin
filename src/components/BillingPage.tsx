import { useState, useEffect, useCallback } from 'react'
import { DollarSign, Download, RefreshCw, AlertCircle, TrendingUp, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

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
  staffCount: number; rating: string | null; hasPrice: boolean
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

  height: 38, padding: '0 12px', borderRadius: 10,
  border: `1.5px solid ${active ? C.primary : C.border}`,
  background: active ? C.primaryLight : C.white,
  color: active ? C.primary : C.slate,
  fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer',
} as React.CSSProperties)

// Grid: date | property | client | type | #cleaners | rating | status | price | HH | HH Total | pay status
const GRID = '75px 140px 110px 110px 80px 80px 90px 90px 55px 75px 105px'
const COLS = ['Fecha','Propiedad','Cliente','Tipo','#Cleaners','Rating','Status','Precio','HH','HH Total','Cobro']

export default function BillingPage() {
  const [dateFrom, setDateFrom] = useState(thirtyAgo())
  const [dateTo,   setDateTo]   = useState(todayStr())
  const [cleanings, setCleanings] = useState<Cleaning[]>([])
  const [summary,   setSummary]   = useState<Summary | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [propFilter,   setPropFilter]   = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
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

  const properties = [...new Set(cleanings.map(c => c.property).filter(Boolean))].sort()
  const clients    = [...new Set(cleanings.map(c => c.clientName).filter(Boolean))].sort() as string[]

  const filtered = cleanings.filter(c => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'noPrice' && c.hasPrice) return false
      if (statusFilter !== 'noPrice' && c.paymentStatus !== statusFilter) return false
    }
    if (propFilter   !== 'all' && c.property   !== propFilter)   return false
    if (clientFilter !== 'all' && c.clientName !== clientFilter) return false
    return true
  })

  const exportCSV = () => {
    const headers = ['Fecha','Propiedad','Cliente','Tipo','#Cleaners','Rating','Status','Precio','HH Casa','HH Total','Estado Cobro']
    const rows = filtered.map(c => [
      c.date||'', `"${c.property}"`, `"${c.clientName||''}"`,
      c.cleaningType||'', c.staffCount, `"${c.rating||''}"`,
      c.status||'', c.price??'', c.hoursWorked??'', c.hoursTotal??'', c.paymentStatus||''
    ])
    const csv = [headers,...rows].map(r=>r.join(',')).join('\n')
    const blob = new Blob([csv],{type:'text/csv'})
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

      {/* Controls */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
          style={{ height:38, padding:'0 12px', borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, color:C.ink, outline:'none' }} />
        <span style={{ color:C.muted, fontSize:13 }}>—</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
          style={{ height:38, padding:'0 12px', borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, color:C.ink, outline:'none' }} />
        <button onClick={load} disabled={loading}
          style={{ width:38, height:38, borderRadius:10, border:`1.5px solid ${C.border}`, background:C.white, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <RefreshCw style={{ width:15, height:15, color:C.muted }} className={loading?'animate-spin':''} />
        </button>
        <select value={propFilter} onChange={e=>setPropFilter(e.target.value)} style={sel(propFilter!=='all')}>
          <option value="all">Todas las propiedades</option>
          {properties.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={clientFilter} onChange={e=>setClientFilter(e.target.value)} style={sel(clientFilter!=='all')}>
          <option value="all">Todos los clientes</option>
          {clients.map(cl=><option key={cl} value={cl}>{cl}</option>)}
        </select>
        {(propFilter!=='all'||clientFilter!=='all') && (
          <button onClick={()=>{setPropFilter('all');setClientFilter('all')}}
            style={{ height:38, padding:'0 10px', borderRadius:10, border:`1.5px solid ${C.border}`, background:C.white, color:C.muted, fontSize:13, cursor:'pointer' }}>×</button>
        )}
        <button onClick={exportCSV} style={{ display:'flex', alignItems:'center', gap:6, height:38, padding:'0 16px', borderRadius:10, border:`1.5px solid ${C.green}`, background:C.greenLight, color:C.green, cursor:'pointer', fontSize:12, fontWeight:700, marginLeft:'auto' }}>
          <Download style={{ width:14, height:14 }} /> Exportar CSV
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:10, marginBottom:16 }}>
          {[
            { label:'Total Generado', amount:summary.totalRevenue,   count:summary.total,         bg:C.primaryLight, color:C.primary, Icon:DollarSign },
            { label:'Sin Cobrar',     amount:summary.unpaidAmount,   count:summary.unpaidCount,   bg:C.amberLight,   color:C.amber,   Icon:Clock },
            { label:'Facturado',      amount:summary.invoicedAmount, count:summary.invoicedCount, bg:C.tealLight,    color:C.teal,    Icon:TrendingUp },
            { label:'Cobrado',        amount:summary.paidAmount,     count:summary.paidCount,     bg:C.greenLight,   color:C.green,   Icon:CheckCircle2 },
            ...(summary.overdueCount>0?[{ label:'Vencido', amount:summary.overdueAmount, count:summary.overdueCount, bg:C.redLight, color:C.red, Icon:AlertTriangle }]:[]),
            ...(summary.noPrice>0?[{ label:'Sin Precio', amount:null, count:summary.noPrice, bg:'#FEF3C7', color:'#D97706', Icon:AlertCircle }]:[]),
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
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {[
          { key:'all',      label:`Todas (${cleanings.length})`,              bg:C.bg,         color:C.slate },
          { key:'unpaid',   label:`Sin Cobrar (${summary?.unpaidCount||0})`,  bg:C.amberLight, color:C.amber },
          { key:'invoiced', label:`Facturado (${summary?.invoicedCount||0})`, bg:C.tealLight,  color:C.teal },
          { key:'paid',     label:`Cobrado (${summary?.paidCount||0})`,       bg:C.greenLight, color:C.green },
          { key:'noPrice',  label:`Sin Precio (${summary?.noPrice||0})`,      bg:'#FEF3C7',    color:'#D97706' },
        ].map(f=>(
          <button key={f.key} onClick={()=>setStatusFilter(f.key)}
            style={{ padding:'6px 14px', borderRadius:10, border:`1.5px solid ${statusFilter===f.key?f.color:C.border}`, background:statusFilter===f.key?f.bg:C.white, color:statusFilter===f.key?f.color:C.muted, fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table with sticky header + scroll */}
      <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden' }}>
        {/* Sticky header */}
        <div style={{ display:'grid', gridTemplateColumns:GRID, padding:'10px 16px', background:C.bg, borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, zIndex:10 }}>
          {COLS.map((h,i)=>(
            <span key={h} style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.05em', textAlign: i >= 4 ? 'center' : 'left' }}>{h}</span>
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
            return (
              <div key={c.id} style={{
                display:'grid', gridTemplateColumns:GRID,
                padding:'10px 16px', borderBottom:i<filtered.length-1?`1px solid ${C.border}`:'none',
                alignItems:'center', background:!c.hasPrice&&c.status==='Done'?'#FFFBEB':'white',
              }}>
                {/* Fecha */}
                <span style={{ fontSize:11, color:C.slate, fontWeight:500 }}>{fmtDate(c.date)}</span>
                {/* Propiedad */}
                <span style={{ fontSize:12, fontWeight:700, color:C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.property}</span>
                {/* Cliente */}
                <span style={{ fontSize:11, color:C.slate, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.clientName||'—'}</span>
                {/* Tipo */}
                <span style={{ fontSize:11, color:C.slate, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.cleaningType||'—'}</span>
                {/* #Cleaners */}
                <span style={{ fontSize:12, fontWeight:700, color:C.slate, textAlign:'center' }}>{c.staffCount}</span>
                {/* Rating */}
                {(() => {
                  const rs = c.rating ? RATING_STYLE[c.rating] : null
                  const label = c.rating?.replace(/⭐+\s*/,'') || '—'
                  return rs ? (
                    <span style={{ fontSize:10, fontWeight:700, background:rs.bg, color:rs.color, padding:'3px 8px', borderRadius:6, textAlign:'center', margin:'0 auto' }}>{label}</span>
                  ) : <span style={{ fontSize:11, color:C.muted, textAlign:'center', display:'block' }}>—</span>
                })()}
                {/* Status */}
                {sc ? (
                  <span style={{ fontSize:10, fontWeight:700, background:sc.bg, color:sc.color, padding:'3px 8px', borderRadius:6, width:'fit-content', margin:'0 auto' }}>{c.status}</span>
                ) : <span style={{ color:C.muted, fontSize:11, textAlign:'center', display:'block' }}>—</span>}
                {/* Precio */}
                <span style={{ fontSize:13, fontWeight:700, color:c.hasPrice?C.ink:C.amber, textAlign:'center' }}>
                  {c.hasPrice?fmt$(c.price):'⚠️ —'}
                </span>
                {/* HH */}
                <span style={{ fontSize:12, color:C.slate, textAlign:'center' }}>{c.hoursWorked?`${c.hoursWorked}h`:'—'}</span>
                {/* HH Total */}
                <span style={{ fontSize:12, color:C.slate, textAlign:'center' }}>
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
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, background:C.bg, padding:'4px 8px', borderRadius:8 }}>
                    <XCircle style={{ width:11, height:11, color:C.muted }} />
                    <span style={{ fontSize:11, fontWeight:600, color:C.muted }}>—</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
