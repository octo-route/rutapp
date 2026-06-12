import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, Users, MapPin, BarChart3, Package, Wallet,
  Truck, Smartphone, Shield, Zap, ChevronRight, Check,
  ArrowRight, Star, Menu, X, Route, CreditCard, Radio,
  FileText, ClipboardCheck, RefreshCw, Receipt, Bell,
  WifiOff, MessageCircle, TrendingUp, Eye, Layers,
  Tag, Building2, Calculator, ScanLine, Activity, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiveSupervisorMap, LiveMobileApp, LiveDashboardMockup } from '@/components/landing/LiveMockups';

// ── Hero highlight: seguimiento en tiempo real ──
const REALTIME_BULLETS = [
  { icon: Radio, text: 'Ubicación GPS de cada vendedor actualizada al instante' },
  { icon: Eye, text: 'Mira qué cliente está visitando cada uno en este momento' },
  { icon: Activity, text: 'Detecta ventas fuera de la ubicación del cliente' },
  { icon: Bell, text: 'Alertas automáticas si un vendedor se desvía de la ruta' },
];

// ── Capacidades principales (todo lo que hace el sistema) ──
const FEATURE_GROUPS = [
  {
    title: 'Operación de campo',
    color: 'hsl(230, 55%, 52%)',
    bg: 'hsl(230, 55%, 95%)',
    items: [
      { icon: Radio, title: 'Seguimiento en tiempo real', desc: 'Ubicación viva de cada vendedor en el mapa con histórico de recorrido y batería del dispositivo.' },
      { icon: Smartphone, title: 'App móvil offline-first', desc: 'Tus vendedores venden, cobran y registran gastos sin internet. Todo sincroniza al volver a línea.' },
      { icon: Route, title: 'Optimización de rutas', desc: 'Algoritmo Google Routes API + 2-opt. Ordena automáticamente la visita más eficiente del día.' },
      { icon: MapPin, title: 'Mapa de clientes con GPS', desc: 'Captura GPS al alta, navegación tipo Uber paso a paso y detección de visita.' },
    ],
  },
  {
    title: 'Ventas y cobranza',
    color: 'hsl(152, 56%, 38%)',
    bg: 'hsl(152, 56%, 95%)',
    items: [
      { icon: ShoppingCart, title: 'Punto de venta avanzado', desc: 'POS responsivo con búsqueda rápida, promociones nxm, descuentos y control de stock por almacén.' },
      { icon: Truck, title: 'Pedidos y entregas', desc: 'Flujo 1:N pedido → entregas. Despacha por ruta, marca entregado y descuenta inventario automático.' },
      { icon: Wallet, title: 'Cobranza inteligente', desc: 'Aplicación FIFO multi-folio, cobros parciales, liquidación de ruta con efectivo esperado vs real.' },
      { icon: Receipt, title: 'Tickets y CFDI 4.0', desc: 'Tickets térmicos por Bluetooth, PDFs estilo Odoo y facturación SAT con Facturama integrado.' },
    ],
  },
  {
    title: 'Inventario y catálogo',
    color: 'hsl(38, 90%, 50%)',
    bg: 'hsl(38, 90%, 95%)',
    items: [
      { icon: Package, title: 'Inventario multialmacén', desc: 'Stock en tiempo real por almacén, traspasos con bloqueo de filas y kardex granular.' },
      { icon: ClipboardCheck, title: 'Conteos físicos y auditorías', desc: 'Reconciliación teórico vs físico desde móvil con PIN de supervisor para reapertura.' },
      { icon: RefreshCw, title: 'Cargas y descargas de ruta', desc: 'Arma cargas para camión, controla devoluciones y liquidación de mercancía sobrante.' },
      { icon: Tag, title: 'Listas de precios y promociones', desc: 'Múltiples tarifas por cliente, promociones nxm, descuentos por volumen y precios mayoreo.' },
    ],
  },
  {
    title: 'Finanzas y análisis',
    color: 'hsl(260, 45%, 60%)',
    bg: 'hsl(260, 45%, 95%)',
    items: [
      { icon: BarChart3, title: 'Dashboard ejecutivo', desc: 'KPIs en vivo, ranking de vendedores, top productos y alertas de stock bajo mínimo.' },
      { icon: TrendingUp, title: 'Reportes operativos', desc: 'Ventas por cliente, producto, vendedor, utilidad, devoluciones, comisiones y cobertura de ruta.' },
      { icon: Calculator, title: 'Cuentas por cobrar y pagar', desc: 'Estados de cuenta por cliente y proveedor, antigüedad de saldos y aplicación FIFO.' },
      { icon: CreditCard, title: 'Compras y proveedores', desc: 'Órdenes de compra, recepción de mercancía, pagos parciales y saldos pendientes.' },
    ],
  },
  {
    title: 'Administración y control',
    color: 'hsl(0, 70%, 55%)',
    bg: 'hsl(0, 70%, 96%)',
    items: [
      { icon: Shield, title: 'Roles y permisos granulares', desc: 'Control fino por módulo y acción. Vista solo móvil, solo propios o acceso total.' },
      { icon: Eye, title: 'Panel de auditoría y control', desc: 'Detecta descuentos excesivos, ventas debajo del costo y anomalías operativas.' },
      { icon: Layers, title: 'Multi-empresa y multi-moneda', desc: 'Maneja varias empresas en una cuenta, con soporte multimoneda y zonas horarias.' },
      { icon: Building2, title: 'Catálogo público compartible', desc: 'Genera enlaces de catálogo por lista de precios. Tus clientes piden por WhatsApp.' },
    ],
  },
  {
    title: 'Comunicación e integración',
    color: 'hsl(142, 71%, 45%)',
    bg: 'hsl(142, 71%, 95%)',
    items: [
      { icon: MessageCircle, title: 'WhatsApp integrado', desc: 'Envía tickets, estados de cuenta y campañas. Recordatorios automáticos de cobro.' },
      { icon: Bell, title: 'Notificaciones automatizadas', desc: 'Email + WhatsApp con branding propio. Avisos de pago, vencimientos y cumpleaños.' },
      { icon: ScanLine, title: 'Importación masiva', desc: 'Sube productos y clientes desde Excel/CSV con validación y autocreación de catálogos.' },
      { icon: WifiOff, title: 'PWA instalable', desc: 'Funciona como app nativa en Android, iOS y escritorio. Sin tiendas, sin descargas pesadas.' },
    ],
  },
];

