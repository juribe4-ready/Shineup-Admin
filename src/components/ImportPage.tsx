import { useState, useRef, useCallback } from 'react'
import { Upload, CheckCircle2, AlertTriangle, XCircle, RefreshCw, DollarSign } from 'lucide-react'

const C = {
  primary: '#6366F1', primaryLight: '#EEF2FF',
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', greenLight: '#ECFDF5',
  red: '#EF4444', redLight: '#FEF2F2',
  amber: '#F59E0B', amberLight: '#FFFBEB',
}

interface TurnoRow {
  date: string; customer: string; amount: number
  property: string; projectNumber: string; status: string
}

interface MatchResult {
  turnoRow: TurnoRow
  cleaningId: string | null
  cleaningProperty: string
  matchType: 'turnoName' | 'exact' | 'none'
  alreadyPaid: boolean
}

function parseCSV(text: string): TurnoRow[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  const col = (...names: string[]) => {
    for (const n of names) { const i = headers.findIndex(h => h.includes(n)); if (i >= 0) return i }
    return -1
  }
  const dateCol = col('project date','date')
  const custCol = col('customer')
  const amtCol  = col('amount')
  const propCol = col('property')
  const projCol = col('project #','project number','notes')
  const statCol = col('status')

  const rows: TurnoRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    if (cols.length < 3) continue
    const status = statCol >= 0 ? cols[statCol] : 'succeeded'
    if (status && status !== 'succeeded' && status !== 'paid') continue
    rows.push({
      date:          dateCol >= 0 ? cols[dateCol] : '',
      customer:      custCol >= 0 ? cols[custCol] : '',
      amount:        amtCol  >= 0 ? parseFloat(cols[amtCol].replace(/[$,]/g,'')) || 0 : 0,
      property:      propCol >= 0 ? cols[propCol] : '',
      projectNumber: projCol >= 0 ? cols[projCol] : '',
      status,
    })
  }
  return rows
}

function normalizeDate(raw: string): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toLocaleDateString('en-CA')
  return ''
}

