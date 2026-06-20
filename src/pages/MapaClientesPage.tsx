import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import SearchableSelect from '@/components/SearchableSelect';
import { GoogleMap, Marker, InfoWindow, Polyline, MarkerClusterer } from '@react-google-maps/api';
import { useClientes, useZonas, useVendedores } from '@/hooks/useClientes';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Search, Filter, MapPin, X, Users, Loader2, CheckCircle2, Navigation,
  Route, Info, Clock, TrendingUp, MapPinOff, Eye, EyeOff, ChevronDown, ChevronUp, PenLine, Check, Undo2, Trash2, UserRound, CalendarDays, AlertCircle
} from 'lucide-react';
import { cn, todayInTimezone } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import MapRecenterButton from '@/components/MapRecenterButton';
import MyLocationMarker from '@/components/MyLocationMarker';
import LiveVendedoresLayer from '@/components/LiveVendedoresLayer';
import { toast } from 'sonner';
import { useGoogleMaps } from '@/hooks/useGoogleMapsKey';
import OriginPicker, { type OriginValue } from '@/components/maps/OriginPicker';
import MultiRoutePanel, { MultiRouteOverlay, getRouteColor, type RouteResultEntry } from '@/components/maps/MultiRoutePanel';
import RouteOptimizationQuotaWidget from '@/components/RouteOptimizationQuotaWidget';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIA_HOY = (() => {
  const d = new Date().toLocaleDateString('es-MX', { weekday: 'long' });
  return d.charAt(0).toUpperCase() + d.slice(1);
})();

// Color palette for each day
const DIA_COLORS: Record<string, string> = {
  Lunes: '#0004f2',      // indigo
  Martes: '#f59e0b',     // amber
  Miércoles: '#10b981',  // emerald
  Jueves: '#ef4444',     // red
  Viernes: '#8b5cf6',    // violet
  Sábado: '#06b6d4',     // cyan
  Domingo: '#f97316',    // orange
};

function getDiaColor(day?: string) {
  if (!day) return '#9ca3af';
  const lower = day.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (lower.startsWith('lu')) return '#0004f2';      // Lunes
  if (lower.startsWith('ma')) return '#f59e0b';      // Martes
  if (lower.startsWith('mi')) return '#10b981';      // Miércoles
  if (lower.startsWith('ju')) return '#ef4444';      // Jueves
  if (lower.startsWith('vi')) return '#8b5cf6';      // Viernes
  if (lower.startsWith('sa')) return '#06b6d4';      // Sábado
  if (lower.startsWith('do')) return '#f97316';      // Domingo
  return '#9ca3af';
}

const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 23.6345, lng: -102.5528 };

type SelectionAction = 'none' | 'assign' | 'desasignar';
type SelectionPoint = { x: number; y: number };

const MIN_SELECTION_POINTS = 4;
const MIN_SELECTION_DISTANCE = 6;

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function projectLatLngToPoint(
  lat: number,
  lng: number,
  bounds: google.maps.LatLngBounds,
  width: number,
  height: number,
) {
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();

  const toWorld = (latitude: number, longitude: number) => {
    const siny = Math.sin((latitude * Math.PI) / 180);
    return {
      x: (longitude + 180) / 360,
      y: 0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI),
    };
  };

  const nw = toWorld(northEast.lat(), southWest.lng());
  const se = toWorld(southWest.lat(), northEast.lng());
  const p = toWorld(lat, lng);

  const x = ((p.x - nw.x) / (se.x - nw.x)) * width;
  const y = ((p.y - nw.y) / (se.y - nw.y)) * height;

  return { x, y };
}