const NAV_HIGHLIGHTS = [
  { icon: BarChart3, label: 'Dashboard', desc: 'KPIs del día' },
  { icon: ShoppingCart, label: 'Punto de venta', desc: 'POS rápido' },
  { icon: Smartphone, label: 'App Móvil', desc: 'Para ruta' },
  { icon: Users, label: 'Clientes', desc: 'CRM con GPS' },
  { icon: Package, label: 'Productos', desc: 'Inventario' },
  { icon: Truck, label: 'Logística', desc: 'Cargas y entregas' },
  { icon: Wallet, label: 'Cobranza', desc: 'Cuentas por cobrar' },
  { icon: FileText, label: 'Reportes', desc: 'Análisis total' },
];

const TESTIMONIALS = [
  { name: 'Carlos M.', role: 'Director comercial', company: 'Distribuidora Norte', text: 'El seguimiento en tiempo real cambió todo. Ahora sé exactamente dónde está cada vendedor y puedo reaccionar al instante.' },
  { name: 'Ana R.', role: 'Gerente de ventas', company: 'Lácteos del Valle', text: 'Mis vendedores venden desde el celular sin internet. Ya no hay papelitos ni errores en pedidos.' },
  { name: 'Roberto S.', role: 'Fundador', company: 'Botanas Express', text: 'La optimización de rutas nos ahorró miles de pesos en gasolina el primer mes. Se pagó solo.' },
];

const DEMO_LOGIN_PENDING_KEY = 'demo_login_pending';

