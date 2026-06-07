import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, CheckCircle2, AlertTriangle, XCircle, RefreshCw, DollarSign, CalendarDays, Plus } from 'lucide-react'

const C = {
  primary: '#6366F1', primaryLight: '#EEF2FF',
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', greenLight: '#ECFDF5',
  red: '#EF4444', redLight: '#FEF2F2',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  teal: '#14B8A6', tealLight: '#F0FDFA',
}

const todayDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface TurnoRow { date: string; customer: string; amount: number; property: string; projectNumber: string; status: string }
interface PayMatch { turnoRow: TurnoRow; cleaningId: string | null; cleaningProperty: string; matchType: 'turnoName'|'exact'|'none'; alreadyPaid: boolean }
interface PropMatch { name: string; propertyId: string | null; propertyName: string; matchType: 'turnoName'|'exact'|'none' }

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const normalize = (s: string) => s.toLowerCase().trim()
  .replace(/[^\x00-\x7F]/g, ' ')
  .replace(/[^a-z0-9\s]/g, '')
  .replace(/\s+/g, ' ').trim()

function parseCSV(text: string): TurnoRow[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].includes('\t') ? '\t' : ','
  const splitLine = (line: string): string[] => {
    if (sep === '\t') return line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''))
    const cols: string[] = []; let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
      else cur += ch
    }
    cols.push(cur.trim()); return cols
  }
  const headers = splitLine(lines[0]).map(h => h.toLowerCase())
  const col = (...names: string[]) => { for (const n of names) { const i = headers.findIndex(h => h.includes(n)); if (i >= 0) return i }; return -1 }
  const dateCol = col('project date','date'), custCol = col('customer'), amtCol = col('amount')
  const propCol = col('property'), projCol = col('notes','project #','project number'), statCol = col('status')
  const rows: TurnoRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]); if (cols.length < 3) continue
    const status = statCol >= 0 ? cols[statCol] : 'succeeded'
    if (status && status !== 'succeeded' && status !== 'paid') continue
    rows.push({
      date: dateCol >= 0 ? cols[dateCol] : '', customer: custCol >= 0 ? cols[custCol] : '',
      amount: amtCol >= 0 ? parseFloat(cols[amtCol].replace(/[$,]/g,'')) || 0 : 0,
      property: propCol >= 0 ? cols[propCol] : '',
      projectNumber: (() => { const raw = projCol >= 0 ? cols[projCol] : ''; const m = raw.match(/#(\d+)/); return m ? m[1] : raw })(),
      status,
    })
  }
  return rows
}

function normalizeDate(raw: string): string {
  if (!raw) return ''
  const clean = raw.trim().replace(',', '')
  const months: Record<string,string> = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' }
  const m = clean.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/)
  if (m) { const mon = months[m[1].toLowerCase().slice(0,3)]; if (mon) return `${m[3]}-${mon}-${m[2].padStart(2,'0')}` }
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean
  const d = new Date(clean); if (!isNaN(d.getTime())) return d.toLocaleDateString('en-CA')
  return ''
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function ImportPage() {
  const [tab, setTab] = useState<'pay'|'appt'>('pay')
  const [toast, setToast] = useState<string|null>(null)
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000) }

  return (
    <div style={{ fontFamily:"'Inter', -apple-system, sans-serif", maxWidth: 1100 }}>
      {toast && (
        <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', zIndex:100, background:C.ink, color:'white', padding:'10px 20px', borderRadius:12, fontSize:13, fontWeight:600 }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize:18, fontWeight:800, color:C.ink, margin:0 }}>Importar</h2>
        <p style={{ fontSize:13, color:C.muted, marginTop:4 }}>Pagos y appointments desde plataformas externas</p>
      </div>

      {/* Tab bar — Analysis style */}
      <div style={{ display:'flex', gap:4, marginBottom:24, background:C.white, padding:5, borderRadius:16, border:`1px solid ${C.border}`, width:'fit-content', flexWrap:'wrap' }}>
        {([
          { key:'pay',  label:'Pagos',        Icon: DollarSign,  color: C.green   },
          { key:'appt', label:'Appointments',  Icon: CalendarDays, color: C.primary },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display:'flex', alignItems:'center', gap:7, padding:'8px 16px', borderRadius:11, border:'none', cursor:'pointer',
            background: tab===t.key ? `linear-gradient(135deg, ${t.color} 0%, ${t.color}cc 100%)` : 'transparent',
            color: tab===t.key ? 'white' : C.muted, fontWeight:600, fontSize:13,
            fontFamily:"'Inter', sans-serif", transition:'all 0.2s',
            boxShadow: tab===t.key ? `0 4px 12px ${t.color}40` : 'none',
          }}>
            <t.Icon style={{ width:14, height:14 }} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'pay'  && <PayTab  showToast={showToast} />}
      {tab === 'appt' && <ApptTab showToast={showToast} />}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─────────────────────────────────────────────
// TAB 1: MARCAR PAGADOS
// ─────────────────────────────────────────────
function PayTab({ showToast }: { showToast: (m:string)=>void }) {
  const [rows,       setRows]       = useState<TurnoRow[]>([])
  const [matches,    setMatches]    = useState<PayMatch[]>([])
  const [loading,    setLoading]    = useState(false)
  const [processing, setProcessing] = useState(false)
  const [results,    setResults]    = useState<{paid:number;skipped:number;errors:number}|null>(null)
  const [fileName,   setFileName]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const matchWithAPI = useCallback(async (turnoRows: TurnoRow[]) => {
    setLoading(true)
    try {
      const dates = turnoRows.map(r => normalizeDate(r.date)).filter(Boolean).sort()
      if (!dates.length) { showToast('No se pudieron parsear las fechas'); return }
      const res = await fetch(`/api/getReports?type=importMatch&dateFrom=${dates[0]}&dateTo=${dates[dates.length-1]}`)
      if (!res.ok) throw new Error('Error al cargar datos')
      const { cleanings, propsMap } = await res.json()

      setMatches(turnoRows.map(row => {
        const rowDate = normalizeDate(row.date)
        const rowProp = normalize(row.property)
        const candidates = cleanings.filter((c: any) => c.fields?.Date === rowDate)
        let bestMatch: any = null, matchType: 'turnoName'|'exact'|'none' = 'none'
        for (const c of candidates) {
          const propIds: string[] = Array.isArray(c.fields?.Property) ? c.fields.Property : []
          for (const pid of propIds) {
            const prop = propsMap[pid]; if (!prop) continue
            if (prop.turnoName) {
              const nt = normalize(prop.turnoName)
              if (nt === rowProp || nt.includes(rowProp) || rowProp.includes(nt)) { bestMatch = c; matchType = 'turnoName'; break }
            }
            if (normalize(prop.name) === rowProp && matchType === 'none') { bestMatch = c; matchType = 'exact' }
          }
          if (matchType === 'turnoName') break
        }
        return { turnoRow: row, cleaningId: bestMatch?.id||null, cleaningProperty: bestMatch?.fields?.['Property Text']||'', matchType, alreadyPaid: (bestMatch?.fields?.['Payment Status']||'').toLowerCase()==='paid' }
      }))
    } catch(e: any) { showToast('Error: ' + e.message) }
    finally { setLoading(false) }
  }, [showToast])

  const handleFile = async (file: File) => {
    setFileName(file.name); setResults(null); setMatches([])
    const text = await file.text()
    const parsed = parseCSV(text)
    if (!parsed.length) { showToast('No se encontraron filas válidas'); return }
    setRows(parsed); await matchWithAPI(parsed)
  }

  const applyPayments = async () => {
    const toUpdate = matches.filter(m => m.cleaningId && !m.alreadyPaid)
    if (!toUpdate.length) { showToast('Nada nuevo para marcar'); return }
    setProcessing(true)
    try {
      const res = await fetch('/api/getReports?type=importApply', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ updates: toUpdate.map(m => ({ cleaningId:m.cleaningId, amount:m.turnoRow.amount, projectNumber:m.turnoRow.projectNumber })) })
      })
      const data = await res.json()
      const paid = data.results?.filter((r:any)=>r.ok).length||0
      setResults({ paid, skipped: matches.length-toUpdate.length, errors: data.results?.filter((r:any)=>!r.ok).length||0 })
      showToast(`✓ ${paid} marcadas como Paid`)
      await matchWithAPI(rows)
    } catch(e:any) { showToast('Error: '+e.message) }
    finally { setProcessing(false) }
  }

  const toProcess = matches.filter(m => m.cleaningId && !m.alreadyPaid)
  const alreadyPd = matches.filter(m => m.alreadyPaid)
  const unmatched = matches.filter(m => !m.cleaningId)
  const totalAmt  = toProcess.reduce((a,m) => a+m.turnoRow.amount, 0)

  return (
    <div>
      {/* Upload */}
      <div onClick={() => fileRef.current?.click()} onDragOver={e=>e.preventDefault()}
        onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f)}}
        style={{ border:`2px dashed ${C.border}`, borderRadius:16, padding:'36px 24px', textAlign:'center', cursor:'pointer', marginBottom:20, background:C.white }}
        onMouseEnter={e=>(e.currentTarget.style.borderColor=C.primary)} onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f)}} />
        <Upload style={{width:28,height:28,color:C.muted,margin:'0 auto 10px'}} />
        {fileName ? <p style={{fontSize:14,fontWeight:700,color:C.ink}}>{fileName}</p>
          : <p style={{fontSize:13,color:C.muted}}>Arrastra el CSV/TSV de Turno · <span style={{color:C.primary,fontWeight:600}}>Reports → Transactions</span></p>}
      </div>

      {loading && <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 18px',background:C.primaryLight,borderRadius:12,marginBottom:16}}>
        <RefreshCw style={{width:15,height:15,color:C.primary,animation:'spin 1s linear infinite'}} />
        <span style={{fontSize:13,color:C.primary,fontWeight:600}}>Cruzando con Airtable...</span>
      </div>}

      {matches.length > 0 && !loading && <>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
          {[
            {label:'Para pagar', count:toProcess.length, sub:`$${totalAmt.toFixed(2)}`, bg:C.greenLight, color:C.green, Icon:CheckCircle2},
            {label:'Ya pagadas', count:alreadyPd.length, sub:'ya procesadas', bg:'#DBEAFE', color:'#2563EB', Icon:DollarSign},
            {label:'Sin match',  count:unmatched.length, sub:'revisar Turno Name', bg:C.redLight, color:C.red, Icon:XCircle},
          ].map(s=>(
            <div key={s.label} style={{background:s.bg,borderRadius:14,padding:'14px 16px',border:`1px solid ${s.color}25`}}>
              <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}>
                <s.Icon style={{width:13,height:13,color:s.color}} />
                <span style={{fontSize:10,fontWeight:700,color:s.color,textTransform:'uppercase',letterSpacing:'0.05em'}}>{s.label}</span>
              </div>
              <p style={{fontSize:22,fontWeight:900,color:s.color,margin:0}}>{s.count}</p>
              <p style={{fontSize:11,color:C.muted,marginTop:2}}>{s.sub}</p>
            </div>
          ))}
        </div>

        {toProcess.length > 0 && !results && (
          <button onClick={applyPayments} disabled={processing} style={{display:'flex',alignItems:'center',gap:8,height:44,padding:'0 24px',borderRadius:12,border:'none',background:`linear-gradient(135deg,${C.green} 0%,#059669 100%)`,color:'white',fontSize:14,fontWeight:700,cursor:'pointer',marginBottom:16,boxShadow:'0 4px 12px #10B98140'}}>
            {processing ? <><RefreshCw style={{width:16,height:16,animation:'spin 1s linear infinite'}} />Procesando...</> : <><CheckCircle2 style={{width:16,height:16}} />Marcar {toProcess.length} como Paid (${totalAmt.toFixed(2)})</>}
          </button>
        )}
        {results && <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
          <div style={{background:C.greenLight,border:`1px solid ${C.green}30`,borderRadius:10,padding:'10px 16px',fontSize:13,fontWeight:700,color:C.green}}>✓ {results.paid} pagadas</div>
          {results.skipped>0&&<div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 16px',fontSize:13,color:C.muted}}>{results.skipped} omitidas</div>}
          {results.errors>0&&<div style={{background:C.redLight,border:`1px solid ${C.red}30`,borderRadius:10,padding:'10px 16px',fontSize:13,fontWeight:700,color:C.red}}>{results.errors} errores</div>}
        </div>}

        <div style={{background:C.white,borderRadius:16,border:`1px solid ${C.border}`,overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'90px 1fr 1fr 90px 90px 100px',padding:'10px 16px',background:C.bg,borderBottom:`1px solid ${C.border}`}}>
            {['Fecha','Propiedad Turno','Limpieza ShineUp','Monto','Match','Estado'].map(h=>(
              <span key={h} style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</span>
            ))}
          </div>
          <div style={{maxHeight:400,overflowY:'auto'}}>
            {matches.map((m,i)=>{
              const mc=m.matchType==='none'?C.red:m.matchType==='turnoName'?C.green:C.primary
              const ml=m.matchType==='none'?'Sin match':m.matchType==='turnoName'?'Turno Name':'Exacto'
              const sc=m.alreadyPaid?'#2563EB':m.cleaningId?C.green:C.red
              return (
                <div key={i} style={{display:'grid',gridTemplateColumns:'90px 1fr 1fr 90px 90px 100px',padding:'10px 16px',borderBottom:i<matches.length-1?`1px solid ${C.border}`:'none',alignItems:'center',background:m.matchType==='none'?'#FFF5F5':m.alreadyPaid?'#F0F9FF':'white'}}>
                  <span style={{fontSize:11,color:C.slate}}>{m.turnoRow.date}</span>
                  <span style={{fontSize:12,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.turnoRow.property}</span>
                  <span style={{fontSize:12,color:m.cleaningId?C.ink:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.cleaningProperty||'—'}</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.ink}}>${m.turnoRow.amount.toFixed(2)}</span>
                  <span style={{fontSize:10,fontWeight:700,color:mc,background:`${mc}15`,padding:'3px 8px',borderRadius:6,textAlign:'center'}}>{ml}</span>
                  <span style={{fontSize:11,fontWeight:700,color:sc}}>{m.alreadyPaid?'Ya pagada':m.cleaningId?'Pagar':'—'}</span>
                </div>
              )
            })}
          </div>
        </div>

        {unmatched.length>0&&(
          <div style={{marginTop:12,padding:'12px 16px',background:C.amberLight,borderRadius:12,border:`1px solid ${C.amber}30`}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
              <AlertTriangle style={{width:14,height:14,color:C.amber}} />
              <span style={{fontSize:12,fontWeight:700,color:C.amber}}>Agrega "Turno Name" en Properties para estos:</span>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {unmatched.map((m,i)=>(
                <span key={i} style={{fontSize:11,background:'white',border:`1px solid ${C.border}`,borderRadius:8,padding:'4px 10px',color:C.slate}}>
                  <strong>{m.turnoRow.property}</strong> · {m.turnoRow.date}
                </span>
              ))}
            </div>
          </div>
        )}
      </>}
    </div>
  )
}