export default function ImportPage() {
  const [rows,       setRows]       = useState<TurnoRow[]>([])
  const [matches,    setMatches]    = useState<MatchResult[]>([])
  const [loading,    setLoading]    = useState(false)
  const [processing, setProcessing] = useState(false)
  const [results,    setResults]    = useState<{paid:number;skipped:number;errors:number}|null>(null)
  const [fileName,   setFileName]   = useState('')
  const [toast,      setToast]      = useState<string|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000) }

  const matchWithAPI = useCallback(async (turnoRows: TurnoRow[]) => {
    setLoading(true)
    try {
      const dates = turnoRows.map(r => normalizeDate(r.date)).filter(Boolean).sort()
      if (!dates.length) { showToast('No se pudieron parsear las fechas'); return }
      const dateFrom = dates[0]
      const dateTo   = dates[dates.length - 1]

      const res = await fetch(`/api/getReports?type=importMatch&dateFrom=${dateFrom}&dateTo=${dateTo}`)
      if (!res.ok) throw new Error('Error al cargar datos')
      const { cleanings, propsMap } = await res.json()

      const normalize = (s: string) => s.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9\s]/g, '') // remove special chars
      .replace(/\s+/g, ' ').trim()

    const matched: MatchResult[] = turnoRows.map(row => {
        const rowDate = normalizeDate(row.date)
        const rowProp = normalize(row.property)
        const candidates = cleanings.filter((c: any) => c.fields?.Date === rowDate)

        let bestMatch: any = null
        let matchType: 'turnoName'|'exact'|'none' = 'none'

        for (const c of candidates) {
          const propIds: string[] = Array.isArray(c.fields?.Property) ? c.fields.Property : []
          for (const pid of propIds) {
            const prop = propsMap[pid]
            if (!prop) continue
            if (prop.turnoName && normalize(prop.turnoName) === rowProp) {
              bestMatch = c; matchType = 'turnoName'; break
            }
            if (normalize(prop.name) === rowProp && matchType === 'none') {
              bestMatch = c; matchType = 'exact'
            }
          }
          if (matchType === 'turnoName') break
        }

        return {
          turnoRow:         row,
          cleaningId:       bestMatch?.id || null,
          cleaningProperty: bestMatch?.fields?.['Property Text'] || '',
          matchType,
          alreadyPaid:      (bestMatch?.fields?.['Payment Status']||'').toLowerCase() === 'paid',
        }
      })

      setMatches(matched)
    } catch(e: any) { showToast('Error: ' + e.message) }
    finally { setLoading(false) }
  }, [])

  const handleFile = async (file: File) => {
    setFileName(file.name); setResults(null); setMatches([])
    const text = await file.text()
    const parsed = parseCSV(text)
    if (!parsed.length) { showToast('No se encontraron filas válidas'); return }
    setRows(parsed)
    await matchWithAPI(parsed)
  }

  const applyPayments = async () => {
    const toUpdate = matches.filter(m => m.cleaningId && !m.alreadyPaid)
    if (!toUpdate.length) { showToast('Nada nuevo para marcar'); return }
    setProcessing(true)
    const updates = toUpdate.map(m => ({
      cleaningId:    m.cleaningId,
      amount:        m.turnoRow.amount,
      projectNumber: m.turnoRow.projectNumber,
    }))
    try {
      const res = await fetch('/api/getReports?type=importApply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })
      const data = await res.json()
      const paid   = data.results?.filter((r: any) => r.ok).length || 0
      const errors = data.results?.filter((r: any) => !r.ok).length || 0
      setResults({ paid, skipped: matches.length - toUpdate.length, errors })
      showToast(`✓ ${paid} marcadas como Paid`)
      await matchWithAPI(rows)
    } catch(e: any) { showToast('Error: ' + e.message) }
    finally { setProcessing(false) }
  }

  const toProcess   = matches.filter(m => m.cleaningId && !m.alreadyPaid)
  const alreadyPaid = matches.filter(m => m.alreadyPaid)
  const unmatched   = matches.filter(m => !m.cleaningId)
  const totalAmount = toProcess.reduce((a, m) => a + m.turnoRow.amount, 0)

  return (
    <div style={{ fontFamily:"'Inter', -apple-system, sans-serif", maxWidth:1100 }}>
      {toast && (
        <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', zIndex:100, background:C.ink, color:'white', padding:'10px 20px', borderRadius:12, fontSize:13, fontWeight:600 }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:18, fontWeight:800, color:C.ink, margin:0 }}>Importar Pagos de Turno</h2>
        <p style={{ fontSize:13, color:C.muted, marginTop:4 }}>Cruza el CSV de Turno con tus limpiezas y márcalas como <strong>Paid</strong> automáticamente</p>
      </div>

      {/* Upload zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if(f) handleFile(f) }}
        style={{ border:`2px dashed ${C.border}`, borderRadius:16, padding:'40px 24px', textAlign:'center', cursor:'pointer', marginBottom:24, background:C.white, transition:'border-color 0.2s' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = C.primary)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
      >
        <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }}
          onChange={e => { const f = e.target.files?.[0]; if(f) handleFile(f) }} />
        <Upload style={{ width:32, height:32, color:C.muted, margin:'0 auto 12px' }} />
        {fileName
          ? <p style={{ fontSize:14, fontWeight:700, color:C.ink }}>{fileName}</p>
          : <p style={{ fontSize:14, color:C.muted }}>Arrastra el CSV de Turno aquí o <span style={{ color:C.primary, fontWeight:600 }}>haz click para seleccionar</span></p>
        }
        <p style={{ fontSize:11, color:C.muted, marginTop:6 }}>Exporta desde Turno → Reports → Transactions CSV</p>
      </div>

      {loading && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'16px 20px', background:C.primaryLight, borderRadius:12, marginBottom:20 }}>
          <RefreshCw style={{ width:16, height:16, color:C.primary, animation:'spin 1s linear infinite' }} />
          <span style={{ fontSize:13, color:C.primary, fontWeight:600 }}>Cruzando con Airtable...</span>
        </div>
      )}

      {matches.length > 0 && !loading && (
        <>
          {/* Summary */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:12, marginBottom:20 }}>
            {[
              { label:'Para pagar', count:toProcess.length,   sub:`$${totalAmount.toFixed(2)}`, bg:C.greenLight, color:C.green,    Icon:CheckCircle2 },
              { label:'Ya pagadas', count:alreadyPaid.length, sub:'ya procesadas',              bg:'#DBEAFE',    color:'#2563EB',   Icon:DollarSign },
              { label:'Sin match',  count:unmatched.length,   sub:'revisar Turno Name',         bg:C.redLight,   color:C.red,       Icon:XCircle },
            ].map(s => (
              <div key={s.label} style={{ background:s.bg, borderRadius:14, padding:'14px 16px', border:`1px solid ${s.color}25` }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                  <s.Icon style={{ width:13, height:13, color:s.color }} />
                  <span style={{ fontSize:10, fontWeight:700, color:s.color, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</span>
                </div>
                <p style={{ fontSize:22, fontWeight:900, color:s.color, margin:0 }}>{s.count}</p>
                <p style={{ fontSize:11, color:C.muted, marginTop:2 }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {toProcess.length > 0 && !results && (
            <button onClick={applyPayments} disabled={processing}
              style={{ display:'flex', alignItems:'center', gap:8, height:44, padding:'0 24px', borderRadius:12, border:'none', background:`linear-gradient(135deg, ${C.green} 0%, #059669 100%)`, color:'white', fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:20, boxShadow:'0 4px 12px #10B98140' }}>
              {processing
                ? <><RefreshCw style={{ width:16, height:16, animation:'spin 1s linear infinite' }} /> Procesando...</>
                : <><CheckCircle2 style={{ width:16, height:16 }} /> Marcar {toProcess.length} como Paid (${totalAmount.toFixed(2)})</>
              }
            </button>
          )}

          {results && (
            <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
              <div style={{ background:C.greenLight, border:`1px solid ${C.green}30`, borderRadius:10, padding:'10px 16px', fontSize:13, fontWeight:700, color:C.green }}>✓ {results.paid} pagadas</div>
              {results.skipped > 0 && <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 16px', fontSize:13, color:C.muted }}>{results.skipped} omitidas</div>}
              {results.errors  > 0 && <div style={{ background:C.redLight, border:`1px solid ${C.red}30`, borderRadius:10, padding:'10px 16px', fontSize:13, fontWeight:700, color:C.red }}>{results.errors} errores</div>}
            </div>
          )}

          {/* Table */}
          <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 1fr 100px 90px 100px', padding:'10px 16px', background:C.bg, borderBottom:`1px solid ${C.border}` }}>
              {['Fecha','Propiedad Turno','Limpieza en ShineUp','Monto','Match','Estado'].map(h => (
                <span key={h} style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</span>
              ))}
            </div>
            <div style={{ maxHeight:440, overflowY:'auto' }}>
              {matches.map((m, i) => {
                const mc = m.matchType==='none' ? C.red : m.matchType==='turnoName' ? C.green : C.primary
                const ml = m.matchType==='none' ? 'Sin match' : m.matchType==='turnoName' ? 'Turno Name' : 'Exacto'
                const sc = m.alreadyPaid ? '#2563EB' : m.cleaningId ? C.green : C.red
                const sl = m.alreadyPaid ? 'Ya pagada' : m.cleaningId ? 'Pagar' : '—'
                return (
                  <div key={i} style={{
                    display:'grid', gridTemplateColumns:'90px 1fr 1fr 100px 90px 100px',
                    padding:'10px 16px', borderBottom:i<matches.length-1?`1px solid ${C.border}`:'none',
                    alignItems:'center',
                    background: m.matchType==='none' ? '#FFF5F5' : m.alreadyPaid ? '#F0F9FF' : 'white'
                  }}>
                    <span style={{ fontSize:11, color:C.slate }}>{m.turnoRow.date}</span>
                    <span style={{ fontSize:12, color:C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.turnoRow.property}</span>
                    <span style={{ fontSize:12, color:m.cleaningId?C.ink:C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.cleaningProperty||'—'}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:C.ink }}>${m.turnoRow.amount.toFixed(2)}</span>
                    <span style={{ fontSize:10, fontWeight:700, color:mc, background:`${mc}15`, padding:'3px 8px', borderRadius:6, textAlign:'center' }}>{ml}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:sc }}>{sl}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {unmatched.length > 0 && (
            <div style={{ marginTop:16, padding:'12px 16px', background:C.amberLight, borderRadius:12, border:`1px solid ${C.amber}30` }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <AlertTriangle style={{ width:14, height:14, color:C.amber }} />
                <span style={{ fontSize:12, fontWeight:700, color:C.amber }}>
                  Agrega el nombre exacto de Turno en la columna "Turno Name" de la tabla Properties en Airtable:
                </span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {unmatched.map((m,i) => (
                  <span key={i} style={{ fontSize:11, background:'white', border:`1px solid ${C.border}`, borderRadius:8, padding:'4px 10px', color:C.slate }}>
                    <strong>{m.turnoRow.property}</strong> · {m.turnoRow.date}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