export default function LandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [demoRedirectPending, setDemoRedirectPending] = useState(
    () => sessionStorage.getItem(DEMO_LOGIN_PENDING_KEY) === '1'
  );

  useEffect(() => {
    const syncPendingState = () => {
      setDemoRedirectPending(sessionStorage.getItem(DEMO_LOGIN_PENDING_KEY) === '1');
    };

    syncPendingState();
    window.addEventListener('demo-login-pending-change', syncPendingState);

    return () => {
      window.removeEventListener('demo-login-pending-change', syncPendingState);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      {demoRedirectPending && (
        <div className="fixed z-[60] top-5 left-1/2 -translate-x-1/2 w-[min(94vw,680px)]">
          <div
            className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-white/95 backdrop-blur-md shadow-2xl"
            style={{ boxShadow: '0 20px 55px -20px hsl(230, 55%, 52% / 0.45)' }}
          >
            <div
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ background: 'linear-gradient(90deg, hsl(230, 55%, 52%), hsl(260, 45%, 60%), hsl(152, 56%, 45%))' }}
            />
            <div className="px-5 py-4 md:px-6 md:py-5 flex items-start gap-4">
              <div
                className="mt-0.5 w-11 h-11 rounded-xl shrink-0 flex items-center justify-center"
                style={{ background: 'hsl(230, 55%, 95%)' }}
              >
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'hsl(230, 55%, 52%)' }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm md:text-base font-bold tracking-tight text-gray-900">
                  Iniciando entorno demo
                </p>
                <p className="text-xs md:text-sm text-gray-600 mt-1 leading-relaxed">
                  Estamos preparando tus datos de prueba. Te redirigiremos automaticamente en unos segundos.
                </p>
                <div className="mt-3 h-1.5 w-full rounded-full bg-indigo-100/80 overflow-hidden">
                  <div
                    className="h-full w-1/2 rounded-full animate-pulse"
                    style={{ background: 'linear-gradient(90deg, hsl(230, 55%, 52%), hsl(260, 45%, 60%))' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-[max(1.5rem,env(safe-area-inset-left))] h-16">
          <div className="flex items-center gap-2">
            <img src="/Octoapp%20logo.png" alt="OctoApp" className="h-8 w-8 rounded-lg object-contain" />
            <span className="text-xl font-black tracking-tight" style={{ color: 'hsl(230, 55%, 52%)' }}>OctoApp</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-600">
            <a href="#realtime" className="hover:text-gray-900 transition-colors flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              En vivo
            </a>
            <a href="#features" className="hover:text-gray-900 transition-colors">Funciones</a>
            <a href="#modules" className="hover:text-gray-900 transition-colors">Módulos</a>
            <a href="#screenshots" className="hover:text-gray-900 transition-colors">Capturas</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Precios</a>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">Iniciar sesión</Link>
            <Link to="/signup" className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-all hover:opacity-90 shadow-lg shadow-indigo-500/25"
              style={{ background: 'hsl(230, 55%, 52%)' }}>
              Probar gratis
            </Link>
          </div>
          <div className="flex md:hidden items-center gap-2">
            <Link to="/login" className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg"
              style={{ background: 'hsl(230, 55%, 52%)' }}>
              Iniciar sesión
            </Link>
            <button onClick={() => setMobileMenu(!mobileMenu)} className="p-2" aria-label="Abrir menú">
              {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3">
            <a href="#realtime" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-emerald-600">● En vivo</a>
            <a href="#features" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-gray-600">Funciones</a>
            <a href="#modules" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-gray-600">Módulos</a>
            <a href="#screenshots" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-gray-600">Capturas</a>
            <a href="#pricing" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-gray-600">Precios</a>
            <Link to="/signup" className="block w-full text-center px-5 py-2.5 text-sm font-semibold text-white rounded-lg"
              style={{ background: 'hsl(230, 55%, 52%)' }}>Probar gratis</Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, hsl(230, 55%, 52%), transparent)' }} />
          <div className="absolute top-60 -left-40 w-[400px] h-[400px] rounded-full opacity-[0.05]"
            style={{ background: 'radial-gradient(circle, hsl(260, 45%, 60%), transparent)' }} />
        </div>
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Nuevo · Seguimiento en tiempo real de vendedores
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.1] mb-6">
              Mira a tus vendedores
              <span className="block" style={{ color: 'hsl(230, 55%, 52%)' }}>en vivo, en el mapa</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
              El ERP completo para distribuidoras y venta en ruta. Seguimiento GPS al instante, app móvil offline,
              optimización de rutas, inventario, cobranza y facturación CFDI — todo en un solo lugar.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <Link to="/signup" className="w-full sm:w-auto px-8 py-4 text-base font-bold text-white rounded-xl transition-all hover:opacity-90 shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-2"
                style={{ background: 'hsl(230, 55%, 52%)' }}>
                Comenzar gratis <ArrowRight className="h-5 w-5" />
              </Link>
              <a href="#realtime" className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-gray-700 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all flex items-center justify-center gap-2">
                Conoce más <ChevronRight className="h-5 w-5" />
              </a>
            </div>
            <p className="text-xs text-gray-400 mt-4">Sin tarjeta · Configuración en 5 minutos · 7 días de prueba</p>
          </div>

          {/* Hero — live dashboard mockup */}
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute inset-0 rounded-2xl opacity-20 blur-3xl -z-10"
              style={{ background: 'linear-gradient(135deg, hsl(230, 55%, 52%), hsl(260, 45%, 60%))' }} />
            <LiveDashboardMockup />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-10 border-y border-gray-100" style={{ background: 'hsl(220, 14%, 98%)' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 px-6 text-center">
          {[
            { val: '500+', label: 'Empresas activas' },
            { val: '10,000+', label: 'Vendedores en ruta' },
            { val: '99.9%', label: 'Uptime garantizado' },
            { val: '< 5 min', label: 'Soporte promedio' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-2xl md:text-3xl font-black" style={{ color: 'hsl(230, 55%, 52%)' }}>{s.val}</div>
              <div className="text-xs text-gray-500 mt-1 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── REALTIME TRACKING (HERO FEATURE) ── */}
      <section id="realtime" className="py-24 px-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, white 0%, hsl(152, 56%, 97%) 100%)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold mb-5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                LO MÁS POPULAR
              </div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight mb-5">
                Seguimiento en tiempo real
                <span className="block" style={{ color: 'hsl(152, 56%, 38%)' }}>de toda tu fuerza de ventas</span>
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed mb-8">
                Olvídate de llamar para preguntar dónde está cada vendedor. El mapa de supervisión muestra la
                ubicación viva de todos, con qué cliente están, cuántas ventas llevan y hasta el nivel de batería.
              </p>
              <ul className="space-y-3.5 mb-8">
                {REALTIME_BULLETS.map(b => (
                  <li key={b.text} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'hsl(152, 56%, 92%)' }}>
                      <b.icon className="h-4.5 w-4.5" style={{ color: 'hsl(152, 56%, 38%)' }} />
                    </div>
                    <span className="text-sm md:text-base text-gray-700 pt-1.5">{b.text}</span>
                  </li>
                ))}
              </ul>
              <Link to="/signup" className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-bold text-white rounded-xl transition-all hover:opacity-90 shadow-lg"
                style={{ background: 'hsl(152, 56%, 38%)', boxShadow: '0 10px 25px -5px hsl(152, 56%, 38% / 0.4)' }}>
                Pruébalo gratis ahora <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* LIVE animated supervisor map */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl opacity-30 blur-2xl"
                style={{ background: 'linear-gradient(135deg, hsl(152, 56%, 50%), hsl(180, 56%, 50%))' }} />
              <LiveSupervisorMap />
            </div>
          </div>
        </div>
      </section>

      {/* ── QUICK NAV / MÓDULOS ── */}
      <section id="modules" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Navegación clara, todo a un clic</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              8 módulos principales accesibles desde el sidebar. Diseñado para que cualquiera lo domine sin entrenamiento.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {NAV_HIGHLIGHTS.map(n => (
              <div key={n.label}
                className="p-5 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 bg-white text-center">
                <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3"
                  style={{ background: 'hsl(230, 55%, 95%)' }}>
                  <n.icon className="h-5.5 w-5.5" style={{ color: 'hsl(230, 55%, 52%)' }} />
                </div>
                <div className="text-sm font-bold text-gray-900">{n.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{n.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ALL FEATURES (grouped) ── */}
      <section id="features" className="py-20 px-6" style={{ background: 'hsl(220, 14%, 98%)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Todo lo que OctoApp puede hacer por ti</h2>
            <p className="text-gray-500 mt-3 max-w-2xl mx-auto">
              Más de 30 funciones listas para usar, organizadas por área. Sin add-ons, sin sorpresas.
            </p>
          </div>

          <div className="space-y-12">
            {FEATURE_GROUPS.map(group => (
              <div key={group.title}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-1 w-10 rounded-full" style={{ background: group.color }} />
                  <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: group.color }}>
                    {group.title}
                  </h3>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {group.items.map(f => (
                    <div key={f.title} className="p-5 rounded-2xl bg-white border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                        style={{ background: group.bg }}>
                        <f.icon className="h-5 w-5" style={{ color: group.color }} />
                      </div>
                      <h4 className="text-sm font-bold mb-1.5">{f.title}</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section id="screenshots" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Míralo en acción</h2>
            <p className="text-gray-500 mt-3">Así se ve OctoApp por dentro. Potente, limpio y fácil de usar.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-10 items-center mb-20">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold mb-4">
                <BarChart3 className="h-3.5 w-3.5" /> Dashboard ejecutivo
              </div>
              <h3 className="text-2xl font-bold mb-3">Visibilidad total de tu negocio</h3>
              <p className="text-gray-500 mb-6 leading-relaxed">
                KPIs en tiempo real, tendencia de ventas, ranking de vendedores, alertas de stock bajo mínimo
                y utilidad neta. Todo en un solo vistazo.
              </p>
              <ul className="space-y-2.5">
                {['Ventas, cobros y gastos por período', 'Top productos y mejores clientes', 'Filtros por vendedor y fecha', 'Alertas automáticas de inventario'].map(t => (
                  <li key={t} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 shrink-0" style={{ color: 'hsl(152, 56%, 38%)' }} /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <LiveDashboardMockup />
          </div>

          <div className="grid md:grid-cols-2 gap-10 items-center mb-20">
            <div className="md:order-1"><LiveMobileApp /></div>
            <div className="md:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold mb-4">
                <Smartphone className="h-3.5 w-3.5" /> App para vendedores
              </div>
              <h3 className="text-2xl font-bold mb-3">Tu vendedor vende desde el celular</h3>
              <p className="text-gray-500 mb-6 leading-relaxed">
                Módulo móvil optimizado para trabajo en campo. Funciona sin internet y sincroniza
                automáticamente cuando hay conexión.
              </p>
              <ul className="space-y-2.5">
                {['Modo offline completo', 'Venta rápida con pedido sugerido', 'Cobro en efectivo y transferencia', 'GPS y navegación al cliente'].map(t => (
                  <li key={t} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 shrink-0" style={{ color: 'hsl(152, 56%, 38%)' }} /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold mb-4">
                <Route className="h-3.5 w-3.5" /> Optimización de rutas
              </div>
              <h3 className="text-2xl font-bold mb-3">Ahorra gasolina y tiempo</h3>
              <p className="text-gray-500 mb-6 leading-relaxed">
                Optimización inteligente con Google Maps. Selecciona el día, los clientes y el punto
                de partida — y obtén la ruta más eficiente al instante.
              </p>
              <ul className="space-y-2.5">
                {['Algoritmo de Google Routes API', 'Ruta trazada en el mapa', 'Marcadores numerados por orden', 'Actualización automática del orden de visita'].map(t => (
                  <li key={t} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 shrink-0" style={{ color: 'hsl(152, 56%, 38%)' }} /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <LiveSupervisorMap />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6" style={{ background: 'hsl(220, 14%, 97%)' }}>

        <div className="max-w-6xl mx-auto">

          {/* Section header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-5 tracking-widest bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Zap className="h-3.5 w-3.5" /> PRECIOS DE LANZAMIENTO — TIEMPO LIMITADO
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-gray-900 leading-tight">
              Todo lo que necesitas.<br />
              <span style={{ color: 'hsl(230, 55%, 52%)' }}>A un precio que sorprende.</span>
            </h2>
            <p className="mt-4 text-lg max-w-xl mx-auto text-gray-500">
              Empieza hoy por menos de lo que cuesta un café al día. Sin contratos, sin sorpresas.
            </p>
          </div>

          {/* Trust bar */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 mb-14">
            {[
              { icon: Shield, text: '7 días de prueba gratis' },
              { icon: Zap, text: 'Configuración en 5 minutos' },
              { icon: Users, text: 'Sin tarjeta de crédito' },
              { icon: Check, text: 'Cancela cuando quieras' },
            ].map(t => (
              <div key={t.text} className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <t.icon className="h-3.5 w-3.5 text-emerald-500" />
                {t.text}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

            {/* ── CARD 1: OCTO POS BASE ── */}
            <div className="relative rounded-3xl bg-white border-2 border-indigo-500 shadow-xl shadow-indigo-500/10 flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1">
              {/* Gradient top bar */}
              <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, hsl(230, 70%, 52%), hsl(260, 65%, 60%))' }} />

              {/* Popular badge */}
              <div className="absolute top-5 right-5 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                MÁS POPULAR
              </div>

              <div className="p-7 flex flex-col flex-1">
                <div className="mb-5">
                  <div className="text-[10px] font-bold tracking-[0.2em] text-indigo-400 mb-1">PLAN BASE</div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">Octo POS</h3>
                  <p className="text-xs text-gray-500 mt-1">El cerebro de tu distribuidora</p>
                </div>

                {/* Price block */}
                <div className="rounded-2xl p-4 mb-5 bg-indigo-50 border border-indigo-100">
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-5xl font-black tracking-tight leading-none" style={{ color: 'hsl(230, 55%, 52%)' }}>$249</span>
                    <span className="text-sm font-semibold text-gray-500 pb-1">/mes + IVA</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm line-through text-gray-400">$500 MXN</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full text-white"
                      style={{ background: 'linear-gradient(90deg, hsl(5, 80%, 55%), hsl(15, 85%, 55%))' }}>
                      <Zap className="h-2.5 w-2.5" /> 50% OFF
                    </span>
                  </div>
                  <p className="text-[10px] mt-2 text-gray-500">
                    Equivale a <strong className="text-emerald-600">$8.30 pesos al día</strong> — menos que un café.
                  </p>
                </div>

                {/* Capacity chips */}
                <div className="grid grid-cols-2 gap-2.5 mb-5">
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                    <Building2 className="h-4 w-4 shrink-0" style={{ color: 'hsl(230, 55%, 52%)' }} />
                    <div>
                      <div className="text-xs font-black text-gray-900">1 Almacén</div>
                      <div className="text-[9px] text-gray-500">Central o físico</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                    <Users className="h-4 w-4 shrink-0" style={{ color: 'hsl(230, 55%, 52%)' }} />
                    <div>
                      <div className="text-xs font-black text-gray-900">3 Usuarios</div>
                      <div className="text-[9px] text-gray-500">Acceso completo</div>
                    </div>
                  </div>
                </div>

                {/* Modules */}
                <div className="flex-1 mb-6">
                  <div className="text-[10px] font-bold tracking-widest text-gray-400 mb-3">TODO INCLUIDO — SIN EXTRAS</div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                    {[
                      'Dashboard admin', 'Punto de venta',
                      'Clientes', 'Cobranza',
                      'Productos', 'Inventario',
                      'Proveedores', 'Ctas. por pagar',
                      'Reportes', 'Tickets',
                      'WhatsApp', 'Facturación 4.0',
                    ].map(m => (
                      <div key={m} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">{m}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link to="/signup"
                  className="block w-full text-center py-4 rounded-2xl text-sm font-black text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, hsl(230, 70%, 52%), hsl(255, 65%, 58%))', boxShadow: '0 8px 24px hsl(230, 70%, 52% / 0.35)' }}>
                  Comenzar 7 días gratis 🚀
                </Link>
                <p className="text-center text-[10px] text-gray-400 mt-2">Sin tarjeta. Cancela cuando quieras.</p>
              </div>
            </div>

            {/* ── CARD 2: ADICIONALES ── */}
            <div className="relative rounded-3xl bg-white border border-gray-200 shadow-sm flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, hsl(38, 90%, 55%), hsl(20, 85%, 58%))' }} />

              <div className="p-7 flex flex-col flex-1">
                <div className="mb-5">
                  <div className="text-[10px] font-bold tracking-[0.2em] text-amber-500 mb-1">ESCALA A TU RITMO</div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">Adicionales</h3>
                  <p className="text-xs text-gray-500 mt-1">Agrega solo lo que necesitas, cuando lo necesitas</p>
                </div>

                <div className="space-y-3 mb-4">
                  {/* Usuario adicional */}
                  <div className="rounded-2xl p-4 bg-gray-50 border border-gray-100">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50 border border-amber-100 shrink-0">
                          <Users className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <div className="text-sm font-black text-gray-900">Usuario Adicional</div>
                          <div className="text-[10px] text-gray-500">Oficina o supervisor</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xl font-black text-gray-900">$50</div>
                        <div className="text-[9px] text-gray-400">MXN / mes + IVA</div>
                      </div>
                    </div>
                  </div>

                  {/* Almacén extra */}
                  <div className="rounded-2xl p-4 bg-gray-50 border border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-100 shrink-0">
                          <Building2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <div className="text-sm font-black text-gray-900">Almacén Extra</div>
                          <div className="text-[10px] text-gray-500">Inventario por sucursal</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xl font-black text-gray-900">$200</div>
                        <div className="text-[9px] text-gray-400">MXN / mes + IVA</div>
                      </div>
                    </div>
                    <div className="space-y-1 border-t border-gray-200 pt-2.5">
                      {['Vista multi-almacén unificada', 'Traspasos de mercancía'].map(f => (
                        <div key={f} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <Check className="h-3 w-3 text-emerald-500 shrink-0" /> {f}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* OctoRoute — branded sub-product */}
                <div className="flex-1 rounded-2xl overflow-hidden border-2 mb-6"
                  style={{ borderColor: 'hsl(152, 56%, 40%)', background: 'linear-gradient(145deg, hsl(152, 56%, 96%), hsl(180, 50%, 96%))' }}>
                  <div className="p-4">
                    {/* Header with brand */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: 'hsl(152, 56%, 38%)' }}>
                            <Route className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-base font-black" style={{ color: 'hsl(152, 56%, 25%)' }}>OctoRoute</span>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md text-white tracking-wider"
                            style={{ background: 'hsl(152, 56%, 38%)' }}>ADD-ON</span>
                        </div>
                        <p className="text-[10px] text-gray-600 pl-9 leading-snug">
                          Módulo de ventas en ruta para tu equipo de campo
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="text-xl font-black" style={{ color: 'hsl(152, 56%, 30%)' }}>$599</div>
                        <div className="text-[9px] text-gray-500 leading-tight">MXN / vehículo<br />por mes + IVA</div>
                      </div>
                    </div>

                    {/* Features unlocked */}
                    <div className="rounded-xl p-3" style={{ background: 'hsl(152, 56%, 38% / 0.08)', border: '1px solid hsl(152, 56%, 38% / 0.2)' }}>
                      <div className="text-[9px] font-black tracking-widest mb-2.5" style={{ color: 'hsl(152, 56%, 30%)' }}>
                        DESBLOQUEA EN LA APP MÓVIL —
                      </div>
                      <div className="grid grid-cols-2 gap-y-2">
                        {[
                          { icon: Smartphone, label: 'App Móvil offline' },
                          { icon: MapPin, label: 'GPS de clientes' },
                          { icon: Truck, label: 'Control de entregas' },
                          { icon: Route, label: 'Optimizador de rutas' },
                          { icon: Package, label: 'Carga / descarga' },
                          { icon: Eye, label: 'Último punto visitado' },
                        ].map(mod => (
                          <div key={mod.label} className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: 'hsl(152, 56%, 22%)' }}>
                            <mod.icon className="h-3 w-3 shrink-0" style={{ color: 'hsl(152, 56%, 38%)' }} />
                            {mod.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <Link to="/signup"
                  className="block w-full text-center py-4 rounded-2xl text-sm font-bold text-gray-700 border-2 border-gray-200 hover:border-indigo-300 hover:text-indigo-700 transition-all">
                  Armar mi plan a la medida
                </Link>
              </div>
            </div>

            {/* ── CARD 3: TIMBRES ── */}
            <div className="relative rounded-3xl bg-white border border-gray-200 shadow-sm flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, hsl(42, 90%, 55%), hsl(28, 85%, 58%))' }} />

              <div className="p-7 flex flex-col flex-1">
                <div className="mb-5">
                  <div className="text-[10px] font-bold tracking-[0.2em] text-amber-500 mb-1">FACTURACIÓN CFDI 4.0</div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">Paquete Timbres</h3>
                  <p className="text-xs text-gray-500 mt-1">Sin vencimiento · Acumúlalos a tu ritmo</p>
                </div>

                <div className="flex-1 space-y-3 mb-6">
                  {[
                    { qty: '100', price: '250', saving: null, badge: null, perUnit: '$2.50 c/u' },
                    { qty: '500', price: '1,000', saving: 'Ahorras $250', badge: 'POPULAR', perUnit: '$2.00 c/u' },
                    { qty: '1,000', price: '1,740', saving: 'Ahorras $760', badge: 'MEJOR VALOR', perUnit: '$1.74 c/u' },
                  ].map(pkg => (
                    <div key={pkg.qty}
                      className="rounded-2xl p-4 flex items-center justify-between border transition-all"
                      style={{
                        background: pkg.badge === 'MEJOR VALOR' ? 'hsl(42, 80%, 97%)' : 'hsl(220, 14%, 98%)',
                        borderColor: pkg.badge ? 'hsl(42, 70%, 75%)' : 'hsl(220, 14%, 91%)',
                      }}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-gray-900">{pkg.qty} Timbres</span>
                          {pkg.badge && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md text-white"
                              style={{ background: 'hsl(42, 75%, 50%)' }}>
                              {pkg.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] mt-0.5 text-amber-600 font-semibold">{pkg.perUnit}</div>
                        {pkg.saving && (
                          <div className="text-[9px] font-semibold text-emerald-600 mt-0.5">✓ {pkg.saving}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-gray-900">${pkg.price}</div>
                        <div className="text-[9px] text-gray-400">pesos neto</div>
                      </div>
                    </div>
                  ))}

                  {/* Integration callout */}
                  <div className="rounded-2xl p-4 bg-amber-50 border border-amber-100">
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-100 border border-amber-200 shrink-0">
                        <Zap className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <div className="text-[11px] leading-relaxed text-gray-600">
                        <span className="font-bold text-gray-900">100% integrado:</span> Emite CFDI 4.0 directo desde el POS o la app móvil. Sin salir del sistema. Sin copiar-pegar.
                      </div>
                    </div>
                  </div>
                </div>

                <Link to="/signup"
                  className="block w-full text-center py-4 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, hsl(42, 80%, 50%), hsl(28, 80%, 52%))', boxShadow: '0 6px 20px hsl(42, 70%, 50% / 0.25)' }}>
                  Comprar Timbres →
                </Link>
              </div>
            </div>

          </div>

          {/* Bottom trust row */}
          <div className="mt-12 flex flex-wrap justify-center gap-8">
            {[
              { icon: Shield, label: 'Datos seguros', sub: 'Encriptación SSL/TLS' },
              { icon: Zap, label: 'Sin contratos', sub: 'Mes a mes, sin ataduras' },
              { icon: Star, label: '500+ empresas', sub: 'Ya nos usan hoy' },
              { icon: Check, label: 'Soporte real', sub: 'Respuesta en <5 min' },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-gray-100 shadow-sm shrink-0">
                  <t.icon className="h-4 w-4" style={{ color: 'hsl(230, 55%, 52%)' }} />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">{t.label}</div>
                  <div className="text-[10px] text-gray-500">{t.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-gray-400 mt-6">
            Precios de suscripción en MXN + IVA. Paquetes de timbres son precio neto. Sin permanencia.
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Lo que dicen nuestros clientes</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-6">"{t.text}"</p>
                <div>
                  <div className="text-sm font-bold text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}, {t.company}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center rounded-3xl p-12 md:p-16 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, hsl(230, 55%, 48%), hsl(260, 45%, 52%))' }}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4">
              ¿Listo para ver tu operación en tiempo real?
            </h2>
            <p className="text-indigo-100 text-lg mb-8 max-w-xl mx-auto">
              Únete a cientos de distribuidoras que ya optimizaron su operación con OctoApp.
            </p>
            <Link to="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-base font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all"
              style={{ color: 'hsl(230, 55%, 48%)' }}>
              Crear cuenta gratis <ArrowRight className="h-5 w-5" />
            </Link>
            <p className="text-indigo-200 text-xs mt-4">7 días de prueba sin compromiso</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10 px-[max(1.5rem,env(safe-area-inset-left))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-lg font-black" style={{ color: 'hsl(230, 55%, 52%)' }}>OctoApp</span>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="#realtime" className="hover:text-gray-700">En vivo</a>
            <a href="#features" className="hover:text-gray-700">Funciones</a>
            <a href="#pricing" className="hover:text-gray-700">Precios</a>
            <Link to="/login" className="hover:text-gray-700">Iniciar sesión</Link>
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} OctoApp. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
