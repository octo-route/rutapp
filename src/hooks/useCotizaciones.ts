import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useDataVisibility } from '@/hooks/useDataVisibility';
import { pickColumns, COTIZACION_COLUMNS, COTIZACION_LINEA_COLUMNS } from '@/lib/allowlist';
import type { Cotizacion, CotizacionLinea } from '@/types';

/** Paginated cotizaciones for list views */
export function useCotizacionesPaginated(
  search?: string, statusFilter?: string, page = 1, pageSize = 80,
  vendedorFilter?: string, dateFrom?: string, dateTo?: string
) {
  const qc = useQueryClient();
  const { empresa } = useAuth();
  const { seeAll, profileId } = useDataVisibility('ventas');
  const filterOwn = !seeAll && !!profileId;

  useEffect(() => {
    if (!empresa?.id) return;
    const channel = supabase
      .channel('cotizaciones-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cotizaciones', filter: `empresa_id=eq.${empresa.id}` }, () => {
        qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, empresa?.id]);

  return useQuery({
    queryKey: ['cotizaciones', empresa?.id, search, statusFilter, page, pageSize, filterOwn ? profileId : 'all', vendedorFilter, dateFrom, dateTo],
    enabled: !!empresa?.id,
    queryFn: async () => {
      let q = supabase
        .from('cotizaciones')
        .select('id, folio, fecha, fecha_vencimiento, created_at, total, subtotal, iva_total, descuento_total, status, condicion_pago, vendedor_id, cliente_id, venta_id, clientes(nombre), vendedores:profiles!vendedor_id(nombre)', { count: 'exact' })
        .eq('empresa_id', empresa!.id)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (filterOwn) q = q.eq('vendedor_id', profileId!);

      if (search) {
        const s = search.replace(/[%_,()]/g, '\\$&').replace(/'/g, "''");
        const [clientesRes, vendedoresRes] = await Promise.all([
          supabase.from('clientes').select('id').eq('empresa_id', empresa!.id).ilike('nombre', `%${s}%`).limit(500),
          supabase.from('profiles').select('id').eq('empresa_id', empresa!.id).ilike('nombre', `%${s}%`).limit(500),
        ]);
        const clienteIds = (clientesRes.data ?? []).map((r: any) => r.id);
        const vendedorIds = (vendedoresRes.data ?? []).map((r: any) => r.id);
        
        const orParts: string[] = [`folio.ilike.%${s}%`];
        if (clienteIds.length) orParts.push(`cliente_id.in.(${clienteIds.join(',')})`);
        if (vendedorIds.length) orParts.push(`vendedor_id.in.(${vendedorIds.join(',')})`);
        q = q.or(orParts.join(','));
      }

      if (statusFilter && statusFilter !== 'todos') {
        const arr = statusFilter.split(',');
        if (arr.length > 1) q = q.in('status', arr as any);
        else q = q.eq('status', statusFilter as Cotizacion['status']);
      }

      if (vendedorFilter && vendedorFilter !== 'todos') {
        const arr = vendedorFilter.split(',');
        if (arr.length > 1) q = q.in('vendedor_id', arr as any);
        else q = q.eq('vendedor_id', vendedorFilter);
      }

      if (dateFrom) q = q.gte('fecha', dateFrom);
      if (dateTo) q = q.lte('fecha', dateTo);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as Cotizacion[], total: count ?? 0 };
    },
  });
}

export function useCotizacion(id?: string) {
  return useQuery({
    queryKey: ['cotizacion', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotizaciones')
        .select('*, clientes(nombre, email, telefono), vendedores:profiles!vendedor_id(nombre), tarifas(nombre), ventas(folio), cotizacion_lineas(*, productos(id, codigo, nombre, precio_principal, tiene_iva, tiene_ieps, tasa_iva_id, tasa_ieps_id, unidad_venta_id, usa_listas_precio), unidades(nombre, abreviatura))')
        .eq('id', id!)
        .maybeSingle();

      if (error) throw error;
      if (data) return data as Cotizacion;
      return null as unknown as Cotizacion;
    },
    enabled: !!id,
  });
}

export function useSaveCotizacion() {
  const qc = useQueryClient();
  const { empresa } = useAuth();
  
  return useMutation({
    mutationFn: async (cotizacion: Partial<Cotizacion> & { id?: string }) => {
      const clean = pickColumns(cotizacion, COTIZACION_COLUMNS);
      delete (clean as any).id;
      
      if (cotizacion.id) {
        const { data, error } = await supabase.from('cotizaciones').update(clean as any).eq('id', cotizacion.id).select('id').single();
        if (error) throw error;
        return data;
      } else {
        if (!empresa?.id) throw new Error('Sin empresa');
        (clean as any).empresa_id = empresa.id;
        const { data, error } = await supabase.from('cotizaciones').insert(clean as any).select('id').single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      qc.invalidateQueries({ queryKey: ['cotizacion'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Error inesperado');
    },
  });
}

export function useSaveCotizacionLinea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linea: Partial<CotizacionLinea> & { id?: string }) => {
      const clean = pickColumns(linea, COTIZACION_LINEA_COLUMNS);
      delete (clean as any).id;
      
      if (linea.id) {
        const { data, error } = await supabase.from('cotizacion_lineas').update(clean as any).eq('id', linea.id).select('id').single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from('cotizacion_lineas').insert(clean as any).select('id').single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cotizacion'] }),
    onError: (error: any) => {
      toast.error(error?.message || 'Error inesperado');
    },
  });
}

export function useDeleteCotizacionLinea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cotizacion_lineas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cotizacion'] }),
    onError: (error: any) => {
      toast.error(error?.message || 'Error inesperado');
    },
  });
}

