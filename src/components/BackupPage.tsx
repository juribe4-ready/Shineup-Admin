import { useState, useRef } from 'react'
import { Download, RefreshCw, FolderOpen } from 'lucide-react'

const C = {
  primary: '#6366F1', primaryLight: '#EEF2FF', primaryDark: '#4F46E5',
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', red: '#EF4444', amber: '#F59E0B',
}

interface WeekGroup {
  weekKey: string
  label: string
  dateRange: string
  files: { public_id: string; url: string; created_at: string; bytes: number; resource_type: string }[]
  totalMB: number
  keep: boolean
}

interface LogEntry {
  type: 'info' | 'ok' | 'err' | 'warn'
  msg: string
}


function getWeekKey(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d.setDate(diff))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (dt: Date) => `${String(dt.getDate()).padStart(2,'0')}${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][dt.getMonth()]}`
  const year = mon.getFullYear()
  const weekNum = getWeekNumber(mon)
  return `${year}-W${String(weekNum).padStart(2,'0')}_${fmt(mon)}-${fmt(sun)}`
}

function getWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0,0,0,0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

function getKeepWeeks(): Set<string> {
  const today = new Date()
  const thisWeek = getWeekKey(today)
  const lastWeek = new Date(today)
  lastWeek.setDate(today.getDate() - 7)
  const lastWeekKey = getWeekKey(lastWeek)
  return new Set([thisWeek, lastWeekKey])
}

