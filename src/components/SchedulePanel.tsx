import { useState } from 'react'
import { C, btn, selStyle, fmtDow } from './reports/shared'
import { ORIGIN, TYPE_STYLE, fmt12, toHM } from './scheduleLib'
import type { Item } from './SchedulePage'

interface Props {
  item: Item; mobile: boolean; types: { id: string; name: string }[]; busy: boolean
  onClose: () => void
  onSave: (it: Item, v: { date: string; time: string; typeId?: string }) => void
  onStatus: (it: Item, status: 'Lead' | 'Cancelled') => void
  onCancelCleaning: (it: Item) => void
  onDispatch: (it: Item) => void
}
export default function SchedulePanel({ item: it, mobile, types, busy, onClose, onSave, onStatus, onCancelCleaning, onDispatch }: Props) {
  const [date, setDate] = useState(it.date)
  const [time, setTime] = useState(toHM(it.time) || '10:00')
  const curTypeId = types.find(t => t.name === it.type)?.id || ''
  const [typeId, setTypeId] = useState(curTypeId)
  const [confirm, setConfirm] = useState<'' | 'cancel'>('')
  const locked = it.done || it.started
  const launched = it.st === 'launched'
  const dirty = date !== it.date || time !== (toHM(it.time) || '10:00') || (!launched && typeId !== curTypeId)
  const o = ORIGIN[it.origin], ts = TYPE_STYLE[it.seg]
  const box: React.CSSProperties = mobile
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '88vh', overflowY: 'auto', borderRadius: '18px 18px 0 0', padding: 16 }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 440, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', borderRadius: 16, padding: 18 }
  const lab: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', margin: '10px 0 4px' }
  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 80 }} onClick={onClose}>
    <div style={{ ...box, background: '#fff', boxShadow: '0 20px 50px rgba(15,23,42,.3)' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: 11, background: o.color, color: '#fff', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{it.origin}</span>
        <b style={{ fontSize: 17, flex: 1 }}>{it.property}</b>
        <button onClick={onClose} style={{ ...btn(), height: 30, padding: '0 10px' }}>✕</button>
      </div>
      <div style={{ fontSize: 12.5, color: C.slate, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span>{o.label}</span><span>·</span><span>{fmtDow(it.date)} {fmt12(toHM(it.time))}</span>
        <span style={{ background: ts.bg, color: ts.fg, border: `1px solid ${ts.bd}`, borderRadius: 6, padding: '0 6px', fontWeight: 700, fontSize: 11 }}>{it.seg}</span>
        <span style={{ fontWeight: 700, color: launched ? C.green : it.st === 'confirmed' ? C.amber : C.muted }}>{it.done ? 'Terminada' : it.started ? 'En curso' : launched ? 'Lanzada' : it.st === 'confirmed' ? 'Confirmada, por lanzar' : 'Por confirmar'}</span>
      </div>
      {launched && <div style={{ fontSize: 12, color: C.slate, marginTop: 4 }}>Equipo: {it.cleaners.join(' + ') || 'Sin asignar'}{it.std ? ` · ${it.std.toFixed(1)} h estándar` : ''}</div>}
      {locked ? <div style={{ background: C.bg, borderRadius: 10, padding: 10, fontSize: 13, color: C.slate, marginTop: 12 }}>Esta limpieza ya {it.done ? 'terminó' : 'empezó'}: no se puede modificar desde aquí.</div> : <>
        <div style={lab}>Fecha y hora</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...selStyle, flex: 1, maxWidth: 'none' }} />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...selStyle, width: 120 }} />
        </div>
        {!launched && <><div style={lab}>Tipo de limpieza</div>
          <select value={typeId} onChange={e => setTypeId(e.target.value)} style={{ ...selStyle, width: '100%', maxWidth: 'none' }}><option value="">{it.type || 'Sin tipo'} (actual)</option>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></>}
        {launched && dirty && <div style={{ background: C.amberBg, color: C.amber, borderRadius: 10, padding: 9, fontSize: 12, marginTop: 10 }}>Al mover una limpieza lanzada se quita de Dispatch (vuelve a "sin asignar"). El staff ★ del lanzamiento se queda.</div>}
        <button disabled={!dirty || busy} onClick={() => onSave(it, { date, time, typeId: !launched && typeId !== curTypeId ? typeId : undefined })} style={{ ...btn(), width: '100%', marginTop: 12, background: dirty ? C.primaryDark : C.bg, color: dirty ? '#fff' : C.muted, borderColor: dirty ? C.primaryDark : C.border, fontWeight: 700, opacity: busy ? .6 : 1 }}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
        {launched && <button onClick={() => onDispatch(it)} style={{ ...btn(), width: '100%', marginTop: 8, fontWeight: 700 }}>Abrir en Dispatch ›</button>}
        {it.st === 'confirmed' && <button disabled={busy} onClick={() => onStatus(it, 'Lead')} style={{ ...btn(), width: '100%', marginTop: 8 }}>Devolver a por confirmar</button>}
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 14, paddingTop: 12 }}>
          {confirm === 'cancel' ? <div style={{ background: C.redBg, borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 13, color: C.red, fontWeight: 700 }}>{launched ? 'Se cancela la limpieza y su appointment (Status = Cancelled) y se quita de Dispatch. No se borra nada.' : 'Se marca el appointment como Cancelled. No se borra.'}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><button style={btn()} onClick={() => setConfirm('')}>No</button>
              <button disabled={busy} style={{ ...btn(), background: C.red, borderColor: C.red, color: '#fff', fontWeight: 700 }} onClick={() => launched ? onCancelCleaning(it) : onStatus(it, 'Cancelled')}>Sí, cancelar</button></div>
          </div> : <button onClick={() => setConfirm('cancel')} style={{ ...btn(), width: '100%', color: C.red, borderColor: '#FECACA' }}>{launched ? 'Cancelar limpieza…' : 'Cancelar appointment…'}</button>}
        </div>
      </>}
      {locked && launched && <button onClick={() => onDispatch(it)} style={{ ...btn(), width: '100%', marginTop: 10, fontWeight: 700 }}>Abrir en Dispatch ›</button>}
    </div>
  </div>
}
