import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, Save, Search, Trash, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import HelpButton from '@/components/HelpButton';
import SearchableSelect from '@/components/SearchableSelect';
import { HELP } from '@/lib/helpContent';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProducto, useSaveProducto, useComboLineas, useAllListasPrecios } from '@/hooks/useData';
import { useDebounce } from '@/hooks/useDebounce';
import { compressPhoto } from '@/lib/imageCompressor';
import type { ComboLinea, Producto } from '@/types';
import { defaultProduct } from '@/pages/ProductoForm/useProductoForm';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  comboId?: string;
}

type ComboForm = Partial<Producto> & { usa_listas_precio?: boolean };

type ProductSelectItem = {
  id: string;
  codigo?: string | null;
  nombre?: string | null;
  es_combo?: boolean;
  precio_principal?: number | null;
  precio_sugerido_publico?: number | null;
};

type DraftLine = {
  componente_id: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  precio_principal?: number | null;
  precio_sugerido_publico?: number | null;
};

type SelectedProductItem = {
  id: string;
  codigo?: string | null;
  nombre?: string | null;
  precio_principal?: number | null;
  precio_sugerido_publico?: number | null;
  tiene_iva?: boolean;
  iva_pct?: number | null;
  tiene_ieps?: boolean;
  ieps_pct?: number | null;
  ieps_tipo?: string | null;
};

type ComboLineInsertRow = {
  empresa_id: string;
  combo_id: string;
  componente_id: string;
  cantidad: number;
  orden: number;
  notas: string | null;
};

type ComboLineDatabase = {
  from(table: 'combo_lineas'): {
    delete(): {
      eq(column: 'combo_id', value: string): Promise<{ error: Error | null }>;
    };
    insert(rows: ComboLineInsertRow[]): Promise<{ error: Error | null }>;
  };
};

const emptyComboForm: ComboForm = {
  ...defaultProduct,
  codigo: '',
  nombre: '',
  precio_principal: 0,
  precio_sugerido_publico: 0,
  usa_listas_precio: false,
  status: 'activo',
  es_combo: true,
  se_puede_comprar: false,
  se_puede_inventariar: false,
  vender_sin_stock: true,
};