export default function BackupPage() {
  const [weeks, setWeeks]           = useState<WeekGroup[]>([])
  const [scanning, setScanning]     = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [log, setLog]               = useState<LogEntry[]>([])
  const [progress, setProgress]     = useState({ done: 0, total: 0, phase: '' })
  const [scanned, setScanned]       = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  const addLog = (type: LogEntry['type'], msg: string) => {
    setLog(prev => [...prev, { type, msg }])
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const scan = async () => {
    setScanning(true)
    setLog([])
    setWeeks([])
    setScanned(false)
    addLog('info', 'Conectando con Cloudinary...')

    try {
      const res = await fetch('/api/cloudinary?action=list')
      if (!res.ok) throw new Error('Error al listar archivos')
      const data = await res.json()
      const resources = data.resources || []

      addLog('info', `${resources.length} archivos encontrados en Cloudinary`)

      const keepWeeks = getKeepWeeks()
      const grouped: Record<string, WeekGroup> = {}

      for (const r of resources) {
        const date = new Date(r.created_at)
        const wk = getWeekKey(date)
        if (!grouped[wk]) {
          grouped[wk] = { weekKey: wk, label: wk, dateRange: '', files: [], totalMB: 0, keep: keepWeeks.has(wk) }
        }
        grouped[wk].files.push(r)
        grouped[wk].totalMB += (r.bytes || 0) / (1024 * 1024)
      }

      const sorted = Object.values(grouped).sort((a, b) => a.weekKey < b.weekKey ? -1 : 1)
      setWeeks(sorted)
      setScanned(true)

      const toDownload = sorted.filter(w => !w.keep)
      const toKeep = sorted.filter(w => w.keep)
      addLog('ok', `${toDownload.length} semanas para descargar, ${toKeep.length} semanas a retener en Cloudinary`)
      toKeep.forEach(w => addLog('warn', `Retener: ${w.weekKey} (${w.files.length} archivos)`))
    } catch (err: any) {
      addLog('err', err.message)
    } finally {
      setScanning(false)
    }
  }

  const runBackup = async () => {
    const toProcess = weeks.filter(w => !w.keep)
    const allFiles = toProcess.flatMap(w => w.files)
    if (allFiles.length === 0) { addLog('warn', 'No hay archivos para descargar'); return }

    setDownloading(true)
    setProgress({ done: 0, total: allFiles.length, phase: 'Descargando' })
    addLog('info', `Iniciando descarga de ${allFiles.length} archivos en ${toProcess.length} semanas...`)

    const successIds: string[] = []

    for (const week of toProcess) {
      addLog('info', `📁 Semana ${week.weekKey} — ${week.files.length} archivos (${week.totalMB.toFixed(1)} MB)`)

      for (const file of week.files) {
        try {
          const res = await fetch('/api/cloudinary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: "download", url: file.url, publicId: file.public_id, weekKey: week.weekKey, createdAt: file.created_at })
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          addLog('ok', `  ✓ ${data.filename}`)
          successIds.push(file.public_id)
        } catch (err: any) {
          addLog('err', `  ✗ ${file.public_id}: ${err.message}`)
        }
        setProgress(p => ({ ...p, done: p.done + 1 }))
      }
    }

    addLog('ok', `Descarga completada: ${successIds.length}/${allFiles.length} archivos`)
    setDownloading(false)

    if (successIds.length === 0) return

    const confirmed = window.confirm(`¿Eliminar ${successIds.length} archivos de Cloudinary? Esta acción es irreversible.`)
    if (!confirmed) { addLog('warn', 'Eliminación cancelada por el usuario'); return }

    setDeleting(true)
    setProgress({ done: 0, total: successIds.length, phase: 'Eliminando' })
    addLog('info', `Eliminando ${successIds.length} archivos de Cloudinary...`)

    let deleted = 0
    const batchSize = 20
    for (let i = 0; i < successIds.length; i += batchSize) {
      const batch = successIds.slice(i, i + batchSize)
      try {
        const res = await fetch('/api/cloudinary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: "delete", publicIds: batch })
        })
        if (!res.ok) throw new Error('Error al eliminar lote')
        const data = await res.json()
        deleted += data.deleted || 0
        setProgress(p => ({ ...p, done: Math.min(p.done + batchSize, successIds.length) }))
      } catch (err: any) {
        addLog('err', `Error en lote: ${err.message}`)
      }
    }

    addLog('ok', `✅ ${deleted} archivos eliminados de Cloudinary`)
    setDeleting(false)
    await scan()
  }

  const isRunning = scanning || downloading || deleting
  const toProcess = weeks.filter(w => !w.keep)
  const toKeep = weeks.filter(w => w.keep)
  const totalFilesToDl = toProcess.reduce((a, w) => a + w.files.length, 0)
  const totalMBToDl = toProcess.reduce((a, w) => a + w.totalMB, 0)

  const logColors: Record<string, string> = { info: C.muted, ok: C.green, err: C.red, warn: C.amber }

  return (
    <div className="space-y-5" style={{ fontFamily: 'Poppins, sans-serif' }}>

      {/* Header card */}
      <div className="rounded-3xl p-5 shadow-sm" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-black text-[16px] mb-1" style={{ color: C.ink }}>Cloudinary Media Backup</p>
            <p className="text-[13px] font-medium" style={{ color: C.muted }}>
              Descarga los archivos a Google Drive y limpia Cloudinary. Retiene siempre las últimas 2 semanas.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={scan} disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[13px] font-bold transition-all active:scale-95"
              style={{ background: C.bg, color: C.slate, border: `1.5px solid ${C.border}`, opacity: isRunning ? 0.6 : 1 }}>
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Escaneando...' : 'Escanear'}
            </button>
            {scanned && toProcess.length > 0 && (
              <button onClick={runBackup} disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-white text-[13px] font-bold transition-all active:scale-95"
                style={{ background: C.primary, opacity: isRunning ? 0.6 : 1 }}>
                <Download className="w-4 h-4" />
                {downloading ? `Descargando ${progress.done}/${progress.total}...` :
                 deleting ? `Eliminando ${progress.done}/${progress.total}...` :
                 `Backup ${totalFilesToDl} archivos`}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {(downloading || deleting) && progress.total > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-[11px] font-bold mb-1.5" style={{ color: C.primary }}>
              <span>{progress.phase}...</span>
              <span>{Math.round((progress.done / progress.total) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: C.primaryLight }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%`, background: C.primary }} />
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      {scanned && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total archivos', value: weeks.reduce((a,w) => a + w.files.length, 0).toString(), color: C.ink },
            { label: 'A descargar', value: totalFilesToDl.toString(), color: C.primary },
            { label: 'MB a descargar', value: totalMBToDl.toFixed(0), color: C.amber },
            { label: 'Semanas a retener', value: toKeep.length.toString(), color: C.green },
          ].map(s => (
            <div key={s.label} className="rounded-3xl p-4 shadow-sm" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <p className="font-black text-[24px] leading-none" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px] font-semibold mt-1 uppercase tracking-wide" style={{ color: C.muted }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Weeks grid */}
      {weeks.length > 0 && (
        <div className="rounded-3xl overflow-hidden shadow-sm" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
            <p className="font-black text-[14px]" style={{ color: C.ink }}>Semanas encontradas</p>
          </div>
          <div className="divide-y" style={{ borderColor: C.border }}>
            {weeks.map(week => (
              <div key={week.weekKey} className="flex items-center gap-4 px-5 py-3.5">
                <div className={`w-2 h-2 rounded-full shrink-0`} style={{ background: week.keep ? C.green : C.primary }} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[13px]" style={{ color: C.ink }}>{week.weekKey}</p>
                  <p className="text-[11px] font-medium" style={{ color: C.muted }}>{week.files.length} archivos · {week.totalMB.toFixed(1)} MB</p>
                </div>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full"
                  style={{ background: week.keep ? '#ECFDF5' : C.primaryLight, color: week.keep ? C.green : C.primary }}>
                  {week.keep ? '🔒 Retener' : '⬇️ Descargar'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div className="rounded-3xl overflow-hidden shadow-sm" style={{ background: C.ink, border: `1px solid ${C.border}` }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="font-black text-[13px] text-white">Log de ejecución</p>
            <button onClick={() => setLog([])} className="text-[11px] font-bold px-3 py-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>Limpiar</button>
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '12px 16px', fontFamily: 'monospace' }}>
            {log.map((entry, i) => (
              <div key={i} className="text-[11px] leading-relaxed" style={{ color: logColors[entry.type] || C.muted }}>
                {entry.msg}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {!scanned && !scanning && (
        <div className="flex flex-col items-center py-16 gap-3" style={{ color: C.muted }}>
          <FolderOpen className="w-12 h-12 opacity-20" />
          <p className="font-semibold text-[14px]">Haz click en "Escanear" para ver los archivos en Cloudinary</p>
        </div>
      )}
    </div>
  )
}
