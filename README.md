# OctoApp

Sistema integral de gestión comercial y operación de rutas para empresas de distribución y ventas móviles.

## Características principales

- Gestión de ventas y cobranzas
- Control de inventario y almacenes
- Punto de venta (POS)
- Rutas móviles para vendedores
- Gestión de clientes y proveedores
- Facturación CFDI
- Reportes y dashboards
- Logística y entregas
- Sincronización offline
- Notificaciones y WhatsApp

---

# Stack tecnológico

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Query
- Zustand

## Backend

- Supabase
  - PostgreSQL
  - Authentication
  - Edge Functions
  - Storage
  - Realtime

## Integraciones

- OpenPay
- Stripe
- Facturama
- Google Maps
- WhatsApp

---

# Requisitos

- Node.js 20+
- npm 10+

---

# Instalación local

```bash
git clone <REPO_URL>

cd octoapp

npm install
```

---

# Variables de entorno

Crear archivo `.env`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

---

# Ejecutar en desarrollo

```bash
npm run dev
```

---

# Build de producción

```bash
npm run build
```

---

# Testing

```bash
npm run test
npm run test:e2e
```

---

# Estructura del proyecto

```txt
src/
  components/
  hooks/
  pages/
  lib/
  contexts/
  integrations/
  stores/

supabase/
  functions/
  migrations/
```

---

# Arquitectura

OctoApp utiliza una arquitectura SPA basada en React y Supabase.

La lógica de negocio se divide entre:

- Frontend React
- Edge Functions de Supabase
- Policies y procedimientos SQL
- Sincronización offline local

---

# Funcionalidades offline

La aplicación soporta operación offline parcial mediante:

- IndexedDB (Dexie)
- Cola de sincronización
- Cache local
- Restauración automática de pendientes

---

# Deployment

La aplicación puede desplegarse en cualquier proveedor compatible con aplicaciones Vite/React:

- Vercel
- Netlify
- VPS
- Docker

---

# Licencia

Propiedad privada. Uso interno únicamente.  .