// ─────────────────────────────────────────────
// TAB 2: CREAR APPOINTMENTS
// ─────────────────────────────────────────────
function ApptTab({ showToast }: { showToast: (m:string)=>void }) {
  const [date,       setDate]       = useState(todayDate())
  const [rawText,    setRawText]    = useState('')
  const [propMatches, setPropMatches] = useState<PropMatch[]>([])
  const [loading,    setLoading]    = useState(false)
  const [creating,   setCreating]   = useState(false)
  const [results,    setResults]    = useState<{created:number;errors:number}|null>(null)

  const matchProperties = useCallback(async (text: string) => {
    const names = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (!names.length) return
    setLoading(true)
    try {
      const r = await fetch(`/api/getReports?type=importMatch&dateFrom=${date}&dateTo=${date}`)
      const data = await r.json()
      const propsMap = data.propsMap || {}
      const matched = names.map(name => {
        const normName = normalize(name)
        let bestId: string|null = null, bestPropName = '', matchType: 'turnoName'|'exact'|'none' = 'none'
        for (const [id, prop] of Object.entries(propsMap) as [string, any][]) {
          if (prop.turnoName) {
            const nt = normalize(prop.turnoName)
            if (nt === normName || nt.includes(normName) || normName.includes(nt)) {
              bestId = id; bestPropName = prop.name; matchType = 'turnoName'; break
            }
          }
          if (normalize(prop.name) === normName && matchType === 'none') {
            bestId = id; bestPropName = prop.name; matchType = 'exact'
          }
        }
        return { name, propertyId: bestId, propertyName: bestPropName, matchType }
      })
      setPropMatches(matched)
    } catch(e: any) { showToast('Error: '+e.message) }
    finally { setLoading(false) }
  }, [date, showToast])

  useEffect(() => {
    if (rawText.trim()) matchProperties(rawText)
  }, [date])

  const handleTextChange = (text: string) => {
    setRawText(text); setResults(null)
    if (text.trim()) matchProperties(text)
    else setPropMatches([])
  }

  const createAppointments = async () => {
    const toCreate = propMatches.filter(p => p.propertyId)
    if (!toCreate.length) { showToast('No hay propiedades que crear'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/getReports?type=createAppointments', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ date, properties: toCreate.map(p => ({ name: p.name, propertyId: p.propertyId })) })
      })
      const data = await res.json()
      const created = data.results?.filter((r:any)=>r.ok).length||0
      const errors  = data.results?.filter((r:any)=>!r.ok).length||0
      setResults({ created, errors })
      showToast(`✓ ${created} appointments creados para ${date}`)
    } catch(e:any) { showToast('Error: '+e.message) }
    finally { setCreating(false) }
  }

  const matched   = propMatches.filter(p => p.propertyId)
  const unmatched = propMatches.filter(p => !p.propertyId)

  return (
    <div>
      {/* Date selector — grande y prominente */}
      <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, padding:'24px 28px', marginBottom:20 }}>
        <p style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Fecha Requested</p>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ fontSize:28, fontWeight:800, color:C.primary, border:'none', outline:'none', background:'transparent', fontFamily:"'Inter', sans-serif", cursor:'pointer', width:'100%' }} />
        <p style={{ fontSize:12, color:C.muted, marginTop:6 }}>
          Todos los appointments se crearán con esta fecha · Source: <strong>Turno</strong> · Status: <strong>Confirmed</strong>
        </p>
      </div>

      {/* Paste list */}
      <div style={{ marginBottom:20 }}>
        <p style={{ fontSize:12, fontWeight:600, color:C.slate, marginBottom:8 }}>Pega la lista de propiedades de Turno (una por línea):</p>
        <textarea
          value={rawText}
          onChange={e => handleTextChange(e.target.value)}
          placeholder={"1329 Indianola Ave\n2552 Glenmawr\n228 Schultz Ave A\nHome sweet home\n..."}
          style={{ width:'100%', height:180, padding:'12px 14px', borderRadius:12, border:`1.5px solid ${C.border}`, fontSize:13, color:C.ink, fontFamily:"'Inter', sans-serif", outline:'none', resize:'vertical', boxSizing:'border-box' }}
        />
      </div>

      {loading && <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 18px',background:C.primaryLight,borderRadius:12,marginBottom:16}}>
        <RefreshCw style={{width:15,height:15,color:C.primary,animation:'spin 1s linear infinite'}} />
        <span style={{fontSize:13,color:C.primary,fontWeight:600}}>Cruzando con Properties...</span>
      </div>}

      {propMatches.length > 0 && !loading && <>
        {/* Summary */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <div style={{background:C.greenLight,borderRadius:14,padding:'14px 16px',border:`1px solid ${C.green}25`}}>
            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}>
              <CheckCircle2 style={{width:13,height:13,color:C.green}} />
              <span style={{fontSize:10,fontWeight:700,color:C.green,textTransform:'uppercase',letterSpacing:'0.05em'}}>Match encontrado</span>
            </div>
            <p style={{fontSize:22,fontWeight:900,color:C.green,margin:0}}>{matched.length}</p>
            <p style={{fontSize:11,color:C.muted,marginTop:2}}>se crearán como Appointments</p>
          </div>
          <div style={{background:C.redLight,borderRadius:14,padding:'14px 16px',border:`1px solid ${C.red}25`}}>
            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}>
              <XCircle style={{width:13,height:13,color:C.red}} />
              <span style={{fontSize:10,fontWeight:700,color:C.red,textTransform:'uppercase',letterSpacing:'0.05em'}}>Sin match</span>
            </div>
            <p style={{fontSize:22,fontWeight:900,color:C.red,margin:0}}>{unmatched.length}</p>
            <p style={{fontSize:11,color:C.muted,marginTop:2}}>revisar Turno Name</p>
          </div>
        </div>

        {matched.length > 0 && !results && (
          <button onClick={createAppointments} disabled={creating} style={{display:'flex',alignItems:'center',gap:8,height:44,padding:'0 24px',borderRadius:12,border:'none',background:`linear-gradient(135deg,${C.primary} 0%,#4F46E5 100%)`,color:'white',fontSize:14,fontWeight:700,cursor:'pointer',marginBottom:16,boxShadow:'0 4px 12px #6366F140'}}>
            {creating ? <><RefreshCw style={{width:16,height:16,animation:'spin 1s linear infinite'}} />Creando...</> : <><Plus style={{width:16,height:16}} />Crear {matched.length} Appointments para {date}</>}
          </button>
        )}
        {results && <div style={{display:'flex',gap:10,marginBottom:16}}>
          <div style={{background:C.greenLight,border:`1px solid ${C.green}30`,borderRadius:10,padding:'10px 16px',fontSize:13,fontWeight:700,color:C.green}}>✓ {results.created} creados</div>
          {results.errors>0&&<div style={{background:C.redLight,border:`1px solid ${C.red}30`,borderRadius:10,padding:'10px 16px',fontSize:13,fontWeight:700,color:C.red}}>{results.errors} errores</div>}
        </div>}

        {/* Match list */}
        <div style={{background:C.white,borderRadius:16,border:`1px solid ${C.border}`,overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 100px',padding:'10px 16px',background:C.bg,borderBottom:`1px solid ${C.border}`}}>
            {['Nombre Turno','Propiedad en ShineUp','Match'].map(h=>(
              <span key={h} style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</span>
            ))}
          </div>
          <div style={{maxHeight:400,overflowY:'auto'}}>
            {propMatches.map((p,i)=>{
              const mc=p.matchType==='none'?C.red:p.matchType==='turnoName'?C.green:C.primary
              const ml=p.matchType==='none'?'Sin match':p.matchType==='turnoName'?'Turno Name':'Exacto'
              return (
                <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 100px',padding:'10px 16px',borderBottom:i<propMatches.length-1?`1px solid ${C.border}`:'none',alignItems:'center',background:p.matchType==='none'?'#FFF5F5':'white'}}>
                  <span style={{fontSize:12,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
                  <span style={{fontSize:12,color:p.propertyId?C.ink:C.muted}}>{p.propertyName||'—'}</span>
                  <span style={{fontSize:10,fontWeight:700,color:mc,background:`${mc}15`,padding:'3px 8px',borderRadius:6,textAlign:'center'}}>{ml}</span>
                </div>
              )
            })}
          </div>
        </div>

        {unmatched.length>0&&(
          <div style={{marginTop:12,padding:'12px 16px',background:C.amberLight,borderRadius:12,border:`1px solid ${C.amber}30`}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
              <AlertTriangle style={{width:14,height:14,color:C.amber}} />
              <span style={{fontSize:12,fontWeight:700,color:C.amber}}>Sin match — agrega "Turno Name" en Properties:</span>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {unmatched.map((p,i)=>(
                <span key={i} style={{fontSize:11,background:'white',border:`1px solid ${C.border}`,borderRadius:8,padding:'4px 10px',color:C.slate}}>{p.name}</span>
              ))}
            </div>
          </div>
        )}
      </>}
    </div>
  )
}
