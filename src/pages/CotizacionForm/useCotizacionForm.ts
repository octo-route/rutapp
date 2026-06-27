import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCotizacion, useSaveCotizacion, useSaveCotizacionLinea, useDeleteCotizacionLinea, useDeleteCotizacion, useConvertCotizacionToVenta } from '@/hooks/useCotizaciones';
import { useProductosForSelect, useTarifasForSelect } from '@/hooks/useData';
import { useAllPresentaciones } from '@/hooks/usePresentaciones';
import { useClientes, useVendedores } from '@/hooks/useClientes';
import { supabase } from '@/lib/supabase';
import { resolveProductPricing, type TarifaLineaRule, type ProductForPricing } from '@/lib/priceResolver';
import { buildSalePricingSnapshot } from '@/lib/salePricing';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Cotizacion, CotizacionLinea, StatusCotizacion } from '@/types';
import { toast } from 'sonner';
import { usePermisos } from '@/hooks/usePermisos';
import { todayLocal } from '@/lib/utils';

const COL_COUNT = 4;

export function emptyCotizacion(): Partial<Cotizacion> {
  return {
    status: 'borrador', condicion_pago: 'por_definir',
    fecha: todayLocal(),
    subtotal: 0, descuento_total: 0, iva_total: 0, ieps_total: 0, total: 0,
  };
}

export function emptyLine(): Partial<CotizacionLinea> & { unidad_label?: string; impuestos_label?: string } {
  return {
    cantidad: 1, precio_unitario: 0, descuento_pct: 0,
    iva_pct: 0, ieps_pct: 0, subtotal: 0, iva_monto: 0, ieps_monto: 0, total: 0,
    unidad_label: '', impuestos_label: '',
  };
}

export const COTIZACION_STEPS: { key: StatusCotizacion; label: string }[] = [
  { key: 'borrador', label: 'Borrador' },
  { key: 'enviada', label: 'Enviada' },
  { key: 'aceptada', label: 'Aceptada' },
  { key: 'rechazada', label: 'Rechazada' },
];

