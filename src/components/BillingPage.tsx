import { useState, useEffect, useCallback } from 'react'
import { DollarSign, Download, RefreshCw, AlertCircle, TrendingUp, Clock, CheckCircle2, AlertTriangle, XCircle, Filter } from 'lucide-react'

const C = {
  primary: '#6366F1', primaryLight: '#EEF2FF',
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', greenLight: '#ECFDF5',
  red: '#EF4444', redLight: '#FEF2F2',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  teal: '#14B8A6', tealLight: '#F0FDFA',
  purple: '#8B5CF6', purpleLight: '#F5F3FF',
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const thirtyDaysAgo = () => {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

interface Cleaning {
  id: string; date: string | null; property: string
  cleaningType: string | null; paymentStatus: string | null
  price: number | null; hoursWorked: number | null
  laborCost: number | null; margin: number | null
  rating: string | null; hasPrice: boolean
}

interface Summary {
  total: number; noPrice: number
  unpaidCount: number; invoicedCount: number; paidCount: number; overdueCount: number
  unpaidAmount: number; invoicedAmount: number; paidAmount: number; overdueAmount: number
  totalRevenue: number
}

const PAYMENT_CONFIG: Record<string, { label: string; bg: string; color: string; Icon: any }> = {
  unpaid:   { label: 'Sin Cobrar',  bg: C.amberLight, color: C.amber,   Icon: Clock },
  invoiced: { label: 'Facturado',   bg: C.tealLight,  color: C.teal,    Icon: TrendingUp },
  paid:     { label: 'Cobrado',     bg: C.greenLight,  color: C.green,  Icon: CheckCircle2 },
  overdue:  { label: 'Vencido',     bg: C.redLight,    color: C.red,    Icon: AlertTriangle },
  null:     { label: 'Sin estado',  bg: C.bg,          color: C.muted,  Icon: XCircle },
}

function fmt$(n: number | null) {
  if (n === null) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function BillingPage() {
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo())
  const [dateTo,   setDateTo]   = useState(today())
  const [cleanings, setCleanings] = useState<Cleaning[]>([])
  const [summary,   setSummary]   = useState<Summary | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/getReports?type=billing&dateFrom=${dateFrom}&dateTo=${dateTo}`)
      if (!r.ok) throw new Error('Error al cargar')
      const d = await r.json()
      setCleanings(d.cleanings || [])
      setSummary(d.summary || null)
    } catch {
      showToast('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const filtered = cleanings.filter(c =>
    statusFilter === 'all' ? true :
    statusFilter === 'noPrice' ? !c.hasPrice :
    c.paymentStatus === statusFilter
  )

  // Export to CSV
  const exportCSV = () => {
    const headers = ['Fecha', 'Propiedad', 'Tipo', 'Precio', 'HH Trabajadas', 'Costo Labor', 'Margen', 'Estado Pago', 'Rating']
    const rows = filtered.map(c => [
      c.date || '',
      `"${c.property}"`,
      c.cleaningType || '',
      c.price ?? '',
      c.hoursWorked ?? '',
      c.laborCost ?? '',
      c.margin ?? '',
      c.paymentStatus || '',
      c.rating || ''
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `cobranza_${dateFrom}_${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('CSV exportado ✓')
  }

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, background: C.ink, color: 'white',
          padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600
        }}>{toast}</div>
      )}

      {/* Header + Date Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ height: 38, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none' }} />
          <span style={{ color: C.muted, fontSize: 13 }}>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ height: 38, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none' }} />
        </div>
        <button onClick={load} disabled={loading}
          style={{ width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw style={{ width: 15, height: 15, color: C.muted, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
        <button onClick={exportCSV}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px', borderRadius: 10, border: `1.5px solid ${C.green}`, background: C.greenLight, color: C.green, cursor: 'pointer', fontSize: 12, fontWeight: 700, marginLeft: 'auto' }}>
          <Download style={{ width: 14, height: 14 }} />
          Exportar CSV
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
          {/* Total Revenue */}
          <div style={{ background: C.primaryLight, borderRadius: 16, padding: '16px 18px', border: `1px solid ${C.primary}30` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <DollarSign style={{ width: 14, height: 14, color: C.primary }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Generado</span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 900, color: C.primary, margin: 0 }}>{fmt$(summary.totalRevenue)}</p>
            <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{summary.total} limpiezas</p>
          </div>

          {/* Sin Cobrar */}
          <div style={{ background: C.amberLight, borderRadius: 16, padding: '16px 18px', border: `1px solid ${C.amber}30` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Clock style={{ width: 14, height: 14, color: C.amber }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sin Cobrar</span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 900, color: C.amber, margin: 0 }}>{fmt$(summary.unpaidAmount)}</p>
            <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{summary.unpaidCount} limpiezas</p>
          </div>

          {/* Facturado */}
          <div style={{ background: C.tealLight, borderRadius: 16, padding: '16px 18px', border: `1px solid ${C.teal}30` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <TrendingUp style={{ width: 14, height: 14, color: C.teal }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Facturado</span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 900, color: C.teal, margin: 0 }}>{fmt$(summary.invoicedAmount)}</p>
            <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{summary.invoicedCount} limpiezas</p>
          </div>

          {/* Cobrado */}
          <div style={{ background: C.greenLight, borderRadius: 16, padding: '16px 18px', border: `1px solid ${C.green}30` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <CheckCircle2 style={{ width: 14, height: 14, color: C.green }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cobrado</span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 900, color: C.green, margin: 0 }}>{fmt$(summary.paidAmount)}</p>
            <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{summary.paidCount} limpiezas</p>
          </div>

          {/* Vencido */}
          {summary.overdueCount > 0 && (
            <div style={{ background: C.redLight, borderRadius: 16, padding: '16px 18px', border: `1px solid ${C.red}30` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <AlertTriangle style={{ width: 14, height: 14, color: C.red }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: C.red, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vencido</span>
              </div>
              <p style={{ fontSize: 22, fontWeight: 900, color: C.red, margin: 0 }}>{fmt$(summary.overdueAmount)}</p>
              <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{summary.overdueCount} limpiezas</p>
            </div>
          )}

          {/* Sin Precio */}
          {summary.noPrice > 0 && (
            <div style={{ background: '#FEF3C7', borderRadius: 16, padding: '16px 18px', border: '1px solid #FDE68A' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <AlertCircle style={{ width: 14, height: 14, color: '#D97706' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sin Precio</span>
              </div>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#D97706', margin: 0 }}>{summary.noPrice}</p>
              <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>requieren precio manual</p>
            </div>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'all',      label: `Todas (${cleanings.length})`,    bg: C.bg,         color: C.slate },
          { key: 'unpaid',   label: `Sin Cobrar (${summary?.unpaidCount || 0})`,   bg: C.amberLight, color: C.amber },
          { key: 'invoiced', label: `Facturado (${summary?.invoicedCount || 0})`,  bg: C.tealLight,  color: C.teal },
          { key: 'paid',     label: `Cobrado (${summary?.paidCount || 0})`,        bg: C.greenLight,  color: C.green },
          { key: 'noPrice',  label: `Sin Precio (${summary?.noPrice || 0})`,       bg: '#FEF3C7',    color: '#D97706' },
        ].map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            style={{
              padding: '6px 14px', borderRadius: 10, border: `1.5px solid ${statusFilter === f.key ? f.color : C.border}`,
              background: statusFilter === f.key ? f.bg : C.white,
              color: statusFilter === f.key ? f.color : C.muted,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.15s'
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '90px 1fr 130px 90px 90px 90px 110px',
          padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: C.bg,
        }}>
          {['Fecha', 'Propiedad', 'Tipo', 'Precio', 'HH', 'Margen', 'Estado'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <RefreshCw style={{ width: 24, height: 24, color: C.muted, margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: C.muted, fontSize: 13 }}>Cargando...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <DollarSign style={{ width: 40, height: 40, color: C.muted, margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ color: C.muted, fontSize: 13 }}>No hay limpiezas en este rango</p>
          </div>
        ) : (
          filtered.map((c, i) => {
            const pc = PAYMENT_CONFIG[c.paymentStatus as string] || PAYMENT_CONFIG['null']
            return (
              <div key={c.id}
                style={{
                  display: 'grid', gridTemplateColumns: '90px 1fr 130px 90px 90px 90px 110px',
                  padding: '12px 16px', borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
                  alignItems: 'center',
                  background: !c.hasPrice ? '#FFFBEB' : 'white',
                }}>
                <span style={{ fontSize: 12, color: C.slate, fontWeight: 500 }}>{fmtDate(c.date)}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.property}</p>
                  {c.cleaningType && <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>{c.cleaningType}</p>}
                </div>
                <span style={{ fontSize: 11, color: C.muted }}>{c.cleaningType || '—'}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.hasPrice ? C.ink : C.amber }}>
                  {c.hasPrice ? fmt$(c.price) : '⚠️ —'}
                </span>
                <span style={{ fontSize: 12, color: C.slate }}>{c.hoursWorked ? `${c.hoursWorked}h` : '—'}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: c.margin !== null ? (c.margin > 0 ? C.green : C.red) : C.muted }}>
                  {c.margin !== null ? fmt$(c.margin) : '—'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: pc.bg, padding: '4px 10px', borderRadius: 8, width: 'fit-content' }}>
                  <pc.Icon style={{ width: 11, height: 11, color: pc.color }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: pc.color }}>{pc.label}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