export default function ComboLineModal({ open, onOpenChange, comboId }: Props) {
  const { empresa } = useAuth();
  const qc = useQueryClient();
  const comboLineasDb = supabase as unknown as ComboLineDatabase;
  const { data: existingCombo } = useProducto(comboId);
  const { data: existingLines } = useComboLineas(comboId);
  const { data: allListas } = useAllListasPrecios(empresa?.id);
  const saveProducto = useSaveProducto();

  const [form, setForm] = useState<ComboForm>(emptyComboForm);
  const [saving, setSaving] = useState(false);
  const [searchProducto, setSearchProducto] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [stagedLines, setStagedLines] = useState<DraftLine[]>([]);
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const initialEditStateRef = useRef<{
    codigo: string;
    nombre: string;
    status: Producto['status'];
    vender_sin_stock: boolean;
    imagen_url: string;
    usa_listas_precio: boolean;
    tarifa_id: string | null;
    lista_id: string | null;
    precio_principal: number;
    lines: Array<{ componente_id: string; cantidad: number }>;
  } | null>(null);
  const debouncedSearch = useDebounce(searchProducto, 250);

  useEffect(() => {
    if (!open) return;
    setPriceManuallyEdited(false);
    setSearchProducto('');
    setPickerOpen(false);
    setHighlightIdx(0);
    setForm(comboId ? { ...emptyComboForm, ...existingCombo, es_combo: true, status: 'activo' } : emptyComboForm);
    initialEditStateRef.current = null;
    if (!comboId) {
      setStagedLines([]);
    }
  }, [open, comboId, existingCombo]);

  useEffect(() => {
    if (!open) return;
    if (!comboId) return;
    const mapped: DraftLine[] = (existingLines ?? []).map((line) => ({
      componente_id: line.componente_id,
      codigo: line.productos?.codigo ?? '',
      nombre: line.productos?.nombre ?? 'Componente',
      cantidad: Number(line.cantidad) || 1,
      precio_principal: line.productos?.precio_principal ?? null,
      precio_sugerido_publico: line.productos?.precio_sugerido_publico ?? null,
    }));
    setStagedLines(mapped);
  }, [open, comboId, existingLines]);

  useEffect(() => {
    if (!open || !comboId) return;
    if (!existingCombo || existingLines === undefined) return;
    if (initialEditStateRef.current) return;
    initialEditStateRef.current = {
      codigo: existingCombo.codigo ?? '',
      nombre: existingCombo.nombre ?? '',
      status: existingCombo.status ?? 'activo',
      vender_sin_stock: !!existingCombo.vender_sin_stock,
      imagen_url: existingCombo.imagen_url ?? '',
      usa_listas_precio: !!existingCombo.usa_listas_precio,
      tarifa_id: existingCombo.tarifa_id ?? null,
      lista_id: existingCombo.lista_id ?? null,
      precio_principal: Number(existingCombo.precio_principal ?? 0),
      lines: (existingLines ?? [])
        .map((line) => ({
          componente_id: line.componente_id,
          cantidad: Number(line.cantidad) || 1,
        }))
        .sort((a, b) => a.componente_id.localeCompare(b.componente_id)),
    };
  }, [open, comboId, existingCombo, existingLines]);

  const { data: productos = [], isFetching: loadingProductos } = useQuery({
    queryKey: ['combo-product-search', empresa?.id, debouncedSearch],
    enabled: open && !!empresa?.id && pickerOpen,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from('productos')
        .select('id, codigo, nombre, precio_principal, precio_sugerido_publico, es_combo')
        .eq('empresa_id', empresa!.id)
        .eq('status', 'activo')
        .eq('es_combo', false)
        .order('nombre', { ascending: true })
        .range(0, 19);

      const term = debouncedSearch.trim();
      if (term) q = q.or(`nombre.ilike.%${term}%,codigo.ilike.%${term}%`);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProductSelectItem[];
    },
  });

  const selectedIds = useMemo(() => stagedLines.map((line) => line.componente_id), [stagedLines]);

  const { data: selectedProducts = [] } = useQuery({
    queryKey: ['combo-components', empresa?.id, selectedIds],
    enabled: open && !!empresa?.id && selectedIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos')
        .select('id, codigo, nombre, precio_principal, precio_sugerido_publico, tiene_iva, iva_pct, tiene_ieps, ieps_pct, ieps_tipo')
        .eq('empresa_id', empresa!.id)
        .in('id', selectedIds);
      if (error) throw error;
      return (data ?? []) as SelectedProductItem[];
    },
  });

  const productMap = useMemo(() => {
    return new Map(selectedProducts.map((p) => [p.id, p]));
  }, [selectedProducts]);

  const priceSummary = useMemo(() => {
    let total = 0;

    for (const linea of stagedLines) {
      const producto = productMap.get(linea.componente_id);
      const precioUnitario = Number(linea.precio_principal ?? producto?.precio_principal) || 0;
      total += linea.cantidad * precioUnitario;
    }

    const principal = Number(total.toFixed(2));

    return {
      principal,
      sugerido: principal,
    };
  }, [stagedLines, productMap]);

  const hasChanges = useMemo(() => {
    if (!comboId) return true;
    const initial = initialEditStateRef.current;
    if (!initial) return false;

    const currentLines = stagedLines
      .map((line) => ({
        componente_id: line.componente_id,
        cantidad: Number(line.cantidad) || 1,
      }))
      .sort((a, b) => a.componente_id.localeCompare(b.componente_id));

    const priceChanged = priceManuallyEdited && Number(form.precio_principal ?? 0) !== initial.precio_principal;

    return (
      (form.codigo ?? '') !== initial.codigo ||
      (form.nombre ?? '') !== initial.nombre ||
      (form.status ?? 'activo') !== initial.status ||
      !!form.vender_sin_stock !== initial.vender_sin_stock ||
      (form.imagen_url ?? '') !== initial.imagen_url ||
      !!form.usa_listas_precio !== initial.usa_listas_precio ||
      (form.tarifa_id ?? null) !== initial.tarifa_id ||
      (form.lista_id ?? null) !== initial.lista_id ||
      priceChanged ||
      JSON.stringify(currentLines) !== JSON.stringify(initial.lines)
    );
  }, [comboId, form, stagedLines]);

  useEffect(() => {
    if (priceManuallyEdited) return;
    if (comboId) return;
    setForm((prev) => ({
      ...prev,
      precio_principal: priceSummary.principal,
      precio_sugerido_publico: priceSummary.sugerido,
    }));
  }, [comboId, priceManuallyEdited, priceSummary.principal, priceSummary.sugerido]);

  const set = <K extends keyof ComboForm>(key: K, value: ComboForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const close = () => onOpenChange(false);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !empresa?.id) return;
    setUploadingImage(true);
    try {
      const compressed = await compressPhoto(file);
      const ext = compressed.name.split('.').pop() || 'jpg';
      const productId = comboId ?? crypto.randomUUID();
      const path = `${empresa.id}/productos/${productId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('empresa-assets').upload(path, compressed, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('empresa-assets').getPublicUrl(path);
      set('imagen_url', urlData.publicUrl + '?t=' + Date.now());
      toast.success('Imagen cargada');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar la imagen';
      toast.error(message);
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleDeleteCombo = async () => {
    if (!comboId) return;
    if (!confirm('¿Eliminar este combo?')) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('productos').update({ status: 'inactivo' }).eq('id', comboId);
      if (error) throw error;
      toast.success('Combo eliminado');
      qc.invalidateQueries({ queryKey: ['combos-page'] });
      qc.invalidateQueries({ queryKey: ['productos'] });
      qc.invalidateQueries({ queryKey: ['productos-page'] });
      close();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar el combo';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (event: MouseEvent) => {
      if (pickerRef.current?.contains(event.target as Node)) return;
      setPickerOpen(false);
      setSearchProducto('');
      setHighlightIdx(0);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  const addOrIncrementLine = (productId: string) => {
    // Prefer an already-fetched selected product (productMap),
    // but fall back to the search results (`productos`) which
    // contain the item when the user selects it from the picker.
    const prod = productMap.get(productId) ?? productos.find((p) => p.id === productId);
    if (!prod) {
      // If we can't find metadata for the product, still add a skeleton
      // entry so the user can edit quantity/name and we fetch prices
      // in the background via the selectedProducts query.
      setStagedLines((prev) => {
        const existing = prev.find((line) => line.componente_id === productId);
        if (existing) return prev.map((line) => (line.componente_id === productId ? { ...line, cantidad: line.cantidad + 1 } : line));
        return [
          ...prev,
          {
            componente_id: productId,
            codigo: '',
            nombre: 'Componente',
            cantidad: 1,
          },
        ];
      });
      return;
    }

    setStagedLines((prev) => {
      const existing = prev.find((line) => line.componente_id === productId);
      if (existing) {
        return prev.map((line) =>
          line.componente_id === productId
            ? { ...line, cantidad: line.cantidad + 1 }
            : line,
        );
      }
      return [
        ...prev,
        {
          componente_id: productId,
          codigo: prod.codigo ?? '',
          nombre: prod.nombre ?? 'Componente',
          cantidad: 1,
          precio_principal: prod.precio_principal ?? null,
          precio_sugerido_publico: prod.precio_sugerido_publico ?? null,
        },
      ];
    });
  };

  const updateLineQuantity = (productId: string, cantidad: number) => {
    setStagedLines((prev) =>
      prev.map((line) =>
        line.componente_id === productId
          ? { ...line, cantidad: Math.max(1, cantidad) }
          : line,
      ),
    );
  };

  const removeLine = (productId: string) => {
    setStagedLines((prev) => prev.filter((line) => line.componente_id !== productId));
  };

  useEffect(() => {
    setHighlightIdx(0);
  }, [debouncedSearch, productos.length]);

  const selectProduct = (productId: string) => {
    addOrIncrementLine(productId);
    setSearchProducto('');
    setPickerOpen(false);
    setHighlightIdx(0);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setPickerOpen(true);
      setHighlightIdx((current) => Math.min(current + 1, Math.max(productos.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setPickerOpen(true);
      setHighlightIdx((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = productos[highlightIdx];
      if (selected) selectProduct(selected.id);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setPickerOpen(false);
      setSearchProducto('');
    }
  };

  const saveAll = async () => {
    if (!form.codigo?.trim() || !form.nombre?.trim()) {
      toast.error('Código y nombre son obligatorios');
      return;
    }
    if (!empresa?.id) {
      toast.error('Sin empresa');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Producto> & { usa_listas_precio?: boolean } = {
        ...form,
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        es_combo: true,
        status: form.status ?? 'activo',
        se_puede_comprar: false,
        se_puede_inventariar: false,
        vender_sin_stock: !!form.vender_sin_stock,
        precio_principal: Number(form.precio_principal ?? (comboId ? 0 : priceSummary.principal)) || 0,
        precio_sugerido_publico: Number(form.precio_sugerido_publico ?? priceSummary.sugerido) || 0,
        usa_listas_precio: !!form.usa_listas_precio,
        tarifa_id: form.usa_listas_precio ? form.tarifa_id ?? null : null,
      };

      const result = await saveProducto.mutateAsync(comboId ? { ...payload, id: comboId } : payload);
      const comboIdToUse = result?.id ?? comboId;
      if (!comboIdToUse) throw new Error('No se pudo obtener el id del combo');

      const { error: deleteError } = await comboLineasDb
        .from('combo_lineas')
        .delete()
        .eq('combo_id', comboIdToUse);
      if (deleteError) throw deleteError;

      if (stagedLines.length > 0) {
        const rows = stagedLines.map((line, index) => ({
          empresa_id: empresa.id,
          combo_id: comboIdToUse,
          componente_id: line.componente_id,
          cantidad: line.cantidad,
          orden: index,
          notas: null,
        }));
        const { error: insertError } = await comboLineasDb
          .from('combo_lineas')
          .insert(rows);
        if (insertError) throw insertError;
      }

      await qc.invalidateQueries({ queryKey: ['combo_lineas', comboIdToUse] });
      await qc.invalidateQueries({ queryKey: ['combos-page'] });
      await qc.invalidateQueries({ queryKey: ['productos'] });
      await qc.invalidateQueries({ queryKey: ['productos-page'] });
      await qc.invalidateQueries({ queryKey: ['producto', comboIdToUse] });

      toast.success(comboId ? 'Combo actualizado' : 'Combo creado');
      close();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar el combo';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent hideClose className="max-w-[1180px] w-[calc(100vw-1rem)] max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 py-3 border-b border-border flex-row items-start justify-between space-y-0 gap-3">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <DialogTitle className="text-base">{comboId ? 'Editar combo' : 'Nuevo combo'}</DialogTitle>
              <HelpButton title={HELP.combos.title} sections={HELP.combos.sections} />
            </div>
            <p className="text-xs text-muted-foreground">Captura el combo arriba, agrega productos a la lista y guarda una sola vez.</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {(['activo', 'inactivo', 'borrador'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => set('status', status)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${form.status === status ? 'bg-primary text-primary-foreground border-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                >
                  {status === 'activo' ? 'Activo' : status === 'inactivo' ? 'Inactivo' : 'Borrador'}
                </button>
              ))}
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-muted-foreground border border-border rounded-full px-2 py-0.5">
                <input type="checkbox" checked={!!form.vender_sin_stock} onChange={(e) => set('vender_sin_stock', e.target.checked)} className="rounded border-input h-3.5 w-3.5" />
                Vender sin stock
              </label>
              {comboId && (
                <Button type="button" variant="ghost" size="sm" onClick={handleDeleteCombo} disabled={saving} className="h-7 gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2 shrink-0">
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <div className="relative group cursor-pointer" onClick={() => imageInputRef.current?.click()}>
              {form.imagen_url ? (
                <img src={form.imagen_url} alt="" className="w-[90px] h-[90px] rounded-lg object-cover border border-border" />
              ) : (
                <div className={`w-[90px] h-[90px] rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-card hover:border-primary/40 transition-colors ${uploadingImage ? 'animate-pulse' : ''}`}>
                  <Camera className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Código</label>
              <Input value={form.codigo ?? ''} onChange={(e) => set('codigo', e.target.value)} placeholder="Código del combo" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <Input value={form.nombre ?? ''} onChange={(e) => set('nombre', e.target.value)} placeholder="Nombre del combo" />
            </div>
          </div>

          <div className="grid lg:grid-cols-[0.92fr_1.58fr] gap-4 items-stretch">
            <div ref={pickerRef} className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm h-full">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Buscar producto</label>
                <p className="text-xs text-muted-foreground">Agrega componentes desde aquí. Repetir un producto suma cantidad.</p>
              </div>
              <div className="rounded-md border border-border bg-background px-3 py-2 flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={searchProducto}
                  onChange={(e) => {
                    setSearchProducto(e.target.value);
                    setPickerOpen(true);
                  }}
                  onFocus={() => setPickerOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Haz clic y busca un producto"
                  className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
              </div>
              {pickerOpen && (
                <div className="rounded-md border border-border bg-background overflow-hidden max-h-64 overflow-y-auto">
                  {loadingProductos ? (
                    <div className="px-3 py-3 text-xs text-muted-foreground">Buscando...</div>
                  ) : productos.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-muted-foreground">Sin resultados</div>
                  ) : (
                    productos.map((producto, index) => (
                      <button
                        key={producto.id}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectProduct(producto.id);
                        }}
                        onMouseEnter={() => setHighlightIdx(index)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors border-b border-border last:border-b-0 ${index === highlightIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-medium">{producto.nombre ?? 'Sin nombre'}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{producto.codigo ?? '—'}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden h-full flex flex-col min-h-[320px]">
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Componentes</div>
                  <div className="text-xs text-muted-foreground">Lista armada para este combo</div>
                </div>
                <div className="text-xs text-muted-foreground">{stagedLines.length} item{stagedLines.length === 1 ? '' : 's'}</div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="th-odoo text-left">Código</th>
                    <th className="th-odoo text-left">Producto</th>
                    <th className="th-odoo text-center w-28">Cantidad</th>
                    <th className="th-odoo text-right w-24">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {stagedLines.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-muted-foreground text-sm">
                        Todavía no hay componentes.
                      </td>
                    </tr>
                  ) : (
                    stagedLines.map((line) => (
                      <tr key={line.componente_id} className="border-b border-border last:border-b-0">
                        <td className="py-2 px-3 font-mono text-xs">{line.codigo || '—'}</td>
                        <td className="py-2 px-3 font-medium">{line.nombre}</td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            min={1}
                            step="1"
                            value={line.cantidad}
                            onChange={(e) => updateLineQuantity(line.componente_id, Number(e.target.value) || 1)}
                            className="h-9 text-center"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(line.componente_id)}>
                            <Trash className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Modo de precio</div>
                <div className="text-xs text-muted-foreground">Elige si este combo usa precio directo o una lista de precios.</div>
              </div>
              <div className="flex items-center gap-1">
                {(['directo', 'listas'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      usa_listas_precio: mode === 'listas',
                      tarifa_id: mode === 'listas' ? prev.tarifa_id : null,
                      lista_id: mode === 'listas' ? prev.lista_id : null,
                    }))}
                    className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${((form.usa_listas_precio ? 'listas' : 'directo') === mode) ? 'bg-primary text-primary-foreground border-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                  >
                    {mode === 'directo' ? 'Precio directo' : 'Listas de precio'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid md:grid-cols-[1fr_0.9fr] gap-4 items-end">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Precio principal</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.precio_principal ?? 0}
                  onChange={(e) => {
                    setPriceManuallyEdited(true);
                    set('precio_principal', Number(e.target.value) || 0);
                  }}
                />
              </div>
              {form.usa_listas_precio ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Lista de precios</label>
                  <SearchableSelect
                    options={(allListas ?? []).map((lista) => ({
                      value: lista.id,
                      label: `${lista.es_principal ? '★ ' : ''}${lista.nombre}`,
                      searchText: `${lista.nombre} ${lista.tarifa_id}`,
                    }))}
                    value={form.lista_id ?? ''}
                    onChange={(val) => {
                      const lista = (allListas ?? []).find((item) => item.id === val);
                      setForm((prev) => ({
                        ...prev,
                        lista_id: val,
                        tarifa_id: lista?.tarifa_id ?? '',
                        usa_listas_precio: true,
                      }));
                    }}
                    placeholder="Buscar lista de precios"
                  />
                  <p className="text-xs text-muted-foreground">
                    El combo usará los precios de la lista seleccionada. El precio directo queda como referencia.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2">
                  <div className="text-xs font-medium text-muted-foreground">Precio sugerido</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{priceSummary.sugerido.toFixed(2)}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Se calcula automáticamente con el precio sugerido público de los componentes.</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={close} disabled={saving} className="gap-2 min-w-[140px]">
              Descartar
            </Button>
            <Button type="button" onClick={saveAll} disabled={saving || (!comboId ? false : !hasChanges)} className="gap-2 min-w-[180px]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar combo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
