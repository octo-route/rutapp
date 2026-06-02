# Documentación técnica — RutApp

> Documento de referencia para el equipo de desarrollo.
> Cubre arquitectura, base de datos, autenticación, permisos, edge functions, modo offline y despliegue.

---

## Índice

1. [Resumen del producto](#1-resumen-del-producto)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Requisitos e instalación](#3-requisitos-e-instalación)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Scripts disponibles](#5-scripts-disponibles)
6. [Estructura del proyecto](#6-estructura-del-proyecto)
7. [Arquitectura general](#7-arquitectura-general)
8. [Autenticación](#8-autenticación)
9. [Roles y permisos](#9-roles-y-permisos)
10. [Base de datos](#10-base-de-datos)
11. [Funciones RPC (PostgreSQL)](#11-funciones-rpc-postgresql)
12. [Enumeraciones (ENUMs)](#12-enumeraciones-enums)
13. [Edge Functions](#13-edge-functions)
14. [Modo offline y sincronización](#14-modo-offline-y-sincronización)
15. [PWA](#15-pwa)
16. [Rutas de la aplicación](#16-rutas-de-la-aplicación)
17. [Integraciones externas](#17-integraciones-externas)
18. [Convenciones para el desarrollador](#18-convenciones-para-el-desarrollador)
19. [Despliegue](#19-despliegue)
20. [Testing](#20-testing)

---

## 1. Resumen del producto

**RutApp** es un sistema integral de gestión comercial y operación de rutas para empresas de distribución y venta móvil (productos de consumo, abarrotes, etc.). Es una aplicación **SaaS multi-empresa** (multi-tenant): cada empresa cliente tiene sus propios usuarios, catálogos y operación, aislados entre sí.

Funcionalidad principal:

- **Ventas y pedidos** — venta directa, pedidos, precios por tarifa/lista, promociones, descuentos.
- **Cobranza** — cuentas por cobrar, aplicación de pagos, saldos iniciales, estados de cuenta.
- **Inventario y almacenes** — stock por almacén y por camión, traspasos, ajustes, conteos físicos, auditorías.
- **Compras** — órdenes de compra a proveedores, recepción de mercancía, pagos a proveedores.
- **Logística y rutas móviles** — cargas a vendedores, entregas, descargas, devoluciones, optimización de rutas, monitoreo GPS en vivo.
- **Punto de venta (POS)** — turnos de caja, arqueos.
- **Facturación CFDI** — timbrado de comprobantes fiscales (México, vía Facturama).
- **Reportes y dashboards** — ventas, utilidad, comisiones, clientes en riesgo, etc.
- **App de ruta** — interfaz móvil PWA para vendedores, con operación offline.
- **Suscripciones / billing** — la propia operación SaaS: planes, cobro recurrente, cupones.
- **Notificaciones y WhatsApp** — avisos in-app y mensajería WhatsApp (recibos, campañas).

La aplicación tiene dos grandes "modos" de uso:

- **Escritorio (back-office):** gestión completa, accedida desde navegador.
- **Ruta móvil (`/ruta`):** interfaz táctil para el vendedor en campo, instalable como PWA y con soporte offline.

---

## 2. Stack tecnológico

### Frontend

| Tecnología | Uso |
|---|---|
| **React 18** + **TypeScript** | Framework de UI |
| **Vite 5** | Bundler / dev server (SWC para JSX) |
| **Tailwind CSS 3** + **shadcn/ui** (Radix UI) | Estilos y componentes |
| **React Router 6** | Enrutamiento SPA |
| **TanStack React Query 5** | Caché de datos del servidor / estado asíncrono |
| **Zustand 5** | Estado global ligero (sesión de ruta, carrito) |
| **React Hook Form** + **Zod** | Formularios y validación |
| **Dexie 4** | IndexedDB (almacenamiento offline) |
| **vite-plugin-pwa** (Workbox) | Service worker / PWA |
| **Leaflet** + **@react-google-maps/api** | Mapas |
| **Recharts** | Gráficas |
| **jsPDF** / **xlsx** | Exportación a PDF y Excel |
| **@zxing** / **html5-qrcode** | Lectura de códigos de barras / QR |

### Backend — Supabase

| Servicio | Uso |
|---|---|
| **PostgreSQL** | Base de datos principal (multi-tenant, con RLS) |
| **Auth** | Autenticación de usuarios |
| **Edge Functions** (Deno) | Lógica de servidor / integraciones externas |
| **Storage** | Archivos (logos, fotos, PDF/XML de CFDI, comprobantes) |
| **Realtime** | Actualizaciones en vivo (ubicación de vendedores, monitor de rutas) |

### Integraciones externas

- **Stripe** — cobro de suscripciones SaaS.
- **OpenPay** — pasarela de pago alternativa (tarjeta, OXXO, SPEI).
- **Facturama** — timbrado de CFDI (factura electrónica México).
- **Google Maps / Routes API** — mapas y optimización de rutas.
- **WhatsApp** (proxy externo tipo Evolution/WHATSAPI) — mensajería.
- **AI Gateway (visión)** — extracción de datos de la Constancia de Situación Fiscal (CSF).

---

## 3. Requisitos e instalación

### Requisitos

- **Node.js 20+**
- **npm 10+**
- Cuenta y proyecto de **Supabase**
- (Opcional, para edge functions) **Supabase CLI** y **Deno**

### Instalación local

```bash
git clone <REPO_URL>
cd rutapp
npm install
cp .env.example .env   # y completar los valores
npm run dev
```

El servidor de desarrollo arranca en **http://localhost:8080** (puerto definido en `vite.config.ts`).

---

## 4. Variables de entorno

### Frontend (`.env` en la raíz)

El frontend solo necesita variables con prefijo `VITE_` (se inyectan en el build, **son públicas**):

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
VITE_SUPABASE_PROJECT_ID=<project id>
```

> El cliente de Supabase se inicializa en [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts) con `persistSession` y `autoRefreshToken` activados, usando `localStorage`.

### Backend (secretos de Edge Functions)

Las edge functions corren en Supabase y leen sus secretos del entorno de Supabase (`supabase secrets set ...`), **no** del `.env` del frontend. Secretos usados según la función:

| Secreto | Usado por |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Casi todas las funciones |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Funciones de billing / Stripe |
| `FACTURAMA_USERNAME`, `FACTURAMA_PASSWORD` | `facturama` |
| `OPENPAY_MERCHANT_ID`, `OPENPAY_PRIVATE_KEY`, `OPENPAY_PUBLIC_KEY` | `openpay`, `openpay-public` |
| `GOOGLE_MAPS_API_KEY`, `GOOGLE_ROUTES_API_KEY` | `get-maps-key`, `optimize-route` |
| `WHATSAPP_OTP_TOKEN` | `send-otp`, `wa-campaign` |
| `AI_API_KEY`, `AI_GATEWAY_URL` | `parse-csf` |

> La mensajería WhatsApp por empresa (`whatsapp-sender`) no usa secretos: lee credenciales de la tabla `whatsapp_config`.

---

## 5. Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (puerto 8080) |
| `npm run build` | Build de producción |
| `npm run build:dev` | Build en modo desarrollo |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run lint` | ESLint |
| `npm run test` | Pruebas unitarias (Vitest, una pasada) |
| `npm run test:watch` | Vitest en modo watch |
| `npm run test:e2e` | Pruebas end-to-end (Playwright) |
| `npm run test:all` | Unitarias + e2e |

> **Auto-bump de versión:** en cada `npm run build` de producción, `vite.config.ts` incrementa automáticamente el *patch* en `src/version.ts` (`APP_VERSION`, `APP_BUILD_DATE`). En `dev` no se modifica.

---

## 6. Estructura del proyecto

```txt
rutapp/
├── public/                    Estáticos (íconos PWA, robots.txt)
├── src/
│   ├── assets/                Imágenes (landing, etc.)
│   ├── components/            Componentes reutilizables
│   │   ├── ui/                Primitivas shadcn/ui
│   │   ├── admin/             Paneles de super-administrador
│   │   ├── facturacion/       Componentes de CFDI
│   │   ├── maps/              Componentes de mapas
│   │   ├── notifications/     Banners / modales de notificación
│   │   ├── pos/               Punto de venta (turnos de caja)
│   │   ├── reportes/          Constructores de reportes
│   │   ├── conteos/ auditorias/ comisiones/ producto/
│   ├── contexts/              React Context (AuthContext)
│   ├── hooks/                 Custom hooks (datos, UI, offline)
│   ├── integrations/supabase/ Cliente Supabase + tipos generados
│   ├── lib/                   Utilidades (offline, PDF, precios, impresión…)
│   ├── pages/                 Páginas (una por ruta)
│   │   ├── ruta/              Páginas de la app móvil de ruta
│   │   ├── logistica/         Páginas de logística
│   │   ├── VentaForm/ ProductoForm/ CompraForm/
│   ├── stores/                Stores de Zustand (rutaStore)
│   ├── App.tsx                Providers + definición de rutas
│   ├── main.tsx               Punto de entrada
│   └── version.ts             Versión de la app (auto-generada)
├── supabase/
│   ├── functions/             Edge Functions (Deno)
│   ├── migrations/            Migraciones SQL (esquema de la BD)
│   └── config.toml            Config de funciones (verify_jwt)
├── vite.config.ts             Config de Vite + PWA
└── components.json            Config de shadcn/ui
```

Propósito de cada carpeta de `src/`:

- **`components/`** — componentes de UI reutilizables. `components/ui/` son las primitivas de shadcn/ui; el resto son componentes de negocio.
- **`pages/`** — un componente por ruta. `pages/ruta/` contiene la app móvil del vendedor.
- **`hooks/`** — hooks de acceso a datos (envuelven React Query), de UI y de utilidades.
- **`lib/`** — lógica sin React: capa offline, generación de PDF/tickets, cálculo de precios e impuestos, impresión por Bluetooth/ESC-POS, etc.
- **`contexts/`** — contexto global de autenticación.
- **`stores/`** — estado global con Zustand (sesión y carrito de la ruta móvil).
- **`integrations/supabase/`** — cliente de Supabase y `types.ts` (tipos TypeScript del esquema, generados por la CLI de Supabase).

> Alias de importación: `@/` apunta a `src/` (configurado en `tsconfig.json` y `vite.config.ts`). Ejemplo: `import { supabase } from "@/integrations/supabase/client"`.

---

## 7. Arquitectura general

RutApp es una **SPA** (single-page application) que habla directamente con Supabase.

```
┌─────────────────────────────────────────────┐
│            Navegador / PWA                   │
│  React SPA  ─  React Query  ─  Zustand        │
│       │                  │                   │
│       │            IndexedDB (Dexie)          │  ← caché offline
│       │                  │                   │
└───────┼──────────────────┼───────────────────┘
        │                  │
        │ supabase-js       │ cola de sincronización
        ▼                  ▼
┌─────────────────────────────────────────────┐
│                  Supabase                    │
│  PostgreSQL (RLS)  ·  Auth  ·  Storage        │
│  Realtime  ·  Edge Functions (Deno)           │
└───────────────────────┬───────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
      Stripe         Facturama      Google Maps
      OpenPay        WhatsApp       AI Gateway
```

La lógica de negocio se reparte en cuatro capas:

1. **Frontend React** — UI, validación, orquestación, cálculos de presentación.
2. **PostgreSQL** — además de almacenar datos: funciones RPC para operaciones transaccionales críticas (recepción de compras, traspasos, cierre de auditorías, folios, costeo) y **Row Level Security (RLS)** para aislar empresas.
3. **Edge Functions** — operaciones que requieren secretos o servicios externos (Stripe, Facturama, WhatsApp, optimización de rutas).
4. **Capa offline local** — IndexedDB + cola de sincronización para que la app de ruta funcione sin conexión.

### Estado y datos en el frontend

- **React Query** es la fuente de verdad para datos del servidor. Configuración global (en [src/App.tsx](src/App.tsx)): `staleTime` 30 s, `gcTime` 10 min, `refetchOnWindowFocus` desactivado, `retry` 1. Los errores de mutación se envían a un manejador global.
- **Zustand** ([src/stores/rutaStore.ts](src/stores/rutaStore.ts)) guarda el estado de la sesión de ruta: vendedor activo, cliente activo, carrito y contadores de sincronización pendiente.
- Los hooks de `src/hooks/` (p. ej. `useClientes`, `useVentas`, `useEntregas`) envuelven las consultas/mutaciones de React Query por dominio.

---

## 8. Autenticación

Implementada con **Supabase Auth** y centralizada en [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx).

### Conceptos

- **`user`** — usuario de Supabase Auth (tabla `auth.users`, gestionada por Supabase).
- **`profile`** — fila en la tabla `profiles`, vincula al `user` con su `empresa_id`, `almacen_id`, nombre, teléfono, avatar y PIN.
- **`empresa`** — la empresa (tenant) a la que pertenece el usuario.

### Flujo

1. Al montar, el `AuthContext` se suscribe a `supabase.auth.onAuthStateChange` y obtiene la sesión actual.
2. Con la sesión, carga el `profile` desde la tabla `profiles` (o, sin conexión, desde la caché de IndexedDB).
3. Carga la `empresa` usando `profile.empresa_id` y fija la zona horaria global desde `empresa.zona_horaria`.
4. Cachea `profile` y `empresa` en IndexedDB para el modo offline.
5. La sesión (tokens) la administra el cliente de Supabase; se renueva sola.

### Casos especiales

- **`must_change_password`** — si el perfil tiene este flag, la app fuerza el cambio de contraseña antes de continuar (`ForceChangePasswordPage`).
- **Super-admin override** — un super-administrador puede invocar `setOverrideEmpresaId(empresaId)` para visualizar la operación de otra empresa sin iniciar sesión como ella (útil para soporte).
- **OTP por WhatsApp** — verificación de código de 6 dígitos vía la edge function `send-otp` (2FA).
- **PIN de administrador** — algunas acciones sensibles piden un PIN (`profiles.pin_code`, validado con la RPC `verify_admin_pin`).

---

## 9. Roles y permisos

Sistema **RBAC** propio (no usa los roles de Postgres). El control de acceso vive en [src/hooks/usePermisos.ts](src/hooks/usePermisos.ts) y [src/hooks/useRoles.ts](src/hooks/useRoles.ts).

### Tablas involucradas

- **`roles`** — define un rol por empresa. Flags clave:
  - `es_sistema` — rol del sistema, no se puede eliminar.
  - `acceso_ruta_movil` — puede entrar a la app de ruta.
  - `solo_movil` — **solo** puede usar la app de ruta (sin escritorio).
  - `activo` — baja lógica.
- **`role_permisos`** — permisos por rol: `(modulo, accion, permitido)`.
- **`user_roles`** — asignación de roles a usuarios.

### Módulos y acciones

Los permisos se expresan como `modulo.submódulo` + `accion`. Hay ~50 módulos agrupados (dashboard, ventas, clientes, logística, catálogo, almacén, finanzas, reportes, facturación, configuración, control, pos…).

Acciones estándar: `ver`, `crear`, `editar`, `eliminar`, `ver_todos`.

### Lógica de `hasPermiso(modulo, accion)`

1. El **dueño de la empresa** (`empresa.owner_user_id === user.id`) tiene acceso total (salvo la restricción `solo_movil`).
2. Para `solo_movil`, la fuente de verdad es la columna `roles.solo_movil`.
3. Usuario sin rol asignado → acceso completo por defecto.
4. En otro caso → se busca la coincidencia exacta en `role_permisos`.

### Guards de ruta

- `<PermissionGuard>` envuelve las rutas de escritorio y bloquea según `hasPermiso(modulo, 'ver')`.
- Usuarios **`solo_movil`** quedan confinados a `/ruta/*`.
- Usuarios **solo POS** quedan confinados a `/pos`.
- Super-administradores (tabla `super_admins`) saltan todos los bloqueos.

---

## 10. Base de datos

La base de datos es **PostgreSQL en Supabase**. El esquema vive en `supabase/migrations/` (~250 migraciones SQL incrementales con marca de tiempo) y los tipos TypeScript correspondientes en [src/integrations/supabase/types.ts](src/integrations/supabase/types.ts).

### Principios generales

- **Multi-tenant:** casi todas las tablas operativas tienen una columna **`empresa_id`** que las aísla por empresa. Hay **Row Level Security (RLS)** activo: cada usuario solo ve datos de su `empresa_id`.
- **Claves primarias:** `id` de tipo `uuid`, generado por la base de datos.
- **Fechas:** `created_at` / `updated_at` de tipo `timestamptz`, con valor por defecto `now()`.
- **Líneas/detalle:** los documentos (ventas, compras, traspasos, etc.) usan el patrón cabecera + líneas (`venta` ↔ `venta_lineas`).
- **Folios:** se generan con las RPC `generate_folio` / `next_folio`.

### Notación de esta sección

Para cada tabla se indica su propósito y sus columnas principales. `→ tabla` indica una llave foránea. Se omiten `id`, `created_at` y `updated_at` salvo cuando aportan información.

---

### 10.1 Núcleo multi-tenant y usuarios

#### `empresas`
La entidad raíz del multi-tenant: una fila por empresa cliente.
`nombre`, `razon_social`, `rfc`, `regimen_fiscal`, `direccion`, `colonia`, `ciudad`, `estado`, `cp`, `telefono`, `email`, `logo_url`, `moneda`, `zona_horaria`, `owner_user_id` (usuario dueño), `clientes_visibilidad` (alcance de visibilidad de clientes), `notas_ticket`, `ticket_campos` (jsonb), `ticket_ancho`, `pos_turnos_habilitado`, `requiere_jornada_ruta`, `requiere_jornada_desde`, `jornada_permite_sin_vehiculo`.

#### `profiles`
Perfil de cada usuario; vincula `auth.users` con su empresa.
`user_id` (→ auth.users), `empresa_id` (→ empresas), `almacen_id` (→ almacenes), `nombre`, `telefono`, `avatar_url`, `estado`, `pin_code`, `must_change_password`.

#### `roles`
Roles por empresa. `nombre`, `descripcion`, `empresa_id`, `es_sistema`, `activo`, `acceso_ruta_movil`, `solo_movil`.

#### `role_permisos`
Permisos de un rol. `role_id` (→ roles), `modulo`, `accion`, `permitido`.

#### `user_roles`
Asignación de roles a usuarios. `user_id`, `role_id` (→ roles).

#### `super_admins`
Administradores de la plataforma (acceso global). `user_id`, `email`.

#### `vendedores`
Catálogo simple de vendedores por empresa (`nombre`). Convive con `profiles`; usado sobre todo en datos/operaciones donde el vendedor no es necesariamente un usuario con login.

#### `cobradores`
Catálogo de cobradores. `nombre`, `empresa_id`, `activo`.

---

### 10.2 Catálogo / datos maestros

#### `productos`
Catálogo de productos. Es una de las tablas más amplias.
- **Identificación:** `codigo`, `clave_alterna`, `nombre`, `nombre_venta`, `nombre_compra`, `nombre_ticket`, `notas`, `imagen_url`, `status` (enum `status_producto`).
- **Clasificación:** `clasificacion_id` (→ clasificaciones), `marca_id` (→ marcas), `lista_id` (→ listas).
- **Inventario:** `cantidad`, `min`, `max`, `almacenes` (text[]), `se_puede_inventariar`, `vender_sin_stock`, `manejar_lotes`, `es_combo`, `es_granel`, `unidad_granel`.
- **Unidades:** `unidad_venta_id`, `unidad_compra_id` (→ unidades), `factor_conversion`, `udem_sat_id` (→ unidades_sat).
- **Costos y precios:** `costo`, `calculo_costo` (enum `calculo_costo`), `costo_incluye_impuestos`, `precio_principal`, `precio_sugerido_publico`, `usa_listas_precio`, `permitir_descuento`, `monto_maximo`.
- **Impuestos:** `tiene_iva`, `iva_pct`, `tasa_iva_id`; `tiene_ieps`, `ieps_pct`, `ieps_tipo`, `tasa_ieps_id`; `codigo_sat`.
- **Comisiones:** `tiene_comision`, `tipo_comision` (enum), `pct_comision`.
- **Otros:** `se_puede_vender`, `se_puede_comprar`, `proveedor_id`, `tarifa_id`.

#### `combos`
Los *combos* se modelan como productos que agrupan varios componentes (otros productos). Implementación y reglas principales:

- Almacenamiento: un combo es una fila en `productos` con `es_combo = true`. Las líneas de componente se normalizan en la tabla `combo_lineas` (ver migración `supabase/migrations/20260526110000_create_combo_lineas.sql`). Las columnas principales de `combo_lineas` son: `id`, `empresa_id`, `combo_id` (→ `productos.id`), `componente_id` (→ `productos.id`), `cantidad`, `orden`, `notas`, `created_at`, `updated_at`.
- Semántica: el combo tiene sus propios campos de precio (`precio_principal`, `precio_sugerido_publico`) sobre la fila de `productos`. El precio sugerido se calcula a partir de los precios unitarios de los componentes, pero el `precio_principal` es editable en el combo.
- Paridad de precios: los combos soportan `usa_listas_precio`, `tarifa_id` y `lista_id` igual que los productos individuales; el motor de precios aplica las mismas reglas/funciones de tarifa/lista.
- Flujo de guardado: la UI realiza un único guardado — primero inserta/actualiza la fila en `productos` y luego reemplaza las filas en `combo_lineas` (operación delete + insert desde el frontend). Esto garantiza consistencia y evita estados intermedios.
- Frontend: el editor de combos se implementó como un modal con UX de "staged list" (`src/components/producto/ComboLineModal.tsx`). La búsqueda de componentes es server-side y debounced para catálogos grandes; al añadir un componente se guarda una instantánea mínima de precio para evitar valores 0 mientras se carga metadata.
- Hooks y tipos: se añadieron/ajustaron hooks y tipos relevantes: `useComboLineas`, `useSaveProducto` (usado para combos), y la interfaz `ComboLinea` en `src/types/index.ts`. Se agregó el campo `usa_listas_precio?: boolean` al tipo `Producto`.

#### `producto_lotes`
Lotes de producto (caducidades). `producto_id`, `almacen_id`, `lote`, `cantidad`, `fecha_caducidad`, `fecha_produccion`.

#### `producto_proveedores`
Relación producto ↔ proveedor. `producto_id`, `proveedor_id`, `precio_compra`, `es_principal`, `tiempo_entrega_dias`.

#### `producto_tarifas`
Relación producto ↔ tarifa. `producto_id`, `tarifa_id`.

#### `clasificaciones`
Categorías de producto. `nombre`, `empresa_id`, `activo`.

#### `marcas`
Marcas. `nombre`, `empresa_id`, `activo`.

#### `unidades`
Unidades de medida de la empresa. `nombre`, `abreviatura`, `empresa_id`, `activo`.

#### `unidades_sat`
Catálogo SAT de unidades de medida (global). `clave`, `nombre`.

#### `zonas`
Zonas geográficas/comerciales. `nombre`, `empresa_id`, `activo`.

#### `listas`
Listas genéricas de clasificación de productos/clientes. `nombre`, `empresa_id`, `activo`.

#### `proveedores`
Proveedores. `nombre`, `razon_social`, `rfc`, `contacto`, `telefono`, `email`, `sitio_web`, dirección (`direccion`, `colonia`, `ciudad`, `estado`, `cp`), datos bancarios (`banco`, `cuenta_banco`, `clabe`), `condicion_pago`, `dias_credito`, `limite_credito`, `tiempo_entrega_dias`, `status`.

#### `clientes`
Clientes. Tabla central de la operación comercial.
- **Datos generales:** `nombre`, `codigo`, `contacto`, `telefono`, `email`, dirección (`direccion`, `colonia`, `cp`), `gps_lat`, `gps_lng`, `foto_url`, `foto_fachada_url`, `notas`, `status` (enum `status_cliente`), `fecha_alta`.
- **Asignación / ruta:** `vendedor_id`, `cobrador_id`, `zona_id`, `dia_visita` (text[]), `frecuencia` (enum `frecuencia_visita`), `orden`.
- **Precios:** `lista_id`, `lista_precio_id` (→ lista_precios), `tarifa_id` (→ tarifas).
- **Crédito:** `credito`, `dias_credito`, `limite_credito`.
- **Fiscal:** `rfc`, `regimen_fiscal`, `uso_cfdi`, `requiere_factura`, y los campos `facturama_*` (datos del receptor sincronizados con Facturama).

#### `cliente_orden_ruta`
Orden de visita de los clientes en la ruta. `cliente_id`, `vendedor_id`, `empresa_id`, `dia`, `orden`, `origin_lat`, `origin_lng`, `origin_label`.

#### `cliente_pedido_sugerido`
Pedido sugerido por cliente (productos habituales). `cliente_id`, `producto_id`, `cantidad`.

#### `visitas`
Registro de visitas a clientes. `cliente_id`, `user_id`, `venta_id`, `fecha`, `tipo`, `motivo`, `notas`, `gps_lat`, `gps_lng`.

---

### 10.3 Precios, tarifas y promociones

#### `tarifas`
Esquemas de precios. `nombre`, `descripcion`, `tipo` (enum `tipo_tarifa`: general / por_cliente / por_ruta), `moneda`, `activa`, vigencia (`vigencia_inicio`, `vigencia_fin`).

#### `tarifa_lineas`
Reglas de una tarifa. `tarifa_id`, `aplica_a` (enum `aplica_a_tarifa`: todos/categoria/producto), `producto_ids` (uuid[]), `clasificacion_ids` (uuid[]), `tipo_calculo` (enum `tipo_calculo_tarifa`: margen_costo / descuento_precio / precio_fijo), `base_precio`, `precio`, `margen_pct`, `descuento_pct`, `descuento_max`, `precio_minimo`, `comision_pct`, `redondeo`, `lista_precio_id`.

#### `lista_precios`
Listas de precios (incluye catálogo público compartible). `nombre`, `tarifa_id`, `es_principal`, `activa`, `share_token` (token público), `share_activo`.

#### `lista_precios_lineas`
Precio por producto dentro de una lista. `lista_precio_id`, `producto_id`, `precio`.

#### `promociones`
Promociones comerciales. `nombre`, `descripcion`, `tipo` (enum `tipo_promocion`), `aplica_a` (enum `aplica_promocion`), `valor`, `cantidad_minima`, `cantidad_gratis`, `producto_gratis_id`, segmentación por `producto_ids` / `clasificacion_ids` / `cliente_ids` / `zona_ids` (uuid[]), `dias_semana`, `prioridad`, `acumulable`, `activa`, vigencia.

#### `promocion_aplicada`
Promociones aplicadas a una venta. `promocion_id`, `venta_id`, `venta_linea_id`, `descuento_aplicado`, `descripcion`.

#### Tasas de impuestos
- **`tasas_iva`** — tasas de IVA por empresa. `nombre`, `porcentaje`.
- **`tasas_ieps`** — tasas de IEPS. `nombre`, `porcentaje`.
- **`tasas_iva_ret`** — retenciones de IVA. `nombre`, `porcentaje`.
- **`tasas_isr_ret`** — retenciones de ISR. `nombre`, `porcentaje`.

---

### 10.4 Ventas

#### `ventas`
Cabecera de venta / pedido.
- **Datos:** `folio`, `fecha`, `cliente_id`, `vendedor_id`, `almacen_id`, `tarifa_id`, `concepto`, `notas`, `origen`.
- **Tipo y estado:** `tipo` (enum `tipo_venta`: pedido / venta_directa / saldo_inicial), `status` (enum `status_venta`: borrador / confirmado / entregado / facturado / cancelado), `condicion_pago` (enum `condicion_pago`), `entrega_inmediata`, `es_saldo_inicial`, `pedido_origen_id` (autorreferencia).
- **Importes:** `subtotal`, `iva_total`, `ieps_total`, `descuento_total`, `descuento_extra`, `descuento_extra_tipo`, `descuento_extra_motivo`, `total`, `saldo_pendiente`.
- **Fechas/fiscal:** `fecha_entrega`, `fecha_vencimiento`, `requiere_factura`.
- **POS:** `turno_id` (→ caja_turnos).

#### `venta_lineas`
Líneas de una venta. `venta_id`, `producto_id`, `unidad_id`, `descripcion`, `cantidad`, `precio_unitario`, `precio_manual`, `descuento_pct`, `iva_pct`/`iva_monto`, `ieps_pct`/`ieps_monto`, `subtotal`, `total`, `lista_precio_id`, `facturado`, `factura_cfdi_id`.

#### `venta_historial`
Bitácora de cambios de una venta. `venta_id`, `accion`, `user_id`, `user_nombre`, `detalles` (jsonb).

#### `venta_comisiones`
Comisión generada por cada línea de venta. `venta_id`, `venta_linea_id`, `producto_id`, `vendedor_id`, `monto_venta`, `comision_pct`, `comision_monto`, `fecha_venta`, `pagada`, `pago_comision_id`.

#### `pago_comisiones`
Corte/pago de comisiones a un vendedor. `vendedor_id`, `fecha_corte`, `total_comisiones`, `notas`.

---

### 10.5 Cobranza

#### `cobros`
Pagos recibidos de clientes. `cliente_id`, `fecha`, `monto`, `metodo_pago`, `referencia`, `notas`, `status`, `user_id`.

#### `cobro_aplicaciones`
Aplicación de un cobro a ventas específicas. `cobro_id`, `venta_id`, `monto_aplicado`.

---

### 10.6 Almacenes e inventario

#### `almacenes`
Almacenes de la empresa. `nombre`, `tipo`, `direccion`, `gps_lat`, `gps_lng`, `activo`.

#### `stock_almacen`
Existencia de cada producto por almacén. `almacen_id`, `producto_id`, `cantidad`.

#### `stock_camion`
Existencia que lleva un vendedor en su camión. `vendedor_id`, `producto_id`, `fecha`, `cantidad_inicial`, `cantidad_actual`.

#### `movimientos_inventario`
Kardex: todo movimiento de inventario. `producto_id`, `tipo` (enum `tipo_movimiento`: entrada/salida/transferencia), `cantidad`, `almacen_origen_id`, `almacen_destino_id`, `vendedor_destino_id`, `unidad_id`, `fecha`, `referencia_tipo` + `referencia_id` (documento origen), `user_id`, `notas`.

#### `ajustes_inventario`
Ajustes manuales de stock. `producto_id`, `almacen_id`, `cantidad_anterior`, `cantidad_nueva`, `diferencia`, `motivo`, `batch_id`, `fecha`, `user_id`.

#### `traspasos` / `traspaso_lineas`
Traspasos de mercancía. Cabecera: `folio`, `tipo` (enum `tipo_traspaso`: almacen_almacen / almacen_ruta / ruta_almacen), `status` (enum `status_traspaso`: borrador/confirmado/cancelado), `almacen_origen_id`, `almacen_destino_id`, `vendedor_origen_id`, `vendedor_destino_id`, `fecha`, `notas`. Líneas: `traspaso_id`, `producto_id`, `cantidad`.

#### `conteos_fisicos` / `conteo_lineas` / `conteo_entradas`
Conteos físicos de inventario.
- **`conteos_fisicos`** — cabecera: `folio`, `almacen_id`, `clasificacion_id`, `filtro_stock`, `status`, `asignado_a`, `total_productos`, `productos_contados`, `diferencia_total_valor`, `abierto_en`, `cerrado_en`.
- **`conteo_lineas`** — por producto: `conteo_id`, `producto_id`, `stock_inicial`, `stock_esperado`, `cantidad_contada`, `diferencia`, `diferencia_valor`, `costo_unitario`, `status`, `ajuste_aplicado`.
- **`conteo_entradas`** — cada captura/escaneo dentro de una línea: `conteo_linea_id`, `cantidad`, `codigo_escaneado`, `creado_por`.

#### `auditorias` / `auditoria_lineas` / `auditoria_entradas` / `auditoria_escaneos`
Auditorías de inventario (más estrictas que un conteo; con flujo de aprobación).
- **`auditorias`** — cabecera: `nombre`, `almacen_id`, `filtro_tipo`/`filtro_valor`, `status` (enum `status_auditoria`), `cerrada_por`/`cerrada_at`, `aprobado_por`/`fecha_aprobacion`, `notas`, `notas_supervisor`.
- **`auditoria_lineas`** — por producto: `auditoria_id`, `producto_id`, `cantidad_esperada`, `cantidad_real`, `diferencia`, `cerrada`, `ajustado`, `notas`.
- **`auditoria_entradas`** — capturas por línea: `auditoria_linea_id`, `cantidad`, `user_id`.
- **`auditoria_escaneos`** — escaneos de código: `auditoria_id`, `linea_id`, `cantidad`, `escaneado_por`, `escaneado_at`.

---

### 10.7 Compras

#### `compras` / `compra_lineas`
Órdenes de compra a proveedores. Cabecera: `folio`, `proveedor_id`, `almacen_id`, `fecha`, `condicion_pago`, `dias_credito`, `status`, `subtotal`, `iva_total`, `total`, `saldo_pendiente`, `notas`, `notas_pago`. Líneas: `compra_id`, `producto_id`, `cantidad`, `precio_unitario`, `subtotal`, `total`.

#### `pago_compras`
Pagos a proveedores. `compra_id`, `proveedor_id`, `fecha`, `monto`, `metodo_pago`, `referencia`, `notas`, `user_id`.

---

### 10.8 Logística y rutas

#### `cargas` / `carga_lineas` / `carga_pedidos`
Carga de mercancía a un vendedor para su ruta.
- **`cargas`** — cabecera: `fecha`, `vendedor_id`, `repartidor_id`, `almacen_id`, `almacen_destino_id`, `status` (enum `status_carga`), `notas`.
- **`carga_lineas`** — productos cargados: `carga_id`, `producto_id`, `cantidad_cargada`, `cantidad_vendida`, `cantidad_devuelta`.
- **`carga_pedidos`** — pedidos asociados a la carga: `carga_id`, `venta_id`.

#### `entregas` / `entrega_lineas`
Entregas a clientes.
- **`entregas`** — cabecera: `folio`, `cliente_id`, `vendedor_id`, `vendedor_ruta_id`, `almacen_id`, `pedido_id` (→ ventas), `status` (enum `status_entrega`), `orden_entrega`, `fecha`, `fecha_asignacion`, `fecha_carga`, `fecha_entrega`, `validado_por`/`validado_at`, `notas`.
- **`entrega_lineas`** — `entrega_id`, `producto_id`, `unidad_id`, `almacen_origen_id`, `cantidad_pedida`, `cantidad_entregada`, `hecho`.

#### `descarga_ruta` / `descarga_ruta_lineas`
Descarga / liquidación del vendedor al final de la ruta.
- **`descarga_ruta`** — `vendedor_id`, `carga_id`, `fecha`, `fecha_inicio`, `fecha_fin`, `efectivo_esperado`, `efectivo_entregado`, `diferencia_efectivo`, `status` (enum `status_descarga`), `aprobado_por`, `notas`, `notas_supervisor`.
- **`descarga_ruta_lineas`** — `descarga_id`, `producto_id`, `cantidad_esperada`, `cantidad_real`, `diferencia`, `motivo` (enum `motivo_diferencia`), `notas`.

#### `devoluciones` / `devolucion_lineas`
Devoluciones de mercancía.
- **`devoluciones`** — `tipo` (enum `tipo_devolucion`: almacen/tienda), `cliente_id`, `vendedor_id`, `carga_id`, `venta_id`, `fecha`, `notas`.
- **`devolucion_lineas`** — `devolucion_id`, `producto_id`, `cantidad`, `motivo` (enum `motivo_devolucion`), `accion` (enum `accion_devolucion`), `monto_credito`, `reemplazo_producto_id`, `notas`.

#### `ruta_sesiones`
Jornada/sesión de ruta de un vendedor. `vendedor_id`, `vehiculo_id`, `carga_id`, `fecha`, `inicio_at`, `fin_at`, `km_inicio`, `km_fin`, `km_recorridos`, ubicaciones (`lat_inicio`/`lng_inicio`, `lat_fin`/`lng_fin`), `foto_inicio_url`, `foto_fin_url`, `notas_inicio`, `notas_fin`, `status`.

#### `vehiculos`
Vehículos de la empresa. `alias`, `tipo`, `marca`, `modelo`, `anio`, `placa`, `capacidad_kg`, `km_actual`, `foto_url`, `status`, `vendedor_default_id`, `notas`.

#### `vendedor_ubicaciones`
Última ubicación conocida de cada vendedor (1 fila por usuario). `user_id`, `lat`, `lng`, `accuracy`, `heading`, `speed`, `battery_level`.

#### `vendedor_ubicaciones_historial`
Histórico de ubicaciones (recorrido). `user_id`, `lat`, `lng`, `accuracy`, `battery_level`, `recorded_at`.

#### `gastos`
Gastos registrados en ruta o en oficina. `concepto`, `monto`, `fecha`, `vendedor_id`, `user_id`, `foto_url`, `notas`.

#### `optimizacion_rutas_log`
Bitácora de uso de la optimización de rutas (para la cuota mensual). `empresa_id`, `user_id`, `clientes_count`, `dia_filtro`.

#### `optimizacion_recargas`
Compra de créditos extra de optimización de rutas. `empresa_id`, `user_id`, `cantidad_creditos`, `creditos_consumidos`, `monto_centavos`, `moneda`, `status`, `stripe_session_id`, `stripe_payment_intent_id`, `paid_at`.

---

### 10.9 Punto de venta (POS)

#### `caja_turnos`
Turnos de caja. `caja_nombre`, `cajero_id`, `status`, `abierto_at`, `cerrado_at`, `cerrado_por`, `fondo_inicial`, `arqueo_denominaciones` (jsonb), totales esperados vs. contados por método de pago (`total_efectivo_*`, `total_tarjeta_*`, `total_transferencia_*`, `total_otros_*`), `diferencia`, `notas_apertura`, `notas_cierre`.

#### `caja_movimientos`
Movimientos de efectivo dentro de un turno (entradas/salidas). `turno_id`, `tipo`, `monto`, `motivo`, `user_id`.

---

### 10.10 Facturación CFDI (factura electrónica)

#### `cfdis`
Comprobantes fiscales digitales. `venta_id`, `cfdi_type`, `serie`, `folio`, `folio_fiscal`, `status`, datos del receptor (`receiver_rfc`, `receiver_name`, `receiver_fiscal_regime`, `receiver_cfdi_use`, `receiver_tax_zip_code`), `payment_form`, `payment_method`, `currency`, importes (`subtotal`, `iva_total`, `ieps_total`, `retenciones_total`, `total`), datos de timbrado (`facturama_id`, `fecha_timbrado`, `sello_cfdi`, `sello_sat`, `no_certificado_emisor`, `no_certificado_sat`, `cadena_original`), `pdf_url`, `xml_url`, `cancel_status`, `cancel_date`, `error_detalle`.

#### `cfdi_lineas`
Conceptos del CFDI. `cfdi_id`, `venta_linea_id`, `producto_id`, `descripcion`, `cantidad`, `precio_unitario`, `product_code` (clave SAT), `unit_code`/`unit_name`, `iva_pct`/`iva_monto`, `ieps_pct`/`ieps_monto`, `subtotal`, `total`.

#### `timbres_saldo`
Saldo de timbres (folios fiscales) por empresa. `empresa_id`, `saldo`.

#### `timbres_movimientos`
Movimientos del saldo de timbres. `tipo`, `cantidad`, `saldo_anterior`, `saldo_nuevo`, `referencia_id`, `user_id`, `notas`.

#### Catálogos SAT (globales, sin `empresa_id`)
- **`cat_forma_pago`** — formas de pago SAT.
- **`cat_metodo_pago`** — métodos de pago SAT (PUE/PPD).
- **`cat_moneda`** — monedas.
- **`cat_regimen_fiscal`** — regímenes fiscales (con flags `persona_fisica`/`persona_moral`).
- **`cat_tipo_comprobante`** — tipos de comprobante.
- **`cat_uso_cfdi`** — usos de CFDI (con flags `persona_fisica`/`persona_moral`).

Cada uno tiene `clave`, `descripcion`, `activo`.

---

### 10.11 Suscripciones y billing (operación SaaS)

#### `subscriptions`
Suscripción de cada empresa a RutApp. `empresa_id`, `plan_id` (→ subscription_plans), `status`, `max_usuarios`, `descuento_porcentaje`, `es_manual`, `acceso_bloqueado`, `fecha_vencimiento`, `trial_ends_at`, `current_period_start`/`current_period_end`, `stripe_customer_id`, `stripe_subscription_id`, `ultimo_checkout_session_id`.

#### `subscription_plans`
Planes de suscripción vigentes. `nombre`, `periodo`, `meses`, `precio_por_usuario`, `descuento_pct`, `stripe_price_id`, `stripe_product_id`, `activo`.

#### `planes`
Tabla de planes heredada (legacy). `nombre`, `descripcion`, `precio_base_mes`, `precio_usuario_extra`, `usuarios_incluidos`, `stripe_price_id`, `stripe_product_id`, `activo`.

#### `facturas`
Facturas de la suscripción SaaS (no confundir con `cfdis`). `empresa_id`, `suscripcion_id`, `numero_factura`, `periodo_inicio`/`periodo_fin`, `num_usuarios`, `precio_unitario`, `subtotal`, `descuento_porcentaje`, `total`, `estado`, `es_prorrateo`, `fecha_emision`, `fecha_vencimiento`, `fecha_pago`, `stripe_invoice_id`, `stripe_payment_intent_id`.

#### `cobro_reintentos`
Programación de reintentos de cobro de una factura SaaS. `factura_id`, `empresa_id`, `intento_num`, `proxima_fecha`, `estado`, `procesado_at`, `stripe_invoice_id`, `ultimo_error`.

#### `cupones` / `cupon_usos`
Cupones de descuento para suscripciones.
- **`cupones`** — `codigo`, `descripcion`, `descuento_pct`, `meses_duracion`, `planes_aplicables`, `uso_maximo`, `uso_por_empresa`, `usos_actuales`, `acumulable`, `activo`, vigencia.
- **`cupon_usos`** — `cupon_id`, `empresa_id`, `subscription_id`, `meses_restantes`, `aplicado_at`.

#### `solicitudes_pago`
Solicitudes de pago manual (transferencia/depósito). `empresa_id`, `tipo`, `concepto`, `monto_centavos`, `metodo`, `cantidad_usuarios`, `cantidad_timbres`, `plan_price_id`, `comprobante_url`, `status`, `aprobado_por`, `fecha_aprobacion`, `notas`, `notas_admin`.

#### `payment_links`
Enlaces de pago de OpenPay enviados al cliente. `empresa_id`, `token`, datos del cliente, datos del plan OpenPay (`openpay_plan_id`, `openpay_customer_id`, `openpay_card_id`, `openpay_subscription_id`), `plan_amount`, `plan_currency`, `status`, `completed_at`.

#### `billing_notifications`
Bitácora de notificaciones de cobro enviadas. `customer_email`, `customer_phone`, `tipo`, `channel`, `status`, `mensaje`, `monto_centavos`, `stripe_invoice_id`, `stripe_invoice_url`, `error_detalle`.

#### `billing_message_templates`
Plantillas de los mensajes de cobro. `tipo`, `emoji`, `encabezado`, `pie_mensaje`, `campos` (jsonb), `activo`.

#### `cancellation_requests`
Solicitudes de cancelación de suscripción. `empresa_id`, `user_id`, `reason`, `reason_detail`, `offered_discount`, `discount_accepted`, `cancelled`.

#### `trial_blacklist`
Lista negra para evitar abuso de pruebas gratuitas. `email`, `telefono`, `empresa_nombre`, `motivo`, `bloqueado_por`.

---

### 10.12 WhatsApp

#### `whatsapp_config`
Configuración de WhatsApp por empresa (1 fila por empresa). `empresa_id`, `api_url`, `api_token`, `instance_name`, `activo`, `enviar_recibo_pago`, `aviso_dia_antes`, `aviso_vencido`.

#### `whatsapp_templates`
Plantillas de mensajes por empresa. `tipo`, `nombre`, `mensaje`, `activo`.

#### `whatsapp_log`
Bitácora de mensajes enviados. `empresa_id`, `telefono`, `tipo`, `mensaje`, `imagen_url`, `referencia_id`, `status`, `error_detalle`.

#### `wa_campaigns` / `wa_campaign_sends` / `wa_optouts`
Campañas masivas de WhatsApp (uso del super-admin).
- **`wa_campaigns`** — `message`, `image_url`, `filters` (text[]), `status`, `total_recipients`, `total_sent`, `total_failed`.
- **`wa_campaign_sends`** — envíos individuales: `campaign_id`, `telefono`, `nombre`, `empresa_nombre`, `status`, `error_detalle`.
- **`wa_optouts`** — bajas de mensajería: `telefono`, `nombre`, `motivo`, `created_by`.

---

### 10.13 Notificaciones y sistema

#### `notifications`
Notificaciones in-app. `title`, `body`, `type` (enum `notification_type`: banner/modal/bubble), `image_url`, `bg_color`, `text_color`, `redirect_type` (enum `notification_redirect_type`), `redirect_url`, `max_views`, `is_active`, `start_date`, `end_date`, `empresa_id` (nulo = global).

#### `notification_views`
Control de vistas por usuario. `notification_id`, `user_id`, `view_count`, `last_seen_at`, `dismissed`.

#### `otp_codes`
Códigos OTP para verificación por WhatsApp. `phone`, `code`, `attempts`, `verified`.

#### `user_favorites`
Accesos directos / favoritos del usuario. `user_id`, `label`, `path`, `icon`, `orden`.

#### `tutorial_videos`
Videos de tutorial. `title`, `description`, `url`, `module`, `sort_order`, `empresa_id` (nulo = global).

#### `maintenance_log`
Bitácora de mantenimiento de la base de datos. `ejecutado_por`, `ejecutado_en`, `duracion_ms`, `tablas_procesadas` (text[]), `notas`.

---

### 10.14 Mapa de relaciones clave

```
empresas ──┬── profiles ── user_roles ── roles ── role_permisos
           ├── clientes ──┬── ventas ──┬── venta_lineas ── productos
           │              │            ├── venta_comisiones ── pago_comisiones
           │              │            ├── cfdis ── cfdi_lineas
           │              │            └── promocion_aplicada ── promociones
           │              ├── cobros ── cobro_aplicaciones ── ventas
           │              └── visitas
           ├── productos ──┬── stock_almacen ── almacenes
           │               ├── producto_lotes / producto_proveedores
           │               └── lista_precios_lineas / tarifa_lineas
           ├── cargas ── carga_lineas / carga_pedidos
           ├── entregas ── entrega_lineas
           ├── traspasos ── traspaso_lineas
           ├── compras ── compra_lineas ── pago_compras
           ├── conteos_fisicos ── conteo_lineas ── conteo_entradas
           ├── auditorias ── auditoria_lineas ── auditoria_entradas / auditoria_escaneos
           └── subscriptions ── facturas ── cobro_reintentos
```

---

### 10.15 Seguridad a nivel de fila (RLS)

Todas las tablas operativas tienen **Row Level Security (RLS)** activado. El aislamiento entre empresas (multi-tenant) **no** se hace solo en el frontend: lo impone PostgreSQL.

> Reconstrucción: las políticas se consolidaron de forma masiva en la migración `20260323182219` (línea base, ~62 tablas) y `20260323182032` (6 tablas core). Lo descrito aquí refleja el estado posterior a esas migraciones más los cambios siguientes.

#### Funciones helper de RLS

Todas son `STABLE` y **`SECURITY DEFINER`** con `search_path = public`:

| Función | Qué devuelve |
|---|---|
| `get_my_empresa_id()` | `empresa_id` del usuario actual (`profiles` por `auth.uid()`) |
| `is_super_admin(p_user_id)` | `true` si el usuario está en la tabla `super_admins` |
| `user_role_empresa_id(p_user_id)` | Igual que `get_my_empresa_id` pero parametrizada (en desuso en RLS) |
| `has_billing_access(p_empresa_id)` | `true` si la suscripción permite acceso (super admin / manual / trial activo / vigente / días de gracia 1–3). **No se usa en ninguna política RLS** — ver nota al final |

#### Patrón A — tablas con columna `empresa_id`

La mayoría de tablas de negocio. Una sola política `FOR ALL` cubre las 4 operaciones:

```sql
USING      (empresa_id = get_my_empresa_id() OR is_super_admin(auth.uid()))
WITH CHECK (empresa_id = get_my_empresa_id() OR is_super_admin(auth.uid()))
```

Es decir: **el usuario solo ve y modifica filas de su propia empresa; el super-admin ve y modifica todo.**

Tablas con Patrón A: `ajustes_inventario`, `almacenes`, `auditorias`, `cancellation_requests`, `cargas`, `cfdis`, `clasificaciones`, `clientes`, `cobradores`, `cobros`, `compras`, `descarga_ruta`, `devoluciones`, `entregas`, `gastos`, `lista_precios`, `listas`, `marcas`, `movimientos_inventario`, `optimizacion_rutas_log`, `pago_comisiones`, `pago_compras`, `producto_lotes`, `productos`, `promociones`, `proveedores`, `roles`, `stock_almacen`, `stock_camion`, `tarifas`, `tasas_ieps`, `tasas_iva`, `traspasos`, `unidades`, `vendedores`, `venta_historial`, `ventas`, `visitas`, `whatsapp_config`, `whatsapp_log`, `whatsapp_templates`, `zonas`, `conteos_fisicos`.

#### Patrón B — tablas hijas sin `empresa_id`

Las tablas de detalle (líneas de documentos) validan la empresa contra su tabla padre:

```sql
USING (is_super_admin(auth.uid()) OR EXISTS (
  SELECT 1 FROM <padre> p WHERE p.id = <tabla>.<fk> AND p.empresa_id = get_my_empresa_id()))
```

| Tabla hija | Tabla padre |
|---|---|
| `auditoria_lineas`, `auditoria_escaneos` | `auditorias` |
| `auditoria_entradas` | `auditoria_lineas` |
| `carga_lineas`, `carga_pedidos` | `cargas` |
| `cfdi_lineas` | `cfdis` |
| `cliente_pedido_sugerido` | `clientes` |
| `cobro_aplicaciones` | `cobros` |
| `compra_lineas` | `compras` |
| `descarga_ruta_lineas` | `descarga_ruta` |
| `devolucion_lineas` | `devoluciones` |
| `entrega_lineas` | `entregas` |
| `lista_precios_lineas` | `lista_precios` |
| `producto_proveedores`, `producto_tarifas` | `productos` |
| `promocion_aplicada`, `venta_comisiones`, `venta_lineas` | `ventas` |
| `role_permisos`, `user_roles` | `roles` |
| `tarifa_lineas` | `tarifas` |
| `traspaso_lineas` | `traspasos` |

#### Excepciones (políticas especiales)

| Tabla | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `empresas` | La propia, o super admin | Solo super admin (no hay política de DELETE) |
| `profiles` | El propio, los de la misma empresa, o super admin | El propio o los de la misma empresa (no hay DELETE) |
| `super_admins` | Solo super admin | Solo super admin |
| `subscriptions` | La de la empresa propia, o super admin | Solo super admin |
| `subscription_plans` | Cualquier autenticado | Solo super admin |
| `cupones` | Cualquier autenticado | Solo super admin |
| `cupon_usos` | Empresa propia o super admin | Empresa propia (INSERT) / super admin |
| `facturas` | Empresa propia, o super admin | Solo super admin |
| `solicitudes_pago` | Empresa propia, o super admin | Empresa propia (INSERT, con `user_id = auth.uid()`) / super admin |
| `timbres_saldo`, `timbres_movimientos` | Empresa propia, o super admin | Solo super admin |
| `notifications` | Empresa propia o globales (`empresa_id IS NULL`) | Admin de empresa / super admin |
| `notification_views` | El propio (`user_id`) | El propio |
| `user_favorites` | El propio (`user_id`) | El propio |
| `vendedor_ubicaciones` / `_historial` | Por empresa | Solo el propio usuario (`user_id = auth.uid()`) |
| `payment_links`, `billing_notifications`, `billing_message_templates`, `cobro_reintentos`, `trial_blacklist`, `wa_campaigns`, `wa_campaign_sends` | Solo super admin | Solo super admin |
| `wa_optouts` | Cualquier autenticado | Solo super admin |
| `maintenance_log` | Solo super admin | Solo super admin (INSERT; sin UPDATE/DELETE) |
| `otp_codes` | Solo super admin | Sin política (solo `service_role` / funciones `SECURITY DEFINER`) |
| `tutorial_videos` | Cualquier autenticado | Super admin (o un usuario específico) |
| `cat_forma_pago`, `cat_metodo_pago`, `cat_moneda`, `cat_regimen_fiscal`, `cat_tipo_comprobante`, `cat_uso_cfdi`, `unidades_sat` | **Público** (`USING true`, incluye `anon`) | Sin política (solo se cargan por migración) |

> **Storage:** los buckets `public-assets`, `avatars` y `ruta-fotos` tienen lectura pública; la escritura se restringe al dueño o a usuarios de la misma empresa.

#### Hallazgos a tener en cuenta

- **`has_billing_access()` no se usa en ninguna política RLS.** El bloqueo de acceso por suscripción vencida se aplica **solo fuera de la base de datos** (frontend y edge functions), no a nivel de RLS. Si se requiere reforzarlo en la BD, hay que conectarlo a las políticas.
- **`payment_links` ya no es accesible por token anónimo:** la política pública para `anon` se eliminó en una migración posterior. Hoy solo el super-admin accede a esa tabla.
- Las tablas `auditoria*` conviven con una política `FOR ALL` (línea base) y políticas `SELECT`/`INSERT` más específicas añadidas después; como RLS combina políticas con `OR`, prevalece la más permisiva.

---

### 10.16 Triggers de base de datos

La base de datos usa triggers para automatizar folios, inventario, totales y validaciones. Es importante conocerlos porque **modifican datos sin que el frontend lo pida explícitamente**.

#### Alta de usuarios y empresas

| Trigger | Tabla / evento | Qué hace |
|---|---|---|
| `on_auth_user_created` | `auth.users` · AFTER INSERT | Al registrarse un usuario: si trae `empresa_nombre` crea la `empresa`, el `profiles` y le asigna el rol *Administrador*; si no, lo asocia a una empresa existente |
| `trg_auto_create_empresa_basics` | `empresas` · AFTER INSERT | Crea la configuración semilla de la empresa: almacén, tarifa y lista de precios general, unidad "Pieza", zona, y el rol *Administrador* con todos los permisos |
| `on_empresa_created_trial` | `empresas` · AFTER INSERT | Crea una `subscription` de prueba (`status='trial'`, 7 días, `max_usuarios=3`) |

#### Folios automáticos (BEFORE INSERT)

Si el documento se inserta sin folio, el trigger lo genera:

| Trigger | Tabla | Folio |
|---|---|---|
| `trg_auto_folio_venta` | `ventas` | `SAL-####` (saldo inicial) o vía `next_folio` con prefijo `PED` / `VTA` |
| `trg_auto_codigo_cliente` | `clientes` | Código con `next_folio('CLI', …)` |
| `trg_auto_folio_compra` | `compras` | `COM-####` |
| `trg_auto_folio_traspaso` | `traspasos` | `TRA-####` |
| `trg_auto_folio_entrega` | `entregas` | `ENT-####` |
| `trg_auto_numero_factura` | `facturas` | `FAC-#####` |

#### Inventario (lo más delicado)

| Trigger | Tabla / evento | Qué hace |
|---|---|---|
| `trg_apply_immediate_sale_inventory` | `venta_lineas` · AFTER INSERT | Venta directa **inmediata** (POS): descuenta `stock_almacen` y registra `salida` en `movimientos_inventario` |
| `trg_apply_delivered_direct_sale_inventory` | `ventas` · AFTER UPDATE status | Venta directa **no inmediata** que pasa a `entregado`: descuenta stock y registra movimiento |
| `trg_apply_pedido_entregado_inventory` | `ventas` · AFTER UPDATE status | **Pedido** que pasa a `entregado`: descuenta stock — **salvo** que el pedido tenga `entregas` asociadas (en ese caso el descuento lo hace el flujo de entregas, para no duplicar) |
| `trg_restore_cancelled_sale_inventory` | `ventas` · AFTER UPDATE | Venta directa entregada que se cancela o vuelve a borrador: **devuelve** el stock y registra `entrada` |
| `trg_apply_descarga_ruta_aprobada` | `descarga_ruta` · AFTER UPDATE status | Descarga de ruta aprobada: descuenta del almacén del vendedor lo descargado |
| `trg_compra_recalc_costos` | `compras` · AFTER UPDATE | Compra que pasa a `recibida`/`pagada`: recalcula el costo de cada producto (`recalc_producto_costo`) |
| `trg_recalc_stock_total_almacen` | `stock_almacen` · AFTER INSERT/UPDATE/DELETE | Recalcula `productos.cantidad` sumando el stock de todos los almacenes |
| `trg_recalc_stock_total_camion` | `stock_camion` · AFTER INSERT/UPDATE/DELETE | Dispara el mismo recálculo (ver nota abajo) |

> **Doble vía de descuento de inventario:** el inventario de un pedido se puede descontar por dos caminos según tenga o no `entregas` ligadas. Téngalo presente al modificar la lógica de entregas o de ventas.
>
> **Nota sobre `stock_camion`:** la función de recálculo vigente solo suma `stock_almacen`, así que `productos.cantidad` refleja el stock de almacenes, no el de camión (el inventario de ruta se modela como un almacén del vendedor). El trigger sobre `stock_camion` podría ser residual — conviene confirmarlo con el equipo.

#### Estados, totales y validaciones

| Trigger | Tabla / evento | Qué hace |
|---|---|---|
| `trg_auto_venta_facturado` | `venta_lineas` · AFTER UPDATE | Si todas las líneas quedan `facturado=true`, pone la venta en `status='facturado'` |
| `trg_auto_venta_entregado` | `entregas` · AFTER UPDATE status | Cuando todas las entregas de un pedido están `hecho`, pone la venta en `status='entregado'` |
| `trg_recalc_venta_saldo` | `cobro_aplicaciones` · AFTER INSERT/UPDATE/DELETE | Recalcula `ventas.saldo_pendiente` = total − pagos aplicados (cobros no cancelados) |
| `trg_inherit_entrega_orden` | `entregas` · BEFORE INSERT/UPDATE | Autocompleta `orden_entrega` según el orden de ruta del cliente (`cliente_orden_ruta`) |
| `trg_validate_entrega_status` | `entregas` · BEFORE UPDATE | Valida transiciones de estado (a `cargado` exige vendedor, líneas surtidas y almacén; a `hecho` exige estado previo válido) |
| `trg_validate_entrega_linea_insert` | `entrega_lineas` · BEFORE INSERT | Impide agregar líneas a una entrega ya procesada |
| `trg_ruta_sesion_validate` | `ruta_sesiones` · BEFORE INSERT/UPDATE | Valida el kilometraje y, al cerrar la jornada, actualiza `vehiculos.km_actual` |

#### `updated_at` automático

Los triggers `trg_*_updated_at` sobre `ruta_sesiones`, `vehiculos`, `caja_turnos` y `cobro_reintentos` ejecutan `set_updated_at()` (asignan `updated_at = now()`) en cada UPDATE.

> Los triggers que sincronizaban `profiles` con tablas `vendedores`/`cobradores` se eliminaron en abril de 2026 al unificar la arquitectura de vendedores en `profiles`.

---

## 11. Funciones RPC (PostgreSQL)

Funciones almacenadas en la base de datos, invocables vía `supabase.rpc(...)`. Concentran operaciones transaccionales para garantizar consistencia.

| Función | Propósito |
|---|---|
| `generate_folio(p_empresa_id, p_tipo)` / `next_folio(p_empresa_id, prefix)` | Generar folios consecutivos por tipo de documento |
| `recibir_linea_compra(...)` | Recibir una línea de compra (suma stock + kardex) |
| `recalc_producto_costo(p_producto_id)` | Recalcular el costo de un producto |
| `surtir_linea_entrega(...)` | Surtir una línea de entrega (descuenta stock) |
| `confirmar_traspaso(p_traspaso_id, p_user_id)` | Confirmar un traspaso (mueve stock) |
| `cancelar_traspaso(p_traspaso_id, p_user_id)` | Cancelar un traspaso (revierte stock) |
| `calc_audit_stock_teorico(p_linea_id)` | Calcular el stock teórico de una línea de auditoría |
| `close_audit_line(p_linea_id, p_cerrada)` | Cerrar/abrir una línea de auditoría |
| `close_full_audit(p_auditoria_id, p_cerrada_por)` | Cerrar una auditoría completa y aplicar ajustes |
| `get_audit_users(p_auditoria_id)` | Usuarios que participaron en una auditoría |
| `registrar_saldo_inicial(...)` | Registrar el saldo inicial de un cliente |
| `add_timbres(p_empresa_id, p_cantidad, p_user_id, p_notas)` | Acreditar timbres a una empresa |
| `deduct_timbre(p_empresa_id, p_cfdi_id, p_user_id)` | Descontar un timbre al timbrar un CFDI |
| `get_optimization_quota(_empresa_id)` | Cuota de optimización de rutas disponible |
| `get_my_empresa_id()` | `empresa_id` del usuario actual (usado en RLS) |
| `user_role_empresa_id(p_user_id)` | `empresa_id` asociado al rol del usuario |
| `is_super_admin(p_user_id)` | Indica si un usuario es super-admin |
| `verify_admin_pin(p_user_id, p_pin)` | Verificar el PIN de administrador |
| `has_billing_access(p_empresa_id)` | Indica si la empresa tiene acceso (suscripción) |
| `is_email_blacklisted(p_email)` | Verificar la lista negra de pruebas |
| `get_empresa_user_emails(p_empresa_id)` | Correos de los usuarios de una empresa |
| `get_inactive_empresas(...)` | Empresas inactivas / vencidas (panel admin) |
| `get_database_health()` | Métricas de salud de la base de datos |
| `run_maintenance_vacuum(p_tables)` | Ejecutar mantenimiento (VACUUM) |
| `cleanup_old_vendedor_historial()` | Limpiar histórico antiguo de ubicaciones |
| `cleanup_stale_vendedor_ubicaciones()` | Limpiar ubicaciones obsoletas |
| `delete_empresa_cascade(p_empresa_id, p_deleted_by)` | Borrar una empresa y sus datos en cascada |
| `delete_empresas_bulk(p_empresa_ids, p_deleted_by)` | Borrado masivo de empresas |

---

## 12. Enumeraciones (ENUMs)

Tipos `enum` definidos en PostgreSQL:

| Enum | Valores |
|---|---|
| `status_venta` | borrador · confirmado · entregado · facturado · cancelado |
| `tipo_venta` | pedido · venta_directa · saldo_inicial |
| `condicion_pago` | contado · credito · por_definir |
| `status_cliente` | activo · inactivo · suspendido |
| `frecuencia_visita` | diaria · semanal · quincenal · mensual |
| `status_producto` | activo · inactivo · borrador |
| `calculo_costo` | promedio · ultimo · estandar · manual · ultimo_compra · ultimo_proveedor |
| `tipo_comision` | porcentaje · monto_fijo |
| `status_carga` | pendiente · en_ruta · completada · cancelada |
| `status_entrega` | borrador · surtido · asignado · cargado · en_ruta · listo · hecho · cancelado |
| `status_descarga` | pendiente · aprobada · rechazada |
| `status_traspaso` | borrador · confirmado · cancelado |
| `tipo_traspaso` | almacen_almacen · almacen_ruta · ruta_almacen |
| `tipo_movimiento` | entrada · salida · transferencia |
| `status_auditoria` | pendiente · en_proceso · por_aprobar · aprobada · rechazada · cerrada |
| `tipo_devolucion` | almacen · tienda |
| `motivo_devolucion` | no_vendido · vencido · danado · cambio · otro · error_pedido · caducado |
| `accion_devolucion` | reposicion · nota_credito · devolucion_dinero · descuento_venta |
| `motivo_diferencia` | error_entrega · merma · danado · faltante · sobrante · otro |
| `tipo_tarifa` | general · por_cliente · por_ruta |
| `tipo_calculo_tarifa` | margen_costo · descuento_precio · precio_fijo |
| `aplica_a_tarifa` | todos · categoria · producto |
| `tipo_promocion` | descuento_porcentaje · descuento_monto · producto_gratis · precio_especial · volumen |
| `aplica_promocion` | todos · producto · clasificacion · cliente · zona |
| `notification_type` | banner · modal · bubble |
| `notification_redirect_type` | internal · external · both |

---

## 13. Edge Functions

Funciones serverless (Deno) en `supabase/functions/`. Hay **30 funciones**. La autenticación JWT se controla en `supabase/config.toml`: las funciones listadas ahí con `verify_jwt = false` no exigen JWT de Supabase (algunas validan acceso internamente, otras son públicas o se invocan por cron).

### Suscripciones / Stripe

| Función | Descripción |
|---|---|
| `create-checkout` | Crea sesión de Stripe Checkout con prorrateo (días 1–4 mes completo, día 5+ proporcional) |
| `check-subscription` | Consulta si el usuario tiene suscripción activa en Stripe |
| `customer-portal` | Genera enlace al portal de facturación de Stripe |
| `manage-subscription` | Cambia cantidad de usuarios, plan, cancela o aplica descuento de retención |
| `select-plan` | El usuario elige un plan → crea factura + checkout de Stripe |
| `list-invoices` | Lista las facturas de Stripe del usuario |
| `stripe-webhook` | Recibe webhooks de Stripe (pago, renovación, cancelación). Valida firma |
| `purchase-timbres` | Compra de timbres CFDI vía Stripe |
| `purchase-route-credits` | Compra de paquete de créditos de optimización de rutas |
| `verify-route-credits` | Verifica el pago de créditos de ruta |

### Billing / cobranza automática

| Función | Descripción |
|---|---|
| `billing-cycle` | Ciclo mensual: genera facturas, aplica periodo de gracia, suspende, procesa reintentos |
| `billing-notify` | Notificaciones de cobro con plantillas (bienvenida, pre-cobro, éxito, fallo, suspensión) |
| `billing-notify-email` | Genera y registra el correo de notificación de factura |
| `daily-billing` | Control diario de acceso por estado de suscripción (zona horaria de México) |
| `create-invoice-reminder` | Crea facturas para suscripciones que vencen mañana |
| `subscription-cleanup` | Expira pruebas/suscripciones y purga datos de empresas vencidas >15 días |
| `admin-billing` | Panel de administración de facturación (super-admin): facturas, KPIs, notificaciones |
| `admin-cleanup-stripe-invoices` | Limpia facturas huérfanas de un cliente en Stripe |

### OpenPay

| Función | Descripción |
|---|---|
| `openpay` | Panel admin de OpenPay: planes, clientes, tarjetas, suscripciones, cargos |
| `openpay-public` | Página pública de pago: el cliente completa el pago vía token |

### Facturación CFDI

| Función | Descripción |
|---|---|
| `facturama` | Timbrado/cancelación de CFDI con Facturama; gestión de CSD; descarga de PDF/XML |
| `parse-csf` | Extrae datos fiscales de la Constancia de Situación Fiscal (PDF) con visión por IA |

### Rutas / mapas

| Función | Descripción |
|---|---|
| `optimize-route` | Optimiza rutas (vecino más cercano + 2-opt, o matriz real de Google). Con cuota mensual |
| `get-maps-key` | Entrega la API key de Google Maps al frontend |

### WhatsApp

| Función | Descripción |
|---|---|
| `whatsapp-sender` | Envía mensajes WhatsApp por empresa (texto/imagen/archivo); registra en `whatsapp_log` |
| `wa-campaign` | Campañas masivas de WhatsApp (super-admin), con segmentación y personalización |
| `send-otp` | Envía/verifica códigos OTP por WhatsApp (2FA). Con límite de frecuencia |

### Usuarios y otros

| Función | Descripción |
|---|---|
| `admin-users` | Gestión de usuarios y empresas (crear usuario/empresa, contraseñas, confirmar correo) |
| `demo-login` | Restablece y puebla la cuenta demo con datos de ejemplo |
| `public-catalog` | Catálogo público de productos con precios resueltos (acceso por `share_token`) |

---

## 14. Modo offline y sincronización

La app de ruta debe operar sin conexión. La capa offline vive en `src/lib/` (`offlineDb.ts`, `offlineSync.ts`, `syncQueue.ts`, `offlineBackup.ts`, `syncVerify.ts`).

### Almacenamiento local

- Base de datos **IndexedDB** vía **Dexie**, llamada `UnilineOffline`.
- Espeja ~26 tablas: datos maestros (`clientes`, `productos`, `vendedores`, `unidades`, `tarifas`, `zonas`…) y operativos (`cargas`, `ventas`, `cobros`, `entregas`, `devoluciones`, `gastos`, `visitas`, `descarga_ruta`…).
- Tablas de sistema locales: `syncQueue` (operaciones pendientes), `cacheTimestamps` (última sincronización por tabla), `profiles`/`empresas` (caché de sesión).

### Descarga / sincronización (`offlineSync.ts`)

- **Sincronización delta:** descarga solo lo que cambió desde la última marca de tiempo.
- En la primera sincronización descarga los últimos 30 días de datos transaccionales.
- Descarga paginada (1000 filas por página) en lotes de tablas; reporta progreso.

### Cola de sincronización (`syncQueue.ts`)

1. Toda escritura se aplica **primero en IndexedDB** (la UI responde al instante).
2. La operación se encola en `syncQueue` (con deduplicación: si ya hay una pendiente para la misma fila+tabla+operación, se reemplaza).
3. Si hay conexión y la auto-sincronización está activa, se procesa la cola.
4. Procesamiento con **reintento exponencial** (1 s, 2 s, 4 s… máx. 30 s). Tras 5 intentos fallidos la operación pasa a *dead letter* (revisión manual).
5. La cola se respalda en `localStorage` como red de seguridad; al arrancar la app se restaura lo pendiente.

### Otras piezas

- **`useNetworkStatus`** — estado online/offline y conmutador de auto-sincronización (`uniline_auto_sync` en `localStorage`).
- **`dataSaver.ts`** — modo ahorro de datos: si ya hay datos locales, evita pedir al servidor.
- **`useLocationBroadcaster`** — difunde la ubicación GPS del vendedor (cada ~60 s o cada 25 m); si está offline, la encola.
- El contador de pendientes se refleja en `rutaStore` y se muestra en la UI.

---

## 15. PWA

Configurada con `vite-plugin-pwa` (Workbox) en [vite.config.ts](vite.config.ts).

- **`registerType: "prompt"`** — al haber una nueva versión se avisa; el service worker se actualiza en la siguiente navegación.
- **Estrategias de caché:**
  - JS/CSS → `StaleWhileRevalidate` (caché `static-assets`).
  - Imágenes → `CacheFirst` (caché `images`).
  - Fuentes → `CacheFirst` (caché `fonts`).
  - Llamadas a `supabase.co` → `NetworkOnly` (las gestiona la cola offline).
- **`navigateFallback: index.html`** — sirve el *app shell* sin conexión.
- **Manifest:** nombre "Rutapp – Venta en Ruta", `display: standalone`, `orientation: portrait`, **`start_url: /ruta`** (la PWA instalada abre directo en la app de ruta), tema `#1a1a2e`.
- El service worker se registra en `main.tsx` y comprueba actualizaciones cada 60 s.

---

## 16. Rutas de la aplicación

Las rutas se definen en [src/App.tsx](src/App.tsx). El árbol de rutas cambia según el estado del usuario (sin sesión / debe cambiar contraseña / suscripción bloqueada / super-admin / solo móvil / solo POS / escritorio).

### Públicas (sin sesión)

| Ruta | Página |
|---|---|
| `/` | Landing |
| `/login`, `/signup`, `/reset-password` | Autenticación |
| `/terminos`, `/privacidad` | Legales |
| `/catalogo/:token` | Catálogo público (por token de compartir) |
| `/pagar/:token` | Pago público (por token) |
| `/auditoria-movil/:auditoria_id` | Vista móvil de auditoría |

### App de ruta móvil (`/ruta/*`)

Bajo `MobileLayout`. Incluye: `dashboard`, `ventas` (y `ventas/nueva`, `ventas/:id`), `pos`, `carga`, `cobros` (y `cobros/nuevo`), `stock`, `gastos`, `entregas` (y `entregas/:id`), `clientes/nuevo`, `devolucion`, `descarga`, `mapa`, `navegacion`, `sincronizar`, `iniciar`, `perfil`.

### Escritorio (back-office)

Bajo `AppLayout`, cada ruta protegida por `<PermissionGuard>`. Grupos principales:

- **Ventas:** `/ventas`, `/ventas/:id`, `/ventas/reporte-diario`, `/ventas/devoluciones`, `/ventas/cobranza`, `/ventas/promociones`, `/ventas/mapa-clientes`, `/ventas/mapa-ventas`, `/pos`.
- **Clientes:** `/clientes`, `/clientes/:id`.
- **Logística:** `/logistica/dashboard`, `/logistica/pedidos`, `/logistica/entregas`, `/logistica/orden-carga/:camionId`, `/logistica/reportes`, `/logistica/jornadas`, `/monitor-rutas`.
- **Catálogo:** `/productos`, `/productos/:id`, `/catalogos/:catalog`, `/listas-precio`, `/tarifas/:id`, `/proveedores`, `/proveedores/:id`.
- **Almacén:** `/almacen/inventario`, `/almacen/almacenes`, `/almacen/compras`, `/almacen/traspasos`, `/almacen/ajustes`, `/almacen/auditorias`, `/almacen/conteos`, `/almacen/descargas`.
- **Finanzas:** `/finanzas/por-cobrar`, `/finanzas/aplicar-pagos`, `/finanzas/saldos-cliente`, `/finanzas/por-pagar`, `/finanzas/pagos-proveedores`, `/finanzas/saldos-proveedor`, `/finanzas/gastos`, `/finanzas/comisiones`.
- **Reportes:** `/reportes`, `/reportes/entregas`, `/control`, `/dashboard`, `/supervisor`.
- **Facturación:** `/facturacion`, `/facturacion-cfdi`, `/facturacion-cfdi/:id`, `/mi-suscripcion`, `/cancelar-suscripcion`.
- **Configuración:** `/configuracion`, `/configuracion/usuarios`, `/configuracion/vehiculos`, `/configuracion/whatsapp`, `/configuracion/saldos-iniciales`, `/configuracion-inicial`.

---

## 17. Integraciones externas

| Servicio | Para qué | Dónde |
|---|---|---|
| **Stripe** | Cobro de suscripciones SaaS, timbres y créditos de ruta | Edge functions de billing |
| **OpenPay** | Pasarela de pago alternativa (tarjeta, OXXO, SPEI) | `openpay`, `openpay-public` |
| **Facturama** | Timbrado de CFDI (factura electrónica México) | `facturama` |
| **Google Maps / Routes** | Mapas y optimización de rutas | `get-maps-key`, `optimize-route` |
| **WhatsApp** (proxy externo) | Recibos, avisos de cobro, OTP, campañas | `whatsapp-sender`, `send-otp`, `wa-campaign` |
| **AI Gateway** | Lectura por visión de la Constancia de Situación Fiscal | `parse-csf` |
| **Impresoras térmicas** | Tickets por Bluetooth / ESC-POS | `src/lib/bluetoothPrinter.ts`, `escpos.ts` |

---

## 18. Convenciones para el desarrollador

- **TypeScript:** la configuración es permisiva (`strictNullChecks: false`, `noImplicitAny: false`). Al tocar áreas nuevas conviene tipar con cuidado de todos modos.
- **Tipos de la BD:** `src/integrations/supabase/types.ts` se **genera** con la CLI de Supabase (`supabase gen types typescript`). No editarlo a mano: regenerarlo tras cada cambio de esquema.
- **Migraciones:** todo cambio de esquema va como una migración nueva en `supabase/migrations/` (no modificar migraciones ya aplicadas).
- **Acceso a datos:** preferir los hooks de `src/hooks/` en lugar de llamar a `supabase` directo desde un componente; así se reutiliza la caché de React Query.
- **Multi-tenant:** toda consulta/inserción a tablas operativas debe respetar `empresa_id`. La RLS protege, pero el código también debe filtrar.
- **Offline:** las escrituras de la app de ruta deben pasar por `syncQueue` (`queueOperation`), nunca escribir al servidor directo.
- **Importaciones:** usar el alias `@/` (p. ej. `@/components/...`, `@/lib/...`).
- **UI:** componer con las primitivas de `components/ui/` (shadcn/ui); para listas/formularios largos hay componentes "Odoo*" (`OdooFormField`, `OdooTabs`, `OdooFilterBar`, etc.) que dan un estilo consistente.
- **Idioma:** el dominio y la UI están en español; mantener nombres de variables y rutas en español por coherencia con el resto del código.

---

## 19. Despliegue

### Frontend

El frontend es estático tras `npm run build` (carpeta `dist/`). Se puede desplegar en cualquier hosting de sitios estáticos / aplicaciones Vite:

- **Vercel**, **Netlify**, **Cloudflare Pages**
- VPS / Nginx, contenedor Docker

Configurar las variables `VITE_*` en el entorno de build del hosting.

### Backend (Supabase)

- **Migraciones:** aplicar con `supabase db push` (o desde el panel).
- **Edge Functions:** desplegar con `supabase functions deploy <nombre>`.
- **Secretos:** configurar con `supabase secrets set CLAVE=valor` (ver [sección 4](#4-variables-de-entorno)).
- **Tareas programadas (cron):** las funciones `daily-billing`, `billing-cycle`, `billing-notify`, `subscription-cleanup`, `create-invoice-reminder` están pensadas para ejecutarse por cron (pg_cron / Scheduled Functions).

---

## 20. Testing

| Tipo | Herramienta | Comando |
|---|---|---|
| Unitarias / componentes | Vitest + Testing Library (jsdom) | `npm run test` |
| End-to-end | Playwright | `npm run test:e2e` |
| Todo | — | `npm run test:all` |

---

_Última revisión del documento: mayo 2026._
