# ShineUP Admin

Panel de administración para ShineUP Cleaning Services (Columbus, OH).
Gestión de usuarios, dashboard operacional y reportes.

---

## URLs

| App | URL |
|---|---|
| ShineUP Ops (Cleaners) | `https://shineup-ops.vercel.app` |
| ShineUP Admin | `https://shineup-admin.vercel.app` |

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend (API) | Vercel Serverless Functions (`/api/*.js`) |
| Auth | Supabase (`jpdajjiaukzilrxwcgtx.supabase.co`) |
| Base de datos operacional | Airtable (`appBwnoxgyIXILe6M`) |
| Hosting | Vercel (`shineup-admin.vercel.app`) |
| Fuente | Poppins (Google Fonts) |

---

## Repositorio

`github.com/juribe4-ready/Shineup-Admin` — rama `main`

---

## Estructura de archivos

```
Shineup-Admin/
├── api/
│   ├── getStaff.js       ← Lista de staff desde Airtable
│   ├── inviteUser.js     ← Invita usuario + busca en Airtable + registra en invited_emails
│   └── deleteUser.js     ← Elimina usuario de Supabase Auth y profiles
├── src/
│   ├── supabase.ts       ← Cliente Supabase + interface Profile
│   ├── App.tsx           ← Routing por rol (login / admin)
│   ├── main.tsx
│   ├── index.css
│   ├── vite-env.d.ts     ← Tipos para variables de entorno Vite
│   └── components/
│       ├── LoginPage.tsx  ← Login con Google y email/password
│       └── UsersPage.tsx  ← Gestión de usuarios
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.js
├── postcss.config.js
└── vercel.json
```

---

## Variables de entorno (Vercel)

| Variable | Descripción |
|---|---|
| `AIRTABLE_TOKEN` | Personal Access Token de Airtable (`patcDP...`) |
| `VITE_SUPABASE_URL` | `https://jpdajjiaukzilrxwcgtx.supabase.co` |
| `VITE_SUPABASE_KEY` | Publishable key de Supabase |
| `VITE_AIRTABLE_TOKEN` | Mismo token de Airtable (para uso en frontend) |
| `SUPABASE_SERVICE_KEY` | Service Role key de Supabase (secreto — para invitar y eliminar usuarios) |

---

## Supabase — Tablas

### profiles
```sql
id uuid (= auth.users.id)
email text unique
role text → 'admin' | 'manager' | 'cleaner' | 'client'
staff_airtable_id text → record ID en tabla Staff de Airtable
full_name text
initials text
active boolean
invited_at timestamp
created_at timestamp
```

### invited_emails
```sql
email text primary key
role text
invited_by uuid
invited_at timestamp
used boolean → true cuando el usuario ya se registró
```

---

## Roles y accesos

| Rol | ShineUP Ops | ShineUP Admin |
|---|---|---|
| `admin` | ✅ Checklist completo | ✅ Acceso total |
| `manager` | ✅ Checklist completo | ✅ Dashboard (sin gestión de usuarios) |
| `cleaner` | ✅ Solo sus limpiezas | ❌ Sin acceso |
| `client` | ❌ Sin acceso | ❌ Portal cliente (futuro) |

---

## Flujo de invitación de usuario

```
Admin abre modal "Invitar usuario"
        ↓
Ingresa email + selecciona rol
        ↓
/api/inviteUser:
  1. Busca email en Airtable Staff → auto-llena nombre, iniciales, staff_airtable_id
  2. Registra email en tabla invited_emails
  3. Envía email de invitación via Supabase Auth
  4. Si encontró el staff → actualiza perfil automáticamente
        ↓
Usuario recibe email → hace click → crea contraseña o entra con Google
        ↓
Trigger de Supabase verifica que email está en invited_emails
        ↓
Si está invitado → crea perfil con el rol correspondiente
Si NO está invitado → no crea perfil → no puede acceder
        ↓
Admin ve al usuario en la lista → puede ajustar rol, vincular staff, activar/desactivar
```

---

## Seguridad

- Solo emails en `invited_emails` pueden crear cuenta
- Row Level Security (RLS) activado en todas las tablas de Supabase
- `SUPABASE_SERVICE_KEY` nunca expuesto en el frontend — solo en funciones de Vercel
- Usuarios inactivos (`active: false`) son rechazados al hacer login
- Admin puede eliminar usuarios permanentemente (borra de Auth y profiles)

---

## Google OAuth

- **Client ID:** `461215314087-5attrru3ta6aiu361c1h5ae2t6aqndmu.apps.googleusercontent.com`
- **Redirect URI configurada:** `https://jpdajjiaukzilrxwcgtx.supabase.co/auth/v1/callback`
- **Site URL en Supabase:** `https://shineup-ops.vercel.app`
- **Redirect URLs en Supabase:** `https://shineup-ops.vercel.app`, `https://shineup-admin.vercel.app`

---

## Diseño

- **Paleta:** Slate oscuro (`#1E293B`) + Indigo (`#6366F1`)
- **Fuente:** Poppins 400/500/600/700/800/900
- **Diferenciado de ShineUP Ops** (que usa Teal `#00BCD4`) para distinguir claramente las dos apps
- Responsive — funciona en desktop y móvil

---

## Roadmap

### ✅ Completado
- Login con Google y email/password
- Gestión de usuarios — invitar, roles, activo/inactivo, eliminar
- Vinculación automática con Staff de Airtable por email
- Control de acceso — solo emails invitados pueden registrarse
- Responsive en móvil

### 📋 Próximo
- Configurar SMTP personalizado (eliminar límite de 3 emails/hora)
- Dashboard operacional — mapa con puntos de color por status
- Timeline agrupado por stafflist en tiempo real
- Gestión de incidentes — flujo de aprobación y cambio de status
- Gestión de inventario — resolución y seguimiento
- Módulo de comunicación SMS con clientes (Twilio)
- Portal del cliente
- Módulo de programación (appointments)
- CRM

---

## Notas técnicas

- Las funciones de Vercel usan `AIRTABLE_TOKEN` (sin prefijo VITE) porque corren en el servidor
- El frontend usa `VITE_*` variables que Vite inyecta en tiempo de build
- `SUPABASE_SERVICE_KEY` solo va en variables de Vercel, nunca en el código
- El límite de invitaciones de Supabase gratuito es ~3/hora — configurar SMTP propio para eliminar este límite