export function useCotizacionForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, user, empresa } = useAuth();
  const isNew = id === 'nuevo';
  const { data: existingCotizacion, isLoading } = useCotizacion(isNew ? undefined : id);
  const saveCotizacion = useSaveCotizacion();
  const saveLinea = useSaveCotizacionLinea();
  const deleteLinea = useDeleteCotizacionLinea();
  const deleteCotizacion = useDeleteCotizacion();
  const convertToVenta = useConvertCotizacionToVenta();
  const queryClient = useQueryClient();
  const { data: clientesList } = useClientes();
  const { data: productosList } = useProductosForSelect();
  const { data: tarifasList } = useTarifasForSelect();
  const { data: vendedoresList } = useVendedores();
  const { data: presentacionesList } = useAllPresentaciones();
  
  const [form, setForm] = useState<Partial<Cotizacion>>(emptyCotizacion());
  const [lineas, setLineas] = useState<Partial<CotizacionLinea>[]>([emptyLine()]);
  const [dirty, setDirty] = useState(false);
  
  // State for Presentation Modal
  const [productBeingConfigured, setProductBeingConfigured] = useState<{
    idx: number;
    producto: any;
    precioBase: number;
    presentaciones: any[];
  } | null>(null);

  const loadedCotizacionIdRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  
  const { hasPermiso } = usePermisos();
  const canEditCotizacion = hasPermiso('ventas', 'editar'); // Using ventas permissions
  const canCreateCotizacion = hasPermiso('ventas', 'crear');
  const readOnly = isNew ? !canCreateCotizacion : (!!(form as any).venta_id || !canEditCotizacion);
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());

  const setCellRef = useCallback((row: number, col: number, el: HTMLElement | null) => {
    const key = `${row}-${col}`;
    if (el) cellRefs.current.set(key, el); else cellRefs.current.delete(key);
  }, []);

  const focusCell = useCallback((row: number, col: number) => {
    const el = cellRefs.current.get(`${row}-${col}`);
    if (el) { el.focus(); if (el instanceof HTMLInputElement) el.select(); }
  }, []);

  // Tarifa rules
  const { data: tarifaRules } = useQuery({
    queryKey: ['tarifa-rules-cotizacion', form.tarifa_id], enabled: !!form.tarifa_id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('tarifa_lineas')
        .select('aplica_a, producto_ids, clasificacion_ids, presentacion_ids, tipo_calculo, precio, precio_minimo, margen_pct, descuento_pct, redondeo, base_precio, lista_precio_id')
        .eq('tarifa_id', form.tarifa_id!);
      if (error) throw error;
      return (data ?? []) as TarifaLineaRule[];
    },
  });

  // Load existing cotizacion
  useEffect(() => {
    if (!existingCotizacion) {
      if (isNew) {
        const defaultTarifa = tarifasList?.find((t: any) => t.tipo === 'general')?.id;
        setForm(prev => ({
          ...prev,
          vendedor_id: profile?.id,
          ...(defaultTarifa ? { tarifa_id: defaultTarifa } : {}),
        }));
      }
      return;
    }
    const cotizacionId = existingCotizacion.id;
    if (loadedCotizacionIdRef.current === cotizacionId) return;
    loadedCotizacionIdRef.current = cotizacionId;

    setForm(existingCotizacion);
    const existingLines = (existingCotizacion.cotizacion_lineas ?? []).map((l: any) => {
      const unidadData = l.unidades;
      const unidadLabel = unidadData?.abreviatura || unidadData?.nombre || '';
      const taxes: string[] = [];
      if (l.iva_pct > 0) taxes.push(`IVA ${l.iva_pct}%`);
      if (l.ieps_pct > 0) taxes.push(`IEPS ${l.ieps_pct}%`);
      return { ...l, unidad_label: unidadLabel, impuestos_label: taxes.join(', ') };
    });
    const isReadOnly = !!existingCotizacion.venta_id;
    setLineas(isReadOnly ? existingLines : [...existingLines, emptyLine()]);
  }, [existingCotizacion?.id, isNew, tarifasList, profile?.id]);

  // Totals
  const totals = useMemo(() => {
    let subtotal = 0, descuento_total = 0, iva_total = 0, ieps_total = 0;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    lineas.forEach(l => {
      const qty = Number(l.cantidad) || 0, price = Number(l.precio_unitario) || 0, desc = Number(l.descuento_pct) || 0;
      const lineSubtotal = r2(qty * price), discountAmt = r2(lineSubtotal * (desc / 100)), base = r2(lineSubtotal - discountAmt);
      const ieps = r2(base * ((Number(l.ieps_pct) || 0) / 100)), iva = r2((base + ieps) * ((Number(l.iva_pct) || 0) / 100));
      iva_total += iva; ieps_total += ieps;
      subtotal += lineSubtotal; descuento_total += discountAmt;
    });
    const total = r2(subtotal - descuento_total + iva_total + ieps_total);
    return { subtotal: r2(subtotal), descuento_total: r2(descuento_total), iva_total: r2(iva_total), ieps_total: r2(ieps_total), total };
  }, [lineas]);

  // Re-price existing lines when tarifa rules change
  useEffect(() => {
    if (!tarifaRules?.length || !productosList || readOnly) return;
    const listaPrecioId = null;
    setLineas(prev => prev.map(l => {
      if (!l.producto_id) return l;
      if ((l as any).precio_manual) return l;
      const prod = productosList.find((p: any) => p.id === l.producto_id);
      if (!prod) return l;
      const prodForPricing: ProductForPricing = {
        id: l.producto_id, precio_principal: Number(prod.precio_principal) || 0, costo: Number(prod.costo) || 0,
        clasificacion_id: prod.clasificacion_id, tiene_iva: prod.tiene_iva, iva_pct: Number(prod.iva_pct ?? 16),
        tiene_ieps: prod.tiene_ieps || (Number(prod.ieps_pct) > 0), ieps_pct: Number(prod.ieps_pct ?? 0), ieps_tipo: prod.ieps_tipo,
        usa_listas_precio: prod.usa_listas_precio,
      };
      const pricing = resolveProductPricing(tarifaRules, prodForPricing, listaPrecioId);
      const snap = buildSalePricingSnapshot(prodForPricing, pricing);
      if (snap.unitPrice === Number(l.precio_unitario)) return l;
      return { ...l, precio_unitario: snap.unitPrice, display_unit_price: snap.displayPrice } as any;
    }));
  }, [tarifaRules, productosList, readOnly]);

  const set = (field: string, val: any) => { if (readOnly) return; setForm(prev => ({ ...prev, [field]: val })); setDirty(true); };

  const handleProductSelect = (idx: number, productoId: string) => {
    if (readOnly) return;
    if (!productoId) { updateLine(idx, 'producto_id', ''); return; }
    const producto = productosList?.find((p: any) => p.id === productoId);
    if (!producto) return;
    const ivaPct = producto.tiene_iva ? Number(producto.iva_pct ?? 16) : 0;
    const hasIeps = producto.tiene_ieps || (Number(producto.ieps_pct) > 0);
    const iepsPct = hasIeps ? Number(producto.ieps_pct ?? 0) : 0;
    const unidadId = producto.unidad_cotizacion_id || producto.unidad_compra_id || null;
    const unidadData = (producto as any).unidades_cotizacion;
    const unidadLabel = unidadData?.abreviatura || unidadData?.nombre || '';
    const taxes: string[] = [];
    if (producto.tiene_iva) taxes.push(`IVA ${ivaPct}%`);
    if (hasIeps) taxes.push(producto.ieps_tipo === 'cuota' ? 'IEPS cuota' : `IEPS ${iepsPct}%`);
    
    const prodForPricing: ProductForPricing = {
      id: productoId, precio_principal: Number(producto.precio_principal) || 0, costo: Number(producto.costo) || 0,
      clasificacion_id: producto.clasificacion_id, tiene_iva: producto.tiene_iva, iva_pct: Number(producto.iva_pct ?? 16),
      tiene_ieps: hasIeps, ieps_pct: Number(producto.ieps_pct ?? 0), ieps_tipo: producto.ieps_tipo, usa_listas_precio: producto.usa_listas_precio,
    };
    const pricing = tarifaRules?.length ? resolveProductPricing(tarifaRules, prodForPricing, null) : null;
    const snap = pricing ? buildSalePricingSnapshot(prodForPricing, pricing) : null;
    const finalUnitPrice = snap ? snap.unitPrice : Number(producto.precio_principal) || 0;
    
    // Si tiene presentaciones, abrir el modal
    const prodPresentaciones = presentacionesList?.filter((p: any) => p.producto_id === productoId && p.activo) || [];
    if (prodPresentaciones.length > 0) {
      setProductBeingConfigured({
        idx,
        producto,
        precioBase: finalUnitPrice,
        presentaciones: prodPresentaciones
      });
      return;
    }
    
    setLineas(prev => { const next = [...prev]; next[idx] = { ...next[idx], producto_id: productoId, descripcion: producto.nombre, precio_unitario: finalUnitPrice, unidad_id: unidadId, iva_pct: ivaPct, ieps_pct: iepsPct, unidad_label: unidadLabel, impuestos_label: taxes.join(', '), precio_manual: false, presentacion_id: null, presentacion_nombre: null, presentacion_factor: null, paquetes: null } as any; return next; });
    setDirty(true);
  };

  const handleConfirmPresentacion = (data: { cantidadBase: number; paquetes: number | null; presentacion: any | null; pricing: any }) => {
    if (!productBeingConfigured) return;
    const { idx, producto } = productBeingConfigured;
    
    const ivaPct = producto.tiene_iva ? Number(producto.iva_pct ?? 16) : 0;
    const hasIeps = producto.tiene_ieps || (Number(producto.ieps_pct) > 0);
    const iepsPct = hasIeps ? Number(producto.ieps_pct ?? 0) : 0;
    const unidadId = producto.unidad_cotizacion_id || producto.unidad_compra_id || null;
    const taxes: string[] = [];
    if (producto.tiene_iva) taxes.push(`IVA ${ivaPct}%`);
    if (hasIeps) taxes.push(producto.ieps_tipo === 'cuota' ? 'IEPS cuota' : `IEPS ${iepsPct}%`);
    
    setLineas(prev => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        producto_id: producto.id,
        descripcion: producto.nombre,
        precio_unitario: data.pricing.unitPrice,
        cantidad: data.cantidadBase,
        unidad_id: unidadId,
        iva_pct: ivaPct,
        ieps_pct: iepsPct,
        impuestos_label: taxes.join(', '),
        precio_manual: false,
        presentacion_id: data.presentacion?.id ?? null,
        presentacion_nombre: data.presentacion?.nombre ?? null,
        presentacion_factor: data.presentacion?.factor_base ?? null,
        paquetes: data.paquetes ?? null,
      } as any;
      return next;
    });
    setDirty(true);
    setProductBeingConfigured(null);
    setTimeout(() => focusCell(idx, 1), 50); // focus quantity
  };

  const handleEditPresentacion = (idx: number) => {
    if (readOnly) return;
    const l = lineas[idx];
    if (!l.producto_id) return;
    const producto = productosList?.find((p: any) => p.id === l.producto_id);
    const prodPresentaciones = presentacionesList?.filter((p: any) => p.producto_id === l.producto_id && p.activo) || [];
    if (!producto || prodPresentaciones.length === 0) return;
    
    const hasIeps = producto.tiene_ieps || (Number(producto.ieps_pct) > 0);
    const prodForPricing: ProductForPricing = {
      id: producto.id, precio_principal: Number(producto.precio_principal) || 0, costo: Number(producto.costo) || 0,
      clasificacion_id: producto.clasificacion_id, tiene_iva: producto.tiene_iva, iva_pct: Number(producto.iva_pct ?? 16),
      tiene_ieps: hasIeps, ieps_pct: Number(producto.ieps_pct ?? 0), ieps_tipo: producto.ieps_tipo,
      usa_listas_precio: producto.usa_listas_precio,
    };
    const pricing = tarifaRules?.length ? resolveProductPricing(tarifaRules, prodForPricing, null) : null;
    const snap = pricing ? buildSalePricingSnapshot(prodForPricing, pricing) : null;
    const finalUnitPrice = snap ? snap.unitPrice : Number(producto.precio_principal) || 0;

    setProductBeingConfigured({
      idx,
      producto,
      precioBase: finalUnitPrice,
      presentaciones: prodPresentaciones
    });
  };

  const navigateCell = useCallback((rowIdx: number, colIdx: number, dir: 'next' | 'prev') => {
    if (dir === 'next') { if (colIdx < COL_COUNT - 1) focusCell(rowIdx, colIdx + 1); else if (rowIdx >= lineas.length - 1) { setLineas(prev => [...prev, emptyLine()]); setDirty(true); setTimeout(() => focusCell(rowIdx + 1, 0), 50); } else focusCell(rowIdx + 1, 0); }
    else { if (colIdx > 0) focusCell(rowIdx, colIdx - 1); else if (rowIdx > 0) focusCell(rowIdx - 1, COL_COUNT - 1); }
  }, [lineas.length, focusCell]);

  const handleCellKeyDown = (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); navigateCell(rowIdx, colIdx, e.shiftKey ? 'prev' : 'next'); }
  };

  const addLine = () => { if (readOnly) return; setLineas(prev => [...prev, emptyLine()]); setDirty(true); setTimeout(() => focusCell(lineas.length, 0), 50); };
  
  const updateLine = (idx: number, field: string, val: any) => {
    if (readOnly) return;
    if ((field === 'iva_pct' || field === 'ieps_pct') && tarifaRules?.length) {
      const line = lineas[idx];
      if (line?.producto_id) {
        const prod = productosList?.find((p: any) => p.id === line.producto_id);
        if (prod) {
          const newIvaPct = field === 'iva_pct' ? Number(val) : Number(line.iva_pct);
          const newIepsPct = field === 'ieps_pct' ? Number(val) : Number(line.ieps_pct);
          const prodForPricing: ProductForPricing = {
            id: line.producto_id!, precio_principal: Number(prod.precio_principal) || 0, costo: Number(prod.costo) || 0,
            clasificacion_id: prod.clasificacion_id,
            tiene_iva: newIvaPct > 0, iva_pct: newIvaPct > 0 ? newIvaPct : Number(prod.iva_pct ?? 16),
            tiene_ieps: newIepsPct > 0, ieps_pct: newIepsPct > 0 ? newIepsPct : Number(prod.ieps_pct ?? 0),
            ieps_tipo: prod.ieps_tipo, usa_listas_precio: prod.usa_listas_precio,
          };
          const pricing = resolveProductPricing(tarifaRules, prodForPricing, null);
          const snap = buildSalePricingSnapshot(prodForPricing, pricing);
          setLineas(prev => { const next = [...prev]; next[idx] = { ...next[idx], [field]: val, precio_unitario: snap.unitPrice } as any; return next; });
          setDirty(true);
          return;
        }
      }
    }
    setLineas(prev => { const next = [...prev]; next[idx] = { ...next[idx], [field]: val }; return next; });
    setDirty(true);
  };
  
  const removeLine = async (idx: number) => { if (readOnly) return; const line = lineas[idx]; if (line.id) await deleteLinea.mutateAsync(line.id); const newLineas = lineas.filter((_, i) => i !== idx); setLineas(newLineas.length === 0 ? [emptyLine()] : newLineas); setDirty(true); };

  const handleSave = async (): Promise<string | undefined> => {
    if (readOnly) return;
    if (savingRef.current) return;
    savingRef.current = true;
    if (!form.cliente_id) { toast.error('Selecciona un cliente'); savingRef.current = false; return; }
    const vendedorId = profile?.id;
    if (!vendedorId) { toast.error('No se pudo determinar el vendedor'); savingRef.current = false; return; }
    
    try {
      const payload = { ...form, ...totals, vendedor_id: vendedorId };
      const saved = await saveCotizacion.mutateAsync(payload as any);
      const cotizacionId = saved.id || form.id;
      const linePromises: Promise<any>[] = [];
      for (const l of lineas) {
        if (!l.producto_id) continue;
        const qty = Number(l.cantidad) || 0, price = Number(l.precio_unitario) || 0, desc = Number(l.descuento_pct) || 0;
        const lineSubtotal = qty * price, discountAmt = lineSubtotal * (desc / 100), base = lineSubtotal - discountAmt;
        const ieps = base * ((Number(l.ieps_pct) || 0) / 100);
        const iva = (base + ieps) * ((Number(l.iva_pct) || 0) / 100);
        const linePayload = { ...l, cotizacion_id: cotizacionId, subtotal: base, iva_pct: Number(l.iva_pct) || 0, iva_monto: iva, ieps_pct: Number(l.ieps_pct) || 0, ieps_monto: ieps, total: base + iva + ieps };
        const clean = { ...linePayload } as any;
        delete clean.unidad_label; delete clean.impuestos_label; delete clean.productos; delete clean.unidades;
        linePromises.push(saveLinea.mutateAsync(clean));
      }
      await Promise.all(linePromises);
      toast.success('Cotización guardada');
      queryClient.invalidateQueries({ queryKey: ['cotizacion', cotizacionId] });
      loadedCotizacionIdRef.current = null;
      if (isNew) navigate(`/ventas/cotizaciones/${cotizacionId}`, { replace: true });
      setDirty(false);
      return cotizacionId;
    } catch (e: any) { toast.error(e.message); return undefined; } finally { savingRef.current = false; }
  };

  const handleDelete = async () => { if (!form.id) return; await deleteCotizacion.mutateAsync(form.id); toast.success('Cotización eliminada'); navigate('/ventas/cotizaciones'); };

  const handleStatusChange = async (newStatus: StatusCotizacion) => {
    if (readOnly) return;
    setForm(prev => ({ ...prev, status: newStatus }));
    setDirty(true);
  };

  const handleConvertToVenta = async (almacenId?: string) => {
    if (!form.id) return;
    try {
      const ventaId = await convertToVenta.mutateAsync({ cotizacionId: form.id, almacenId });
      toast.success('Cotización convertida a venta');
      navigate(`/ventas/${ventaId}`);
    } catch (e: any) {
      // Error handled in hook, but we can do extra here if needed
    }
  };

  return {
    id, isNew, form, lineas, setLineas, dirty, readOnly, canEditCotizacion, isLoading,
    productBeingConfigured, setProductBeingConfigured, handleConfirmPresentacion, handleEditPresentacion,
    profile, user, empresa, navigate,
    clientesList, productosList, tarifasList, vendedoresList,
    totals,
    saveCotizacion,
    set, handleProductSelect, handleSave, handleDelete, handleStatusChange, handleConvertToVenta,
    addLine, updateLine, removeLine, setCellRef, handleCellKeyDown, navigateCell,
  };
}