function pointInPolygon(point: SelectionPoint, polygon: SelectionPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > point.y !== yj > point.y
      && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 0.000001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function buildSelectionMarkerSvg({
  label,
  leftColor,
  rightColor,
  borderColor = '#ffffff',
  active = false,
  selected = false,
}: {
  label?: string;
  leftColor: string;
  rightColor: string;
  borderColor?: string;
  active?: boolean;
  selected?: boolean;
}) {
  const size = selected ? 40 : active ? 36 : 32;
  const textSize = selected ? 12 : 11;
  const stroke = selected ? 3.5 : 2.5;
  const shadow = selected ? '0 0 0 3px rgba(17,24,39,.12)' : '';
  const badge = label ? `<text x="18" y="21" text-anchor="middle" fill="#fff" font-size="${textSize}" font-weight="700" font-family="Arial,sans-serif">${label}</text>` : '';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36">
      <defs>
        <clipPath id="leftHalf"><rect x="0" y="0" width="18" height="36" /></clipPath>
        <clipPath id="rightHalf"><rect x="18" y="0" width="18" height="36" /></clipPath>
      </defs>
      <circle cx="18" cy="18" r="16" fill="#ffffff" filter="${shadow ? 'url(#shadow)' : 'none'}" />
      <circle cx="18" cy="18" r="15" fill="${leftColor}" clip-path="url(#leftHalf)" />
      <circle cx="18" cy="18" r="15" fill="${rightColor}" clip-path="url(#rightHalf)" />
      <circle cx="18" cy="18" r="15" fill="none" stroke="${borderColor}" stroke-width="${stroke}" />
      ${badge}
      ${selected ? '<circle cx="18" cy="18" r="6" fill="rgba(255,255,255,.18)" />' : ''}
    </svg>`;

  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// KPI Card component
function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-sm
      px-2 py-1.5 md:px-4 md:py-3 min-w-0 md:min-w-[140px]">
      {/* Mobile: compact horizontal */}
      <div className="flex md:hidden items-center gap-1.5">
        <div className={cn("w-5 h-5 rounded-md flex items-center justify-center shrink-0", color)}>
          <Icon className="h-2.5 w-2.5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-[8px] uppercase tracking-wider font-semibold text-muted-foreground leading-tight">{label}</div>
          <div className="text-xs font-bold text-foreground leading-tight">{value}</div>
        </div>
      </div>
      {/* Desktop: vertical with subtitle */}
      <div className="hidden md:block">
        <div className="flex items-center gap-2 mb-1">
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", color)}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</span>
        </div>
        <div className="text-xl font-bold text-foreground leading-tight">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function MapaClientesPage() {
  const { user, empresa } = useAuth();
  const { isLoaded } = useGoogleMaps();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [zonaFilter, setZonaFilter] = useState('');
  const [vendedorFilter, setVendedorFilter] = useState('');
  const [diaFilter, setDiaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<any | null>(null);
  const [originPoint, setOriginPoint] = useState<OriginValue | null>(null);
  const [settingOrigin, setSettingOrigin] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [routeResult, setRouteResult] = useState<{
    orderedIds: string[];
    polyline: string | null;
    distance_meters: number;
    duration: string;
  } | null>(null);
  const [showRoutePanel, setShowRoutePanel] = useState(true);
  const [colorMode, setColorMode] = useState<'dia' | 'status' | 'visitado'>('visitado');
  // Multi-route state
  const [optimMode, setOptimMode] = useState<'common' | 'individual'>('common');
  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [multiResults, setMultiResults] = useState<RouteResultEntry[] | null>(null);
  const [routeVisibility, setRouteVisibility] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectionAction, setSelectionAction] = useState<SelectionAction>('none');
  const [selectionVendorId, setSelectionVendorId] = useState('');
  const [selectionDay, setSelectionDay] = useState('');
  const [selectionPath, setSelectionPath] = useState<SelectionPoint[]>([]);
  const [selectionClientIds, setSelectionClientIds] = useState<string[]>([]);
  const [selectionDragging, setSelectionDragging] = useState(false);
  const [selectionSaving, setSelectionSaving] = useState(false);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [desasignarVendor, setDesasignarVendor] = useState(true);
  const [desasignarDay, setDesasignarDay] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const activePointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const isPanningRef = useRef<boolean>(false);
  const lastPanPointRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number | null>(null);
  const pinchMidpointRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const wasPinchingRef = useRef<boolean>(false);

  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role_id, roles(nombre, es_sistema)')
        .eq('user_id', user!.id);
      if (!data || data.length === 0) return true;
      return data.some((ur: any) => {
        const roleName = ur.roles?.nombre?.toLowerCase?.() ?? '';
        return ur.roles?.es_sistema === true || roleName.includes('admin');
      });
    },
    enabled: !!user?.id,
  });

  // Today's ventas to determine "visited" clients
  const { data: ventasHoy } = useQuery({
    queryKey: ['ventas-hoy', empresa?.id],
    enabled: !!empresa?.id,
    refetchInterval: 15000,
    queryFn: async () => {
      const today = todayInTimezone(empresa?.zona_horaria);
      const { data } = await supabase
        .from('ventas')
        .select('cliente_id')
        .eq('empresa_id', empresa!.id)
        .eq('fecha', today)
        .neq('status', 'cancelado')
        .not('cliente_id', 'is', null);
      return new Set((data ?? []).map((v: any) => v.cliente_id));
    },
  });

  const { data: clientes, isLoading } = useClientes(search, statusFilter || undefined);
  const { data: zonas } = useZonas();
  const { data: vendedores } = useVendedores();

  const vendorColorMap = useMemo(() => {
    const sortedVendors = [...(vendedores ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const map = new Map<string, string>();
    sortedVendors.forEach((vendor, index) => {
      map.set(vendor.id, getRouteColor(index));
    });
    return map;
  }, [vendedores]);

  const visibleClients = useMemo(() => {
    return (clientes ?? []).filter((c: any) => c.gps_lat && c.gps_lng && (!zonaFilter || c.zona_id === zonaFilter));
  }, [clientes, zonaFilter]);

  const selectionCandidates = useMemo(() => {
    let result = visibleClients;
    if (vendedorFilter) result = result.filter((c: any) => c.vendedor_id === vendedorFilter);
    if (diaFilter) result = result.filter((c: any) => c.dia_visita?.some((d: string) => d.toLowerCase() === diaFilter.toLowerCase()));
    return result;
  }, [visibleClients, vendedorFilter, diaFilter]);

  const markerDisplayMode = useMemo(() => {
    if (colorMode !== 'dia') return colorMode;
    if (vendedorFilter) return 'day-dominant' as const;
    if (diaFilter) return 'vendor-dominant' as const;
    return 'split' as const;
  }, [colorMode, vendedorFilter, diaFilter]);

  // Load saved route order for current day/vendedor combination
  const { data: savedOrder, refetch: refetchSavedOrder } = useQuery({
    queryKey: ['cliente-orden-ruta', empresa?.id, diaFilter, vendedorFilter],
    enabled: !!empresa?.id,
    queryFn: async () => {
      let q = supabase
        .from('cliente_orden_ruta' as any)
        .select('cliente_id, orden, vendedor_id, origin_lat, origin_lng, origin_label, polyline, distance_meters, duration')
        .eq('empresa_id', empresa!.id)
        .order('vendedor_id', { ascending: true, nullsFirst: false })
        .order('orden', { ascending: true });
      q = diaFilter ? q.eq('dia', diaFilter) : q.is('dia', null);
      // If a vendedor filter is set, restrict; otherwise return ALL groups so multi-route persists
      if (vendedorFilter) q = q.eq('vendedor_id', vendedorFilter);
      const { data } = await q;
      return ((data ?? []) as unknown) as {
        cliente_id: string;
        orden: number;
        vendedor_id: string | null;
        origin_lat: number | null;
        origin_lng: number | null;
        origin_label: string | null;
        polyline: string | null;
        distance_meters: number;
        duration: string;
      }[];
    },
  });



  const filtered = useMemo(() => {
    let result = clientes ?? [];
    if (zonaFilter) result = result.filter((c: any) => c.zona_id === zonaFilter);
    if (vendedorFilter) result = result.filter((c: any) => c.vendedor_id === vendedorFilter);
    if (diaFilter) result = result.filter((c: any) => c.dia_visita?.some((d: string) => d.toLowerCase() === diaFilter.toLowerCase()));
    return result;
  }, [clientes, zonaFilter, vendedorFilter, diaFilter]);

  const withGps = useMemo(() => filtered.filter((c: any) => c.gps_lat && c.gps_lng), [filtered]);

  const mapCenter = useMemo(() => {
    return withGps.length > 0 ? { lat: withGps[0].gps_lat, lng: withGps[0].gps_lng } : defaultCenter;
  }, [withGps[0]?.gps_lat, withGps[0]?.gps_lng]);
  const withoutGps = useMemo(() => filtered.filter((c: any) => !c.gps_lat || !c.gps_lng), [filtered]);

  const todayClients = useMemo(() => filtered.filter((c: any) => c.dia_visita?.some((d: string) => d.toLowerCase() === DIA_HOY.toLowerCase())), [filtered]);
  const visitedCount = useMemo(() => {
    if (!ventasHoy) return 0;
    return todayClients.filter((c: any) => ventasHoy.has(c.id)).length;
  }, [todayClients, ventasHoy]);

  const activeFiltersCount = [zonaFilter, vendedorFilter, diaFilter, statusFilter].filter(Boolean).length;

  // Drag and drop states for route stops
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  /**
   * Resolve the origin for a vendedor in INDIVIDUAL mode.
   * Strategy: vendor's profiles.almacen_id with gps → fallback to first almacen with gps → fallback to common origin.
   */
  const resolveIndividualOrigin = useCallback(async (vendedor_id: string): Promise<OriginValue | null> => {
    if (vendedor_id === '__sin_vendedor__') return originPoint;
    const { data: prof } = await (supabase
      .from('profiles') as any)
      .select('almacen_id, almacenes:almacen_id (id, nombre, gps_lat, gps_lng)')
      .eq('id', vendedor_id)
      .maybeSingle();
    const a = prof?.almacenes;
    if (a?.gps_lat != null && a?.gps_lng != null) {
      return { lat: Number(a.gps_lat), lng: Number(a.gps_lng), label: a.nombre };
    }
    return originPoint;
  }, [originPoint]);

  /** Persist the optimized order(s) into cliente_orden_ruta */
  const persistOrder = useCallback(async (groups: { vendedor_id: string | null; ordered: string[]; origin?: OriginValue | null }[]) => {
    for (const g of groups) {
      let delQ = (supabase.from('cliente_orden_ruta' as any) as any)
        .delete().eq('empresa_id', empresa!.id);
      delQ = diaFilter ? delQ.eq('dia', diaFilter) : delQ.is('dia', null);
      delQ = g.vendedor_id ? delQ.eq('vendedor_id', g.vendedor_id) : delQ.is('vendedor_id', null);
      await delQ;
      const rows = g.ordered.map((id, idx) => ({
        empresa_id: empresa!.id,
        cliente_id: id,
        dia: diaFilter || null,
        vendedor_id: g.vendedor_id,
        origin_lat: g.origin?.lat ?? null,
        origin_lng: g.origin?.lng ?? null,
        origin_label: g.origin?.label ?? null,
        orden: idx + 1,
      }));
      if (rows.length > 0) {
        await (supabase.from('cliente_orden_ruta' as any) as any).insert(rows);
      }
    }
  }, [empresa, diaFilter]);

  const fetchSingleRouteDetails = useCallback(async (orderedIds: string[], overrideOrigin?: OriginValue | null) => {
    if (orderedIds.length === 0) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const origin = overrideOrigin ?? (vendedorFilter ? await resolveIndividualOrigin(vendedorFilter) : null) ?? originPoint;
      if (!origin) return;

      const waypoints = orderedIds
        .map(id => withGps.find((c: any) => c.id === id))
        .filter((c: any) => c?.gps_lat && c?.gps_lng)
        .map((c: any) => ({ id: c.id, lat: Number(c.gps_lat), lng: Number(c.gps_lng) }));

      if (waypoints.length === 0) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/optimize-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          routes: [{ key: vendedorFilter || 'default', origin: { lat: origin.lat, lng: origin.lng }, waypoints, preserve_order: true }],
          dia_filtro: diaFilter || null,
        }),
      });
      if (!res.ok) return;
      const result = await res.json();
      const r = result.routes?.[0];
      if (r && !r.error) {
        setRouteResult(prev => {
          if (!prev) return null;
          if (JSON.stringify(prev.orderedIds) !== JSON.stringify(orderedIds)) return prev;
          return {
            ...prev,
            polyline: r.polyline ?? null,
            distance_meters: r.distance_meters ?? 0,
            duration: r.duration ?? '0s',
          };
        });

        // Cache the newly fetched polyline back to the database so next reload doesn't hit the API
        if (r.polyline) {
          let q = supabase.from('cliente_orden_ruta').update({
            polyline: r.polyline,
            distance_meters: r.distance_meters ?? 0,
            duration: r.duration ?? '0s',
          }).eq('empresa_id', empresa!.id);
          
          if (vendedorFilter) q = q.eq('vendedor_id', vendedorFilter);
          else q = q.is('vendedor_id', null);
          
          if (diaFilter) q = q.eq('dia', diaFilter);
          else q = q.is('dia', null);
          
          q.then(({ error }) => {
            if (error) console.error('Failed to cache polyline:', error);
          });
        }
      }
    } catch (err) {
      console.warn('Could not fetch street polyline:', err);
    }
  }, [vendedorFilter, resolveIndividualOrigin, originPoint, withGps, diaFilter]);

  const handleMoveStop = async (idx: number, direction: 'up' | 'down') => {
    if (!routeResult) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= routeResult.orderedIds.length) return;

    const newOrderedIds = [...routeResult.orderedIds];
    const temp = newOrderedIds[idx];
    newOrderedIds[idx] = newOrderedIds[targetIdx];
    newOrderedIds[targetIdx] = temp;

    // 1. Update local state immediately
    setRouteResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        orderedIds: newOrderedIds,
      };
    });

    // 2. Persist to DB
    const origin = (vendedorFilter ? await resolveIndividualOrigin(vendedorFilter) : null) ?? originPoint;
    await persistOrder([{ vendedor_id: vendedorFilter || null, ordered: newOrderedIds, origin }]);
    await refetchSavedOrder();

    // 3. Recalculate route polyline and stats in the background
    await fetchSingleRouteDetails(newOrderedIds);
  };

  const handleMoveStopDrop = async (fromIdx: number, toIdx: number) => {
    if (!routeResult) return;
    if (fromIdx === toIdx) return;
    if (fromIdx < 0 || fromIdx >= routeResult.orderedIds.length || toIdx < 0 || toIdx >= routeResult.orderedIds.length) return;

    const newOrderedIds = [...routeResult.orderedIds];
    const [movedItem] = newOrderedIds.splice(fromIdx, 1);
    newOrderedIds.splice(toIdx, 0, movedItem);

    // 1. Update local state immediately
    setRouteResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        orderedIds: newOrderedIds,
      };
    });

    // 2. Persist to DB
    const origin = (vendedorFilter ? await resolveIndividualOrigin(vendedorFilter) : null) ?? originPoint;
    await persistOrder([{ vendedor_id: vendedorFilter || null, ordered: newOrderedIds, origin }]);
    await refetchSavedOrder();

    // 3. Recalculate route polyline and stats in the background
    await fetchSingleRouteDetails(newOrderedIds);
  };

  // Restore saved route automatically when filters change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!savedOrder || savedOrder.length === 0) {
        setRouteResult(null);
        setMultiResults(null);
        return;
      }
      // Group by vendedor_id
      const groups = new Map<string, {
        rows: typeof savedOrder;
        savedOrigin: OriginValue | null;
        polyline: string | null;
        distance_meters: number;
        duration: string;
      }>();
      for (const row of savedOrder) {
        const key = row.vendedor_id ?? '__sin_vendedor__';
        if (!groups.has(key)) {
          groups.set(key, {
            rows: [],
            savedOrigin: row.origin_lat != null && row.origin_lng != null
              ? { lat: Number(row.origin_lat), lng: Number(row.origin_lng), label: row.origin_label ?? 'Origen guardado' }
              : null,
            polyline: row.polyline ?? null,
            distance_meters: row.distance_meters ?? 0,
            duration: row.duration ?? '0s',
          });
        }
        const group = groups.get(key)!;
        if (!group.savedOrigin && row.origin_lat != null && row.origin_lng != null) {
          group.savedOrigin = { lat: Number(row.origin_lat), lng: Number(row.origin_lng), label: row.origin_label ?? 'Origen guardado' };
        }
        if (!group.polyline && row.polyline) {
          group.polyline = row.polyline;
          group.distance_meters = row.distance_meters ?? 0;
          group.duration = row.duration ?? '0s';
        }
        group.rows.push(row);
      }
      // If real vendor groups exist alongside an inconsistent "__sin_vendedor__" residual group, drop the residual
      if (groups.size > 1 && groups.has('__sin_vendedor__')) {
        groups.delete('__sin_vendedor__');
      }
      const groupKeys = Array.from(groups.keys());
      if (groupKeys.length <= 1) {
        setMultiResults(null);
        const oIds = savedOrder.map(o => o.cliente_id);
        const group = groupKeys.length === 1 ? groups.get(groupKeys[0]) : null;
        const savedOrigin = group?.savedOrigin ?? null;
        if (savedOrigin) {
          setOriginPoint(prev => {
            if (!prev || prev.lat !== savedOrigin.lat || prev.lng !== savedOrigin.lng) return savedOrigin;
            return prev;
          });
        }
        setRouteResult(prev => {
          if (prev && JSON.stringify(prev.orderedIds) === JSON.stringify(oIds)) {
            // Already initialized, don't wipe out polyline
            return prev;
          }
          
          if (group && group.polyline) {
            // Fast path: polyline is already cached in the database
            return {
              orderedIds: oIds,
              polyline: group.polyline,
              distance_meters: group.distance_meters,
              duration: group.duration,
            };
          } else {
            // Slow path: polyline is missing, need to fetch from Google Maps
            if (!cancelled) {
              setTimeout(() => fetchSingleRouteDetails(oIds, savedOrigin), 0);
            }
            return {
              orderedIds: oIds,
              polyline: null,
              distance_meters: 0,
              duration: '',
            };
          }
        });
        return;
      }

      // Build initial entries using cached polyline if available
      const initialEntries: RouteResultEntry[] = groupKeys.map(vid => {
        const group = groups.get(vid)!;
        const rows = group.rows.sort((a, b) => a.orden - b.orden);
        const vendedor = vendedores?.find((v: any) => v.id === vid);
        return {
          vendedor_id: vid,
          vendedor_nombre: vendedor?.nombre ?? (vid === '__sin_vendedor__' ? 'Sin vendedor' : 'Vendedor'),
          origin: group.savedOrigin ?? { lat: 0, lng: 0, label: 'Guardado' },
          optimized_order: rows.map(r => r.cliente_id),
          polyline: group.polyline,
          distance_meters: group.distance_meters,
          duration: group.duration,
          original_distance_meters: 0,
        };
      });
      if (cancelled) return;
      setRouteResult(null);
      setMultiResults(initialEntries);
      const vis: Record<string, boolean> = {};
      initialEntries.forEach(e => { vis[e.vendedor_id] = true; });
      setRouteVisibility(vis);
      setApplied(true);

      // Background: fetch real polylines (per-street) via edge function with preserve_order=true
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return;

        // Resolve origin per route (vendor's almacén → fallback to current originPoint or first stop)
        // Build a quick lookup from clientes (effect doesn't depend on memoized clientesById to avoid TDZ)
        const clientesLookup = new Map<string, any>();
        for (const c of (clientes ?? [])) {
          if ((c as any).gps_lat != null && (c as any).gps_lng != null) clientesLookup.set((c as any).id, c);
        }

        const routesPayload = await Promise.all(initialEntries.map(async (e) => {
          let origin: { lat: number; lng: number } | null = e.origin?.lat && e.origin?.lng
            ? { lat: Number(e.origin.lat), lng: Number(e.origin.lng) }
            : null;
          if (!origin && e.vendedor_id !== '__sin_vendedor__') {
            const { data: prof } = await (supabase.from('profiles') as any)
              .select('almacenes:almacen_id (gps_lat, gps_lng, nombre)')
              .eq('id', e.vendedor_id).maybeSingle();
            const a = prof?.almacenes;
            if (a?.gps_lat != null && a?.gps_lng != null) {
              origin = { lat: Number(a.gps_lat), lng: Number(a.gps_lng) };
              e.origin = { ...origin, label: e.origin?.label ?? a.nombre ?? 'Almacén' };
            }
          }
          if (!origin && originPoint) origin = { lat: originPoint.lat, lng: originPoint.lng };
          if (!origin) {
            const firstStop = clientesLookup.get(e.optimized_order[0]);
            if (firstStop?.gps_lat != null) origin = { lat: Number(firstStop.gps_lat), lng: Number(firstStop.gps_lng) };
          }
          if (!origin) return null;
          const waypoints = e.optimized_order
            .map(cid => {
              const c = clientesLookup.get(cid);
              if (!c?.gps_lat || !c?.gps_lng) return null;
              return { id: cid, lat: Number(c.gps_lat), lng: Number(c.gps_lng) };
            })
            .filter((w): w is { id: string; lat: number; lng: number } => w !== null);
          if (waypoints.length === 0) return null;
          return { key: e.vendedor_id, origin, waypoints, preserve_order: true };
        }));

        const validRoutes = routesPayload.filter((r): r is NonNullable<typeof r> => r !== null);
        if (validRoutes.length === 0) return;

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/optimize-route`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ routes: validRoutes, dia_filtro: diaFilter || null }),
        });
        if (!res.ok) return;
        const result = await res.json();
        if (cancelled) return;
        const enriched = initialEntries.map(e => {
          const r = (result.routes ?? []).find((x: any) => x.key === e.vendedor_id);
          if (!r) return e;
          return {
            ...e,
            polyline: r.polyline ?? null,
            distance_meters: r.distance_meters ?? 0,
            duration: r.duration ?? '0s',
          };
        });
        setMultiResults(enriched);
      } catch (err) {
        console.warn('Could not fetch street polylines for saved routes:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [savedOrder, vendedores, clientes, originPoint, diaFilter, fetchSingleRouteDetails]);

  const clearSelection = useCallback(() => {
    setSelectionPath([]);
    setSelectionClientIds([]);
    setSelectionDragging(false);
    setSelectionMessage(null);
    setSelectionAction('none');
    setSelectionVendorId('');
    setSelectionDay('');
    setDesasignarVendor(true);
    setDesasignarDay(false);
  }, []);

  const projectSelectionPath = useCallback((path: SelectionPoint[]) => {
    const map = mapRef.current;
    if (!map || path.length < MIN_SELECTION_POINTS) return [];
    const bounds = map.getBounds();
    if (!bounds) return [];
    const rect = map.getDiv().getBoundingClientRect();
    return selectionCandidates.filter((client: any) => {
      const point = projectLatLngToPoint(Number(client.gps_lat), Number(client.gps_lng), bounds, rect.width, rect.height);
      return pointInPolygon(point, path);
    }).map((client: any) => client.id as string);
  }, [selectionCandidates]);

  const finalizeSelection = useCallback((path: SelectionPoint[]) => {
    if (path.length < MIN_SELECTION_POINTS) {
      setSelectionMessage('Traza un área un poco más grande para seleccionar clientes.');
      setSelectionClientIds([]);
      return;
    }
    const ids = projectSelectionPath(path);
    setSelectionClientIds(ids);
    setSelectionMessage(ids.length > 0
      ? `Se seleccionaron ${ids.length} clientes.`
      : 'No hay clientes dentro del área dibujada.');
  }, [projectSelectionPath]);

  const handleSelectionPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!selectionMode) return;
    
    // Add pointer to active pointers tracking
    activePointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    
    // Capture pointer
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (err) {
      console.warn('Could not set pointer capture:', err);
    }

    // Check if right-click panning
    if (event.button === 2 || (event.buttons & 2) !== 0) {
      isPanningRef.current = true;
      lastPanPointRef.current = { clientX: event.clientX, clientY: event.clientY };
      setSelectionDragging(false);
      setSelectionPath([]);
      setSelectionClientIds([]);
      setSelectionMessage('');
      return;
    }

    // Multi-touch gestures (pinch/pan on touch screens)
    if (activePointersRef.current.size >= 2) {
      wasPinchingRef.current = true;
      setSelectionDragging(false);
      setSelectionPath([]); // Clear any erratic selection path drawing
      
      const pointers = Array.from(activePointersRef.current.values());
      const p1 = pointers[0];
      const p2 = pointers[1];
      
      initialPinchDistanceRef.current = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
      pinchMidpointRef.current = {
        clientX: (p1.clientX + p2.clientX) / 2,
        clientY: (p1.clientY + p2.clientY) / 2,
      };
      if (mapRef.current) {
        initialPinchZoomRef.current = mapRef.current.getZoom() ?? 15;
      }
      return;
    }

    // Single touch / Left-click drawing mode
    if (activePointersRef.current.size === 1 && event.button === 0) {
      isPanningRef.current = false;
      
      if (!wasPinchingRef.current) {
        const rect = event.currentTarget.getBoundingClientRect();
        const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        setSelectionDragging(true);
        setSelectionPath([point]);
        setSelectionClientIds([]);
        setSelectionMessage('');
      }
    }
  }, [selectionMode]);

  const handleSelectionPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!selectionMode) return;

    // Update active pointer location
    activePointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    // 1. Right-click Panning
    if (isPanningRef.current || event.button === 2 || (event.buttons & 2) !== 0) {
      if (!isPanningRef.current) {
        setSelectionDragging(false);
        setSelectionPath([]);
        setSelectionClientIds([]);
        setSelectionMessage('');
      }
      isPanningRef.current = true;
      if (lastPanPointRef.current && mapRef.current) {
        const dx = event.clientX - lastPanPointRef.current.clientX;
        const dy = event.clientY - lastPanPointRef.current.clientY;
        mapRef.current.panBy(-dx, -dy);
      }
      lastPanPointRef.current = { clientX: event.clientX, clientY: event.clientY };
      return;
    }

    // 2. Multi-touch gesture handling (pinch to zoom and pan)
    if (activePointersRef.current.size >= 2) {
      wasPinchingRef.current = true;
      
      const pointers = Array.from(activePointersRef.current.values());
      const p1 = pointers[0];
      const p2 = pointers[1];

      // Pan by tracking midpoint changes
      const currentMidpoint = {
        clientX: (p1.clientX + p2.clientX) / 2,
        clientY: (p1.clientY + p2.clientY) / 2,
      };
      
      if (pinchMidpointRef.current && mapRef.current) {
        const dx = currentMidpoint.clientX - pinchMidpointRef.current.clientX;
        const dy = currentMidpoint.clientY - pinchMidpointRef.current.clientY;
        mapRef.current.panBy(-dx, -dy);
      }
      pinchMidpointRef.current = currentMidpoint;

      // Pinch to zoom
      const currentDistance = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
      if (initialPinchDistanceRef.current && initialPinchDistanceRef.current > 0 && initialPinchZoomRef.current !== null && mapRef.current) {
        const scale = currentDistance / initialPinchDistanceRef.current;
        const zoomDiff = Math.log2(scale);
        const newZoom = initialPinchZoomRef.current + zoomDiff;
        mapRef.current.setZoom(Math.max(1, Math.min(21, newZoom)));
      }
      return;
    }

    // 3. Selection Drawing (Left-click or single touch)
    if (selectionDragging && activePointersRef.current.size === 1) {
      if (wasPinchingRef.current) return; // Ignore draw gestures after pinching
      
      const rect = event.currentTarget.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      
      setSelectionPath(prev => {
        const last = prev[prev.length - 1];
        if (last) {
          const dx = last.x - point.x;
          const dy = last.y - point.y;
          if (Math.sqrt(dx * dx + dy * dy) < MIN_SELECTION_DISTANCE) return prev;
        }
        const next = [...prev, point];
        if (selectionMode) finalizeSelection(next);
        return next;
      });
    }
  }, [selectionMode, selectionDragging, finalizeSelection]);

  const handleSelectionPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    // Remove pointer from tracker
    activePointersRef.current.delete(event.pointerId);
    
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}

    // When all contacts are lifted, reset everything
    if (activePointersRef.current.size === 0) {
      isPanningRef.current = false;
      lastPanPointRef.current = null;
      initialPinchDistanceRef.current = null;
      initialPinchZoomRef.current = null;
      pinchMidpointRef.current = null;
      
      if (selectionDragging && !wasPinchingRef.current) {
        setSelectionDragging(false);
        setSelectionPath(prev => {
          finalizeSelection(prev);
          return prev;
        });
      } else {
        setSelectionDragging(false);
      }
      wasPinchingRef.current = false;
    } else {
      // If we are down to 1 pointer, clear pinch helpers, but keep wasPinching flag so it doesn't draw
      initialPinchDistanceRef.current = null;
      initialPinchZoomRef.current = null;
      pinchMidpointRef.current = null;
    }
  }, [finalizeSelection, selectionDragging]);

  const applySelectionAction = useCallback(async () => {
    if (!empresa?.id) return;
    if (selectionClientIds.length === 0) {
      setSelectionMessage('Primero dibuja una zona con clientes dentro.');
      return;
    }
    if (selectionAction === 'none') {
      setSelectionMessage('Elige una acción para aplicar a la selección.');
      return;
    }

    setSelectionSaving(true);
    try {
      let changedVendor = false;
      let changedDay = false;

      if (selectionAction === 'assign') {
        if (!selectionVendorId && !selectionDay) {
          setSelectionMessage('Selecciona al menos un vendedor o un día.');
          return;
        }

        const payload: Record<string, any> = {};
        if (selectionVendorId) {
          payload.vendedor_id = selectionVendorId;
          changedVendor = true;
        }

        if (Object.keys(payload).length > 0) {
          const { error } = await supabase
            .from('clientes')
            .update(payload as any)
            .eq('empresa_id', empresa.id)
            .in('id', selectionClientIds);
          if (error) throw error;
        }

        if (selectionDay) {
          const { error } = await supabase
            .from('clientes')
            .update({ dia_visita: [selectionDay] } as any)
            .eq('empresa_id', empresa.id)
            .in('id', selectionClientIds);
          if (error) throw error;
          changedDay = true;
        }

        if (changedVendor) {
          await (supabase.from('cliente_orden_ruta' as any) as any)
            .delete()
            .eq('empresa_id', empresa.id)
            .in('cliente_id', selectionClientIds);
        }
      }

      if (selectionAction === 'desasignar') {
        if (!desasignarVendor && !desasignarDay) {
          setSelectionMessage('Selecciona al menos una opción para desasignar.');
          return;
        }

        const payload: Record<string, any> = {};
        if (desasignarVendor) {
          payload.vendedor_id = null;
        }
        if (desasignarDay) {
          payload.dia_visita = null;
        }

        if (Object.keys(payload).length > 0) {
          const { error } = await supabase
            .from('clientes')
            .update(payload as any)
            .eq('empresa_id', empresa.id)
            .in('id', selectionClientIds);
          if (error) throw error;
        }

        if (desasignarVendor || desasignarDay) {
          await (supabase.from('cliente_orden_ruta' as any) as any)
            .delete()
            .eq('empresa_id', empresa.id)
            .in('cliente_id', selectionClientIds);
        }
      }

      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['clientes-page'] });
      qc.invalidateQueries({ queryKey: ['cliente-orden-ruta'] });
      qc.invalidateQueries({ queryKey: ['ventas'] });
      
      const parts: string[] = [];
      if (selectionAction === 'assign') {
        if (changedVendor) parts.push('vendedor');
        if (changedDay) parts.push('día');
      } else if (selectionAction === 'desasignar') {
        if (desasignarVendor) parts.push('vendedor');
        if (desasignarDay) parts.push('día');
      }

      let message = '';
      if (selectionAction === 'desasignar') {
        message = `Se desasignó ${parts.join(' y ')} para ${selectionClientIds.length} clientes.`;
      } else {
        message = `Se actualizaron ${selectionClientIds.length} clientes (${parts.join(' y ') || 'sin cambios'}).`;
      }
      toast.success(message);
      
      setSelectionMode(false);
      clearSelection();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo aplicar la selección');
    } finally {
      setSelectionSaving(false);
    }
  }, [clearSelection, empresa?.id, qc, selectionAction, selectionClientIds, selectionDay, selectionMode, selectionVendorId, desasignarVendor, desasignarDay]);

  useEffect(() => {
    if (!selectionMode) {
      clearSelection();
      activePointersRef.current.clear();
      isPanningRef.current = false;
      lastPanPointRef.current = null;
      initialPinchDistanceRef.current = null;
      initialPinchZoomRef.current = null;
      pinchMidpointRef.current = null;
      wasPinchingRef.current = false;
    }
  }, [selectionMode, clearSelection]);

  const getClientPalette = useCallback((cliente: any) => {
    const vendorId = cliente.vendedor_id || '__sin_vendedor__';
    const vendorColor = cliente.vendedor_id ? (vendorColorMap.get(vendorId) ?? '#9ca3af') : '#9ca3af';
    const dayCandidates = Array.isArray(cliente.dia_visita) ? cliente.dia_visita : [];
    const hasFilterDay = diaFilter && dayCandidates.some((d: string) => d.toLowerCase() === diaFilter.toLowerCase());
    const hasToday = dayCandidates.some((d: string) => d.toLowerCase() === DIA_HOY.toLowerCase());
    const preferredDay = diaFilter && hasFilterDay
      ? diaFilter
      : (hasToday ? DIA_HOY : dayCandidates[0]);
    const dayColor = getDiaColor(preferredDay);

    if (colorMode === 'visitado') {
      return { left: ventasHoy?.has(cliente.id) ? '#22c55e' : '#ef4444', right: ventasHoy?.has(cliente.id) ? '#22c55e' : '#ef4444', labelColor: '#fff' };
    }

    if (colorMode === 'status') {
      const s = cliente.status ?? 'activo';
      const statusColor = s === 'activo' ? '#22c55e' : s === 'suspendido' ? '#ef4444' : '#9ca3af';
      return { left: statusColor, right: statusColor, labelColor: '#fff' };
    }

    if (markerDisplayMode === 'day-dominant') {
      return { left: dayColor, right: dayColor, accent: vendorColor, labelColor: '#fff' };
    }

    if (markerDisplayMode === 'vendor-dominant') {
      return { left: vendorColor, right: vendorColor, accent: dayColor, labelColor: '#fff' };
    }

    return { left: dayColor, right: vendorColor, accent: null, labelColor: '#fff' };
  }, [colorMode, diaFilter, markerDisplayMode, vendorColorMap, ventasHoy]);

  const getClientMarkerIcon = useCallback((cliente: any, options?: { selected?: boolean; active?: boolean; label?: string }) => {
    const palette = getClientPalette(cliente);
    const selected = !!options?.selected;
    const active = !!options?.active;
    const label = options?.label;

    if (colorMode === 'dia' && markerDisplayMode === 'split') {
      return buildSelectionMarkerSvg({
        label,
        leftColor: palette.left,
        rightColor: palette.right,
        selected,
        active,
        borderColor: cliente.vendedor_id ? '#ffffff' : '#cbd5e1',
      });
    }

    return buildSelectionMarkerSvg({
      label,
      leftColor: palette.left,
      rightColor: palette.right,
      selected,
      active,
      borderColor: palette.accent ?? '#ffffff',
    });
  }, [colorMode, getClientPalette, markerDisplayMode]);

  const onMapLoad = useCallback((map: google.maps.Map) => { mapRef.current = map; }, []);

  useEffect(() => {
    if (mapRef.current && withGps.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      withGps.forEach((c: any) => bounds.extend({ lat: c.gps_lat, lng: c.gps_lng }));
      if (originPoint) bounds.extend(originPoint);
      mapRef.current.fitBounds(bounds, 50);
    }
  }, [withGps, originPoint]);

  const handleRecenter = useCallback(() => {
    if (mapRef.current && withGps.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      withGps.forEach((c: any) => bounds.extend({ lat: c.gps_lat, lng: c.gps_lng }));
      if (originPoint) bounds.extend(originPoint);
      mapRef.current.fitBounds(bounds, 50);
    }
  }, [withGps, originPoint]);

  const polylinePoints = useMemo(() => {
    if (!routeResult) return null;
    if (routeResult.polyline) return decodePolyline(routeResult.polyline);

    // Fallback: straight lines
    const fallback: { lat: number; lng: number }[] = [];
    if (originPoint) fallback.push({ lat: originPoint.lat, lng: originPoint.lng });

    const lookup = new Map<string, any>();
    for (const c of withGps) lookup.set(c.id, c);

    for (const cid of routeResult.orderedIds) {
      const c = lookup.get(cid);
      if (c && c.gps_lat != null && c.gps_lng != null) {
        fallback.push({ lat: Number(c.gps_lat), lng: Number(c.gps_lng) });
      }
    }
    return fallback.length >= 2 ? fallback : null;
  }, [routeResult, originPoint, withGps]);

  const orderedClients = useMemo(() => {
    if (!routeResult) return null;
    return routeResult.orderedIds.map(id => withGps.find((c: any) => c.id === id)).filter(Boolean);
  }, [routeResult, withGps]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (settingOrigin && e.latLng) {
      setOriginPoint({ lat: e.latLng.lat(), lng: e.latLng.lng(), label: 'Punto en mapa' });
      setSettingOrigin(false);
      setRouteResult(null);
      setMultiResults(null);
      toast.success('Punto de partida establecido');
    }
  }, [settingOrigin]);

  // Group clients by vendedor for multi-route mode
  const clientsByVendedor = useMemo(() => {
    const map = new Map<string, { vendedor_id: string; vendedor_nombre: string; clientes: any[] }>();
    for (const c of withGps) {
      const vid = c.vendedor_id || '__sin_vendedor__';
      const vname = c.vendedores?.nombre || 'Sin vendedor';
      if (!map.has(vid)) map.set(vid, { vendedor_id: vid, vendedor_nombre: vname, clientes: [] });
      map.get(vid)!.clientes.push(c);
    }
    return Array.from(map.values()).filter(g => g.clientes.length > 0);
  }, [withGps]);

  const clientesById = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of withGps) m.set(c.id, c);
    return m;
  }, [withGps]);

  const isMultiVendor = clientsByVendedor.length > 1 && !vendedorFilter;



  const handleOptimize = async () => {
    if (!originPoint) { toast.error('Primero establece un punto de partida'); return; }
    if (withGps.length < 1) { toast.error('Se necesita al menos 1 cliente con GPS'); return; }
    setOptimizing(true);
    setRouteResult(null);
    setMultiResults(null);
    setApplied(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { toast.error('Sesión no válida'); return; }

      // Build payload: one route per vendedor (or single 'default' route)
      const groups = isMultiVendor ? clientsByVendedor : [{
        vendedor_id: vendedorFilter || 'default',
        vendedor_nombre: vendedorFilter
          ? (vendedores?.find(v => v.id === vendedorFilter)?.nombre ?? 'Vendedor')
          : 'Todos',
        clientes: withGps,
      }];

      const routes = await Promise.all(groups.map(async (g) => {
        const origin = optimMode === 'individual' && isMultiVendor
          ? (await resolveIndividualOrigin(g.vendedor_id)) ?? originPoint
          : originPoint;
        return {
          key: g.vendedor_id,
          origin: { lat: origin.lat, lng: origin.lng },
          waypoints: g.clientes.map((c: any) => ({ id: c.id, lat: c.gps_lat, lng: c.gps_lng, colonia: c.colonia ?? null })),
          _origin_full: origin,
          _vendedor_nombre: g.vendedor_nombre,
        };
      }));

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/optimize-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          routes: routes.map(r => ({ key: r.key, origin: r.origin, waypoints: r.waypoints })),
          dia_filtro: diaFilter || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || 'Error al optimizar'); return; }

      const entries: RouteResultEntry[] = (result.routes ?? []).map((r: any) => {
        const meta = routes.find(x => x.key === r.key)!;
        return {
          vendedor_id: r.key,
          vendedor_nombre: meta._vendedor_nombre,
          origin: meta._origin_full,
          optimized_order: r.optimized_order ?? [],
          polyline: r.polyline ?? null,
          distance_meters: r.distance_meters ?? 0,
          duration: r.duration ?? '0s',
          original_distance_meters: r.original_distance_meters ?? 0,
          error: r.error,
        };
      });

      // Multi-route view when more than one vendor
      if (entries.length > 1) {
        setMultiResults(entries);
        const vis: Record<string, boolean> = {};
        entries.forEach(e => { vis[e.vendedor_id] = true; });
        setRouteVisibility(vis);
        toast.success(`${entries.length} rutas optimizadas`);
      } else {
        const e = entries[0];
        if (e?.error) { toast.error(e.error); return; }
        setRouteResult({
          orderedIds: e.optimized_order,
          polyline: e.polyline,
          distance_meters: e.distance_meters,
          duration: e.duration,
        });
        setShowRoutePanel(true);
        toast.success(`Ruta optimizada: ${(e.distance_meters / 1000).toFixed(1)} km`);
        // Persist immediately for single-route flow (matches previous behaviour)
        await persistOrder([{ vendedor_id: vendedorFilter || null, ordered: e.optimized_order, origin: e.origin }]);
        await refetchSavedOrder();
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al optimizar ruta');
    } finally {
      setOptimizing(false);
    }
  };



  const handleApplyMulti = async () => {
    if (!multiResults) return;
    setApplying(true);
    try {
      // Wipe full scope (empresa + dia) so old rows with vendedor_id=null or stale vendor groups don't survive
      let wipeQ = (supabase.from('cliente_orden_ruta' as any) as any)
        .delete().eq('empresa_id', empresa!.id);
      wipeQ = diaFilter ? wipeQ.eq('dia', diaFilter) : wipeQ.is('dia', null);
      await wipeQ;

      const groups = multiResults
        .filter(r => !r.error && r.optimized_order.length > 0)
        .map(r => ({
          vendedor_id: r.vendedor_id === '__sin_vendedor__' ? null : r.vendedor_id,
          origin: r.origin,
          ordered: r.optimized_order,
        }));
      // Insert all rows in one go (persistOrder also deletes per-vendedor, but scope is already empty)
      const allRows = groups.flatMap(g =>
        g.ordered.map((id, idx) => ({
          empresa_id: empresa!.id,
          cliente_id: id,
          dia: diaFilter || null,
          vendedor_id: g.vendedor_id,
          origin_lat: g.origin?.lat ?? null,
          origin_lng: g.origin?.lng ?? null,
          origin_label: g.origin?.label ?? null,
          orden: idx + 1,
        }))
      );
      if (allRows.length > 0) {
        await (supabase.from('cliente_orden_ruta' as any) as any).insert(allRows);
      }
      await refetchSavedOrder();
      setApplied(true);
      toast.success(`Orden guardado para ${groups.length} ${groups.length === 1 ? 'ruta' : 'rutas'}`);
    } catch (e: any) {
      toast.error(e?.message || 'Error al aplicar cambios');
    } finally {
      setApplying(false);
    }
  };

  const formatDuration = (d?: string) => {
    if (!d) return '';
    const secs = parseInt(d.replace('s', ''));
    if (isNaN(secs)) return d;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}min` : `${m} min`;
  };

  const getMapMarkerIcon = useCallback((cliente: any, label?: string, selected = false) => {
    return getClientMarkerIcon(cliente, { label, selected, active: selectionMode && selectionClientIds.includes(cliente.id) });
  }, [getClientMarkerIcon, selectionClientIds, selectionMode]);

  // Cluster styles
  const clusterStyles = [
    { textColor: 'white', textSize: 12, width: 40, height: 40, url: '' },
    { textColor: 'white', textSize: 13, width: 48, height: 48, url: '' },
    { textColor: 'white', textSize: 14, width: 56, height: 56, url: '' },
  ];

  return (
    <div className="h-[calc(100vh-theme(spacing.9))] flex flex-col">
      {/* Compact header */}
      <div className="bg-card border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <MapPin className="h-4.5 w-4.5 text-primary" />
            <h1 className="text-base font-bold text-foreground">Mapa de clientes</h1>
          </div>

          <div className="flex-1 max-w-[200px] relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input type="text" placeholder="Buscar..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Always-visible quick filters: Día + Vendedor (key for route optimization) */}
          <div className="min-w-[150px]">
            <SearchableSelect
              options={[{ value: '', label: '📅 Todos los días' }, ...DIAS.map(d => ({ value: d, label: d === DIA_HOY ? `${d} (hoy)` : d, searchText: d }))]}
              value={diaFilter}
              onChange={val => { setDiaFilter(val); setRouteResult(null); }}
              placeholder="Día visita..."
              renderOption={(option, { selected }) => (
                <div className="flex items-center gap-2 w-full">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: option.value ? (DIA_COLORS[option.value] ?? '#9ca3af') : '#94a3b8' }} />
                  <span className={cn("truncate", selected && "font-semibold")}>{option.label}</span>
                </div>
              )}
              renderValue={(option) => (
                option ? (
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: option.value ? (DIA_COLORS[option.value] ?? '#9ca3af') : '#94a3b8' }} />
                    <span className="truncate">{option.label}</span>
                  </span>
                ) : null
              )}
            />
          </div>
          <div className="min-w-[160px]">
            <SearchableSelect
              options={[{ value: '', label: '👤 Todos vendedores', searchText: 'Todos vendedores' }, ...(vendedores ?? []).map(v => ({ value: v.id, label: v.nombre, searchText: v.nombre }))]}
              value={vendedorFilter}
              onChange={val => { setVendedorFilter(val); setRouteResult(null); }}
              placeholder="Vendedor..."
              renderOption={(option, { selected }) => {
                const color = option.value ? (vendorColorMap.get(option.value) ?? '#9ca3af') : '#94a3b8';
                return (
                  <div className="flex items-center gap-2 w-full">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className={cn("truncate", selected && "font-semibold")}>{option.label}</span>
                  </div>
                );
              }}
              renderValue={(option) => option ? (
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: option.value ? (vendorColorMap.get(option.value) ?? '#9ca3af') : '#94a3b8' }} />
                  <span className="truncate">{option.label}</span>
                </span>
              ) : null}
            />
          </div>

          <button onClick={() => setShowFilters(!showFilters)}
            className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              showFilters || zonaFilter || statusFilter ? "bg-primary/10 border-primary/30 text-primary" : "bg-background border-border text-muted-foreground")}>
            <Filter className="h-3.5 w-3.5" />Más
            {(zonaFilter || statusFilter) && <Badge className="ml-0.5 h-4 w-4 p-0 flex items-center justify-center text-[9px]">{[zonaFilter, statusFilter].filter(Boolean).length}</Badge>}
          </button>

          {/* Color mode toggle */}
          <div className="flex items-center bg-background border border-border rounded-lg overflow-hidden text-[10px] font-medium">
            {(['dia', 'visitado', 'status'] as const).map(mode => (
              <button key={mode} onClick={() => setColorMode(mode)}
                className={cn("px-2.5 py-1.5 transition-colors capitalize",
                  colorMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {mode === 'dia' ? 'Día' : mode === 'visitado' ? 'Visita' : 'Status'}
              </button>
            ))}
          </div>

          {/* Route controls */}
          <div className="flex items-center gap-1 ml-auto relative">
            {isMultiVendor && (
              <div className="flex items-center bg-background border border-border rounded-lg overflow-hidden text-[10px] font-medium">
                {(['common', 'individual'] as const).map(m => (
                  <button key={m} onClick={() => setOptimMode(m)}
                    className={cn("px-2 py-1.5 transition-colors",
                      optimMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                    title={m === 'common' ? 'Todos parten del mismo punto' : 'Cada vendedor parte de su almacén'}>
                    {m === 'common' ? 'Origen común' : 'Individual'}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => { setSelectionMode(v => !v); setSelectionMessage(null); }}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                selectionMode ? "bg-amber-500/10 border-amber-500/30 text-amber-600" : "bg-background border-border text-muted-foreground"
              )}
              title="Seleccionar clientes con lápiz"
            >
              <PenLine className="h-3.5 w-3.5" />
              Lápiz
            </button>
            <div className="relative">
              <button
                onClick={() => setShowOriginPicker(s => !s)}
                className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  originPoint ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                    : "bg-background border-border text-muted-foreground")}>
                <Navigation className="h-3.5 w-3.5" />
                {originPoint ? `✓ ${originPoint.label ?? 'Origen'}` : 'Origen'}
              </button>
              {showOriginPicker && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-20 w-72 bg-card border border-border rounded-xl shadow-lg p-3">
                  <OriginPicker
                    value={originPoint}
                    onChange={(v) => { setOriginPoint(v); setRouteResult(null); setMultiResults(null); if (v) setShowOriginPicker(false); }}
                    onPickFromMapRequest={() => { setSettingOrigin(true); setShowOriginPicker(false); toast.info('Click en el mapa'); }}
                    pickingFromMap={settingOrigin}
                  />
                </div>
              )}
            </div>
            {isAdmin && originPoint && withGps.length >= 1 && (
              <button onClick={handleOptimize} disabled={optimizing}
                className={cn("flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                  (routeResult || multiResults) ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                    : "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
                  optimizing && "opacity-70")}>
                {optimizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (routeResult || multiResults) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Route className="h-3.5 w-3.5" />}
                {optimizing ? 'Optimizando...' : multiResults ? `${multiResults.length} rutas` : routeResult ? 'Optimizada' : isMultiVendor ? 'Optimizar todas' : 'Optimizar'}
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border">
            <div className="min-w-[130px]">
              <SearchableSelect
                options={[{ value: '', label: 'Todas las zonas' }, ...(zonas ?? []).map(z => ({ value: z.id, label: z.nombre }))]}
                value={zonaFilter}
                onChange={setZonaFilter}
                placeholder="Zona..."
              />
            </div>
            <div className="min-w-[110px]">
              <SearchableSelect
                options={[{ value: '', label: 'Todo status' }, { value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }, { value: 'suspendido', label: 'Suspendido' }]}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="Status..."
              />
            </div>
            {activeFiltersCount > 0 && (
              <button onClick={() => { setZonaFilter(''); setVendedorFilter(''); setDiaFilter(''); setStatusFilter(''); }}
                className="flex items-center gap-1 text-[10px] text-destructive hover:underline py-1">
                <X className="h-2.5 w-2.5" /> Limpiar todo
              </button>
            )}
          </div>
        )}
      </div>

      {activeFiltersCount > 0 && filtered.length === 0 && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center gap-2 text-amber-800 dark:text-amber-400 text-xs font-medium animate-in slide-in-from-top duration-200 shrink-0">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <span>No se encontraron clientes para los filtros seleccionados ({[
            diaFilter && `Día: ${diaFilter}`,
            vendedorFilter && `Vendedor: ${vendedores?.find(v => v.id === vendedorFilter)?.nombre ?? 'Seleccionado'}`,
            zonaFilter && `Zona: ${zonas?.find(z => z.id === zonaFilter)?.nombre ?? 'Seleccionada'}`,
            statusFilter && `Status: ${statusFilter}`
          ].filter(Boolean).join(', ')}).</span>
          <button onClick={() => { setZonaFilter(''); setVendedorFilter(''); setDiaFilter(''); setStatusFilter(''); }}
            className="ml-auto underline hover:text-amber-950 dark:hover:text-amber-200 transition-colors font-semibold shrink-0">
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Map area */}
      <div className="flex-1 relative">
        {(isLoading || !isLoaded) && (
          <div className="absolute inset-0 z-[1000] bg-background/60 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {settingOrigin && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-emerald-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-pulse">
            Click en el mapa para el punto de partida
          </div>
        )}

        {/* Floating KPI cards — horizontal bottom on mobile, vertical left on desktop */}
        <div className="absolute bottom-14 left-2 right-2 md:bottom-auto md:right-auto md:top-3 md:left-3 z-10
          flex flex-row md:flex-col gap-1.5 md:gap-2 overflow-x-auto md:overflow-visible">
          <KpiCard icon={MapPin} label="GPS" value={withGps.length}
            sub={`${withoutGps.length} sin GPS`} color="bg-primary" />
          <KpiCard icon={Users} label="Hoy" value={todayClients.length}
            sub={`${DIA_HOY}`} color="bg-[hsl(var(--chart-4))]" />
          <KpiCard icon={CheckCircle2} label="Visitados" value={visitedCount}
            sub={todayClients.length > 0 ? `${Math.round((visitedCount / todayClients.length) * 100)}%` : '—'}
            color="bg-[hsl(var(--success))]" />
          {routeResult && (
            <>
              <KpiCard icon={TrendingUp} label="Dist." value={`${(routeResult.distance_meters / 1000).toFixed(1)}km`}
                color="bg-[hsl(var(--chart-1))]" />
              <KpiCard icon={Clock} label="Tiempo" value={formatDuration(routeResult.duration)}
                color="bg-[hsl(var(--chart-2))]" />
            </>
          )}
        </div>

        {/* Quota widget — bottom center */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden md:block max-w-[320px] w-full px-4">
          <RouteOptimizationQuotaWidget />
        </div>
        {/* Mobile: bottom center */}
        <div className="md:hidden absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] px-2 z-10">
          <RouteOptimizationQuotaWidget />
        </div>

        {selectionMode && (
          <div className="absolute inset-0 z-[60] touch-none" onContextMenu={(e) => e.preventDefault()}>
            <div
              className="absolute inset-0 cursor-crosshair touch-none"
              onPointerDown={handleSelectionPointerDown}
              onPointerMove={handleSelectionPointerMove}
              onPointerUp={handleSelectionPointerUp}
              onPointerCancel={handleSelectionPointerUp}
              onContextMenu={(e) => e.preventDefault()}
            />
            <svg className="absolute inset-0 h-full w-full pointer-events-none">
              {selectionPath.length > 1 && (
                <>
                  <path
                    d={`M ${selectionPath.map(p => `${p.x} ${p.y}`).join(' L ')} Z`}
                    fill="rgba(99, 102, 241, 0.12)"
                    stroke="#6366f1"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {selectionPath.map((point, idx) => (
                    <circle key={`${point.x}-${point.y}-${idx}`} cx={point.x} cy={point.y} r="2.5" fill="#6366f1" opacity="0.85" />
                  ))}
                </>
              )}
            </svg>
          </div>
        )}

        {/* Color legend */}
        <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-xl px-2 py-1.5 md:px-3 md:py-2 shadow-sm max-w-[calc(100vw-1rem)] overflow-x-auto hidden md:block">
          {colorMode === 'dia' && (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {DIAS.map(d => (
                <button key={d} onClick={() => setDiaFilter(diaFilter === d ? '' : d)}
                  className={cn("flex items-center gap-1 text-[10px] transition-opacity",
                    diaFilter && diaFilter !== d ? "opacity-40" : "opacity-100")}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DIA_COLORS[d] }} />
                  <span className={cn("font-medium", d === DIA_HOY && "underline")}>{d.slice(0, 3)}</span>
                </button>
              ))}
            </div>
          )}
          {colorMode === 'visitado' && (
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-[10px]">
                <div className="w-3 h-3 rounded-full bg-[#22c55e]" /><span className="font-medium">Visitado</span>
              </span>
              <span className="flex items-center gap-1.5 text-[10px]">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" /><span className="font-medium">Pendiente</span>
              </span>
            </div>
          )}
          {colorMode === 'status' && (
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-[10px]"><div className="w-3 h-3 rounded-full bg-[#22c55e]" /><span className="font-medium">Activo</span></span>
              <span className="flex items-center gap-1.5 text-[10px]"><div className="w-3 h-3 rounded-full bg-[#9ca3af]" /><span className="font-medium">Inactivo</span></span>
              <span className="flex items-center gap-1.5 text-[10px]"><div className="w-3 h-3 rounded-full bg-[#ef4444]" /><span className="font-medium">Suspendido</span></span>
            </div>
          )}
        </div>

        {isLoaded && (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={6}
            onLoad={onMapLoad}
            onClick={handleMapClick}
            options={{
              styles: [
                { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'off' }] },
              ],
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: true,
              draggableCursor: settingOrigin ? 'crosshair' : undefined,
            }}
          >
            {/* My current location (blue dot) */}
            <MyLocationMarker />
            {/* Live seller positions */}
            <LiveVendedoresLayer />

            {/* Origin */}
            {originPoint && (
              <Marker
                position={originPoint}
                icon={{ path: google.maps.SymbolPath.CIRCLE, fillColor: '#059669', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3, scale: 14 }}
                label={{ text: '▶', color: '#fff', fontSize: '10px', fontWeight: '700' }}
              />
            )}

            {/* Route polyline (single-route flow) */}
            {polylinePoints && !multiResults && (
              <Polyline path={polylinePoints} options={{ strokeColor: 'hsl(230, 55%, 52%)', strokeWeight: 4, strokeOpacity: 0.8 }} />
            )}

            {/* Multi-route overlay (polylines + numbered stops + per-route origin) */}
            {multiResults && (
              <MultiRouteOverlay
                results={multiResults}
                clientesById={clientesById}
                visibility={routeVisibility}
              />
            )}

            {/* Markers with clustering when no route is active */}
            {orderedClients ? (
              orderedClients.map((c: any, idx: number) => (
                <Marker
                  key={c.id}
                  position={{ lat: c.gps_lat, lng: c.gps_lng }}
                  icon={getMapMarkerIcon(c, `${idx + 1}`, selectionMode && selectionClientIds.includes(c.id))}
                  onClick={() => setSelectedCliente(c)}
                />
              ))
            ) : multiResults ? null : (
              <>
                {/* Numbered markers (with orden) rendered outside cluster so labels always show */}
                {withGps.filter((c: any) => typeof c.orden === 'number' && c.orden > 0).map((c: any) => (
                  <Marker
                    key={c.id}
                    position={{ lat: c.gps_lat, lng: c.gps_lng }}
                    icon={getMapMarkerIcon(c, `${c.orden}`, selectionMode && selectionClientIds.includes(c.id))}
                    onClick={() => setSelectedCliente(c)}
                    title={c.nombre}
                  />
                ))}
                {/* Non-ordered markers stay clustered */}
                <MarkerClusterer
                  options={{
                    maxZoom: 14,
                    gridSize: 50,
                    minimumClusterSize: 5,
                  }}
                >
                  {(clusterer) => (
                    <>
                      {withGps.filter((c: any) => !c.orden || c.orden <= 0).map((c: any) => (
                        <Marker
                          key={c.id}
                          position={{ lat: c.gps_lat, lng: c.gps_lng }}
                          icon={getMapMarkerIcon(c, undefined, selectionMode && selectionClientIds.includes(c.id))}
                          onClick={() => setSelectedCliente(c)}
                          title={c.nombre}
                          clusterer={clusterer}
                        />
                      ))}
                    </>
                  )}
                </MarkerClusterer>
              </>
            )}

            {selectedCliente && (
              <InfoWindow
                position={{ lat: selectedCliente.gps_lat, lng: selectedCliente.gps_lng }}
                onCloseClick={() => setSelectedCliente(null)}
              >
                <div className="min-w-[220px] p-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-bold text-sm flex-1">{selectedCliente.nombre}</div>
                    {ventasHoy?.has(selectedCliente.id) ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">Visitado</span>
                    ) : selectedCliente.dia_visita?.some((d: string) => d.toLowerCase() === DIA_HOY.toLowerCase()) ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">Pendiente</span>
                    ) : null}
                  </div>
                  {selectedCliente.codigo && <div className="text-xs text-gray-500 font-mono mb-1">{selectedCliente.codigo}</div>}
                  {typeof selectedCliente.orden === 'number' && selectedCliente.orden > 0 && (
                    <div className="text-[10px] text-gray-500 mb-1">📍 Orden de ruta: <strong>{selectedCliente.orden}</strong></div>
                  )}
                  {selectedCliente.direccion && <div className="text-xs text-gray-600 mb-2">{selectedCliente.direccion}{selectedCliente.colonia ? `, ${selectedCliente.colonia}` : ''}</div>}
                  {selectedCliente.vendedores?.nombre && (
                    <div className="text-[10px] text-gray-500 mb-1">🧑‍💼 {selectedCliente.vendedores.nombre}</div>
                  )}
                  {selectedCliente.dia_visita?.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-2">
                      {selectedCliente.dia_visita.map((d: string) => {
                        const dColor = getDiaColor(d);
                        return (
                          <span key={d} className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ backgroundColor: `${dColor}20`, color: dColor }}>
                            {d.slice(0, 3)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex gap-2 mt-1 pt-1 border-t border-gray-100">
                    <Link to={`/clientes/${selectedCliente.id}`} className="text-xs text-blue-600 hover:underline font-medium">Ver ficha</Link>
                    {selectedCliente.telefono && <a href={`tel:${selectedCliente.telefono}`} className="text-xs text-green-600 hover:underline">Llamar</a>}
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedCliente.gps_lat},${selectedCliente.gps_lng}`}
                      target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Navegar</a>
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
        <MapRecenterButton onClick={handleRecenter} className="bottom-6 left-3" />

        {selectionMode && (
          <div className="absolute bottom-3 right-3 z-[70] w-[min(28rem,calc(100vw-1.5rem))] bg-card/95 backdrop-blur-sm border border-border rounded-2xl shadow-xl p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <PenLine className="h-4 w-4 text-amber-500" />
                  Modo lápiz
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Arrastra sobre el mapa para seleccionar clientes y poder asignarles dias o vendedores de una forma facil y sencilla.
                </div>
              </div>
              <button onClick={() => { setSelectionMode(false); clearSelection(); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-foreground">
              <Badge className="bg-primary/10 text-primary border-primary/20">{selectionClientIds.length} clientes</Badge>
              <span className="text-muted-foreground">
                {selectionDragging ? 'dibujando' : selectionMessage || 'dibuja un área para continuar'}
              </span>
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {(['assign', 'desasignar'] as SelectionAction[]).map(action => (
                <button
                  key={action}
                  onClick={() => setSelectionAction(action)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors",
                    selectionAction === action ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"
                  )}
                >
                  {action === 'assign' ? 'Asignar' : 'Desasignar'}
                </button>
              ))}
            </div>

            {selectionAction === 'assign' && (
              <div className="space-y-2">
                <div className="text-[10px] font-medium text-muted-foreground">
                  Deja en "No modificar" para conservar el valor actual del cliente:
                </div>
                <SearchableSelect
                  options={[{ value: '', label: '— No modificar vendedor —' }, ...(vendedores ?? []).map(v => ({ value: v.id, label: v.nombre, searchText: v.nombre }))]}
                  value={selectionVendorId}
                  onChange={setSelectionVendorId}
                  placeholder="Vendedor..."
                  renderOption={(option, { selected }) => {
                    const color = option.value ? (vendorColorMap.get(option.value) ?? '#9ca3af') : '#94a3b8';
                    return (
                      <div className="flex items-center gap-2 w-full">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className={cn("truncate", selected && "font-semibold")}>{option.label}</span>
                      </div>
                    );
                  }}
                  renderValue={(option) => option ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: option.value ? (vendorColorMap.get(option.value) ?? '#9ca3af') : '#94a3b8' }} />
                      <span className="truncate">{option.label}</span>
                    </span>
                  ) : null}
                />

                <SearchableSelect
                  options={[{ value: '', label: '— No modificar día —' }, ...DIAS.map(d => ({ value: d, label: d }))]}
                  value={selectionDay}
                  onChange={setSelectionDay}
                  placeholder="Día..."
                  renderOption={(option, { selected }) => (
                    <div className="flex items-center gap-2 w-full">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: option.value ? (DIA_COLORS[option.value] ?? '#9ca3af') : '#94a3b8' }} />
                      <span className={cn("truncate", selected && "font-semibold")}>{option.label}</span>
                    </div>
                  )}
                  renderValue={(option) => option ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: option.value ? (DIA_COLORS[option.value] ?? '#9ca3af') : '#94a3b8' }} />
                      <span className="truncate">{option.label}</span>
                    </span>
                  ) : null}
                />
              </div>
            )}

            {selectionAction === 'desasignar' && (
              <div className="space-y-2 bg-background/50 border border-border p-2.5 rounded-xl">
                <div className="text-[11px] font-medium text-muted-foreground mb-1">Selecciona qué deseas quitar de los clientes seleccionados:</div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={desasignarVendor}
                      onChange={e => setDesasignarVendor(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 bg-background"
                    />
                    <span>Quitar Vendedor</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={desasignarDay}
                      onChange={e => setDesasignarDay(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 bg-background"
                    />
                    <span>Quitar Día de visita</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button onClick={clearSelection} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground">
                <Undo2 className="h-3.5 w-3.5" /> Limpiar
              </button>
              <button
                onClick={applySelectionAction}
                disabled={
                  selectionSaving ||
                  selectionClientIds.length === 0 ||
                  selectionAction === 'none' ||
                  (selectionAction === 'assign' && !selectionVendorId && !selectionDay) ||
                  (selectionAction === 'desasignar' && !desasignarVendor && !desasignarDay)
                }
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors",
                  (selectionSaving ||
                  selectionClientIds.length === 0 ||
                  selectionAction === 'none' ||
                  (selectionAction === 'assign' && !selectionVendorId && !selectionDay) ||
                  (selectionAction === 'desasignar' && !desasignarVendor && !desasignarDay))
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {selectionSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Confirmar
              </button>
              {selectionAction === 'desasignar' && (desasignarVendor || desasignarDay) && (
                <div className="text-[11px] text-muted-foreground ml-auto flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  Se quitará el {desasignarVendor && desasignarDay ? 'vendedor y día' : desasignarVendor ? 'vendedor' : 'día'} seleccionado.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Route order sidebar (single route, hidden when multi-route panel is active) */}
        {orderedClients && orderedClients.length > 0 && !multiResults && (
          <div className={cn("absolute top-3 right-3 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg w-72 flex flex-col transition-all",
            showRoutePanel ? "max-h-[65vh]" : "max-h-[42px]")}>
            <button onClick={() => setShowRoutePanel(!showRoutePanel)}
              className="px-3 py-2.5 border-b border-border flex items-center justify-between w-full hover:bg-accent/30 transition-colors rounded-t-xl">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Route className="h-3.5 w-3.5 text-primary" />
                Orden de visita
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{orderedClients.length} paradas</span>
                {showRoutePanel ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            </button>
            {showRoutePanel && (
              <div className="flex-1 overflow-auto">
                {orderedClients.map((c: any, idx: number) => {
                  const visited = ventasHoy?.has(c.id);
                  return (
                    <div key={c.id}
                      draggable="true"
                      onDragStart={(e) => {
                        setDraggingIdx(idx);
                        e.dataTransfer.setData('text/plain', String(idx));
                      }}
                      onDragEnd={() => {
                        setDraggingIdx(null);
                        setDragOverIdx(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverIdx !== idx) setDragOverIdx(idx);
                      }}
                      onDragLeave={() => {
                        setDragOverIdx(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                        handleMoveStopDrop(fromIdx, idx);
                        setDraggingIdx(null);
                        setDragOverIdx(null);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 border-b border-border/30 last:border-0 w-full hover:bg-accent/10 transition-all cursor-move select-none",
                        draggingIdx === idx && "opacity-40 bg-accent/20",
                        dragOverIdx === idx && "border-t-2 border-t-primary"
                      )}
                    >
                      <button
                        onClick={() => { setSelectedCliente(c); mapRef.current?.panTo({ lat: c.gps_lat, lng: c.gps_lng }); }}
                        className="flex-1 flex items-center gap-2.5 min-w-0 text-left"
                      >
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                          visited ? "bg-[hsl(var(--success))] text-white" : "bg-primary text-primary-foreground")}>
                          {visited ? '✓' : idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-foreground truncate">{c.nombre}</div>
                          {c.direccion && <div className="text-[10px] text-muted-foreground truncate">{c.direccion}</div>}
                        </div>
                        {visited && <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))] shrink-0" />}
                      </button>

                      {/* Botones de subir y bajar */}
                      <div className="flex flex-col shrink-0 gap-0.5 ml-1">
                        <button
                          disabled={idx === 0}
                          onClick={(e) => { e.stopPropagation(); handleMoveStop(idx, 'up'); }}
                          className="p-1 hover:bg-accent/40 rounded disabled:opacity-30 disabled:hover:bg-transparent text-muted-foreground hover:text-foreground transition-colors"
                          title="Subir"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={idx === orderedClients.length - 1}
                          onClick={(e) => { e.stopPropagation(); handleMoveStop(idx, 'down'); }}
                          className="p-1 hover:bg-accent/40 rounded disabled:opacity-30 disabled:hover:bg-transparent text-muted-foreground hover:text-foreground transition-colors"
                          title="Bajar"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Multi-route panel */}
        {multiResults && multiResults.length > 0 && (
          <MultiRoutePanel
            results={multiResults}
            clientesById={clientesById}
            visibility={routeVisibility}
            onToggleVisibility={(vid) => setRouteVisibility(v => ({ ...v, [vid]: !v[vid] }))}
            onApply={handleApplyMulti}
            applying={applying}
            applied={applied}
            onClose={() => { setMultiResults(null); setApplied(false); }}
            onEdit={(vid) => setVendedorFilter(vid === '__sin_vendedor__' ? '' : vid)}
          />
        )}

        {/* Without GPS sidebar (hidden when any route panel is active) */}
        {!orderedClients && !multiResults && withoutGps.length > 0 && (
          <div className="absolute top-3 right-3 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg w-64 max-h-[50vh] flex flex-col">
            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
              <MapPinOff className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Sin GPS ({withoutGps.length})</span>
            </div>
            <div className="flex-1 overflow-auto">
              {withoutGps.map((c: any) => (
                <Link key={c.id} to={`/clientes/${c.id}`}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{c.nombre}</div>
                    {c.direccion && <div className="text-[10px] text-muted-foreground truncate">{c.direccion}</div>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* First-time hint */}
        {!originPoint && !routeResult && withGps.length > 0 && (
          <div className="absolute bottom-3 right-3 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2 shadow-sm max-w-[240px]">
            <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
              <span>Haz click en <strong>"Origen"</strong> y selecciona en el mapa, luego <strong>"Optimizar"</strong> para calcular la mejor ruta.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
