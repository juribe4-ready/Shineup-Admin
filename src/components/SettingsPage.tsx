import { Database, Bell, Palette, Shield } from 'lucide-react'

const C = {
  primary: '#6366F1',
  ink: '#0F172A',
  muted: '#94A3B8',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  white: '#FFFFFF',
}

export default function SettingsPage() {
  const sections = [
    { icon: Database, label: 'Propiedades', description: 'Gestionar propiedades y default times', ready: false },
    { icon: Bell, label: 'Notificaciones', description: 'Configurar alertas y notificaciones', ready: false },
    { icon: Palette, label: 'Apariencia', description: 'Temas y personalización', ready: false },
    { icon: Shield, label: 'Seguridad', description: 'Contraseñas y permisos', ready: false },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: C.ink, marginBottom: 8 }}>
        Configuración
      </h2>
      <p style={{ color: C.muted, fontSize: 14, marginBottom: 32 }}>
        Ajustes del sistema (próximamente)
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sections.map((section, i) => (
          <div 
            key={i}
            style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              opacity: section.ready ? 1 : 0.6,
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: C.bg, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <section.icon style={{ width: 22, height: 22, color: C.primary }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0 }}>{section.label}</p>
              <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{section.description}</p>
            </div>
            {!section.ready && (
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: C.muted, background: C.bg, padding: '4px 10px', borderRadius: 8 }}>
                Próximamente
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