export function useDeleteCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cotizaciones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cotizaciones'] }),
    onError: (error: any) => {
      toast.error(error?.message || 'Error inesperado');
    },
  });
}

export function useConvertCotizacionToVenta() {
  const qc = useQueryClient();
  const { empresa } = useAuth();
  
  return useMutation({
    mutationFn: async ({ cotizacionId, almacenId, tipo = 'pedido' }: { cotizacionId: string, almacenId?: string, tipo?: 'pedido' | 'venta_directa' }) => {
      if (!empresa?.id) throw new Error('Sin empresa');
      
      // 1. Fetch cotizacion full data
      const { data: coti, error: fetchErr } = await supabase
        .from('cotizaciones')
        .select('*, cotizacion_lineas(*)')
        .eq('id', cotizacionId)
        .single();
      
      if (fetchErr) throw fetchErr;
      if (coti.status === 'aceptada' && coti.venta_id) {
        throw new Error('Esta cotización ya fue convertida a venta.');
      }
      
      // 2. Insert into ventas
      const nuevaVenta = {
        empresa_id: empresa.id,
        tipo,
        status: 'borrador', // Will be confirmed later by user or we can make it confirmed
        cliente_id: coti.cliente_id,
        vendedor_id: coti.vendedor_id,
        condicion_pago: coti.condicion_pago,
        tarifa_id: coti.tarifa_id,
        almacen_id: almacenId,
        fecha: new Date().toISOString().split('T')[0],
        notas: `Viene de la cotización ${coti.folio}`,
        subtotal: coti.subtotal,
        descuento_total: coti.descuento_total,
        iva_total: coti.iva_total,
        ieps_total: coti.ieps_total,
        total: coti.total,
      };
      
      const { data: vtaData, error: vtaErr } = await supabase
        .from('ventas')
        .insert(nuevaVenta)
        .select('id, folio')
        .single();
        
      if (vtaErr) throw vtaErr;
      
      // 3. Insert line items
      const lineas = (coti.cotizacion_lineas || []).map((l: any) => {
        const { id, cotizacion_id, created_at, ...resto } = l;
        return {
          ...resto,
          venta_id: vtaData.id,
        };
      });
      
      if (lineas.length > 0) {
        const { error: linErr } = await supabase.from('venta_lineas').insert(lineas);
        if (linErr) throw linErr;
      }
      
      // 4. Update cotizacion status
      const { error: upErr } = await supabase
        .from('cotizaciones')
        .update({ status: 'aceptada', venta_id: vtaData.id })
        .eq('id', cotizacionId);
        
      if (upErr) throw upErr;
      
      return vtaData.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      qc.invalidateQueries({ queryKey: ['cotizacion'] });
      qc.invalidateQueries({ queryKey: ['ventas'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Error al convertir cotización');
    },
  });
}
