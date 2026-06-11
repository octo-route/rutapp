import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, Save, Search, Trash, Trash2, Star, Plus, X, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import HelpButton from '@/components/HelpButton';
import SearchableSelect from '@/components/SearchableSelect';
import { HELP } from '@/lib/helpContent';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProducto, useSaveProducto, useComboLineas, useAllListasPrecios, useTarifaLineasForProducto, useSaveTarifaLinea, useDeleteTarifaLinea, useSaveTarifa, useSaveListaPrecio, useClasificaciones } from '@/hooks/useData';
import { useDebounce } from '@/hooks/useDebounce';
import { compressPhoto } from '@/lib/imageCompressor';
import type { ComboLinea, Producto, TipoCalculoTarifa, RedondeoTarifa } from '@/types';
import { defaultProduct } from '@/pages/ProductoForm/useProductoForm';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { calcTax } from '@/lib/taxUtils';

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
  costo?: number | null;
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

  // Price lists hooks & query
  const saveTarifaLinea = useSaveTarifaLinea();
  const deleteTarifaLineaMut = useDeleteTarifaLinea();
  const saveTarifaMut = useSaveTarifa();
  const saveListaMut = useSaveListaPrecio();
  const { data: clasificaciones } = useClasificaciones();
  const { data: tarifaLineas = [] } = useTarifaLineasForProducto(comboId);

  // States for pricing rules dialog & table
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [linkToSuggested, setLinkToSuggested] = useState(true);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceCol, setEditingPriceCol] = useState<string | null>(null);
  const [editPriceVal, setEditPriceVal] = useState<Record<string, any>>({});
  const [newPriceRule, setNewPriceRule] = useState({
    aplica_a: 'producto' as 'producto' | 'categoria' | 'todos',
    clasificacion_ids: [] as string[],
    tarifa_id: '',
    lista_precio_id: '',
    tipo_calculo: 'precio_fijo' as TipoCalculoTarifa,
    precio: 0,
    margen_pct: 0,
    descuento_pct: 0,
    precio_minimo: 0,
  });

  const listasForTarifa = useMemo(() => {
    if (!newPriceRule.tarifa_id) return allListas ?? [];
    return (allListas ?? []).filter((l: any) => l.tarifa_id === newPriceRule.tarifa_id);
  }, [allListas, newPriceRule.tarifa_id]);

  useEffect(() => {
    if (newPriceRule.tarifa_id) {
      const principal = listasForTarifa.find((l: any) => l.es_principal);
      setNewPriceRule(p => ({ ...p, lista_precio_id: (principal as any)?.id ?? (listasForTarifa[0] as any)?.id ?? '' }));
    }
  }, [newPriceRule.tarifa_id, listasForTarifa]);

  const handleCreateLista = async (name: string) => {
    let tarifaId = newPriceRule.tarifa_id;
    if (!tarifaId) {
      try {
        const res = await saveTarifaMut.mutateAsync({ nombre: name, tipo: 'general', activa: true } as any);
        qc.invalidateQueries({ queryKey: ['tarifas-select'] });
        tarifaId = res.id;
      } catch { return undefined; }
    }
    try {
      const res = await saveListaMut.mutateAsync({ tarifa_id: tarifaId, nombre: name, es_principal: false });
      qc.invalidateQueries({ queryKey: ['lista_precios_all'] });
      return res.id;
    } catch { return undefined; }
  };

  const handleSavePriceRule = async () => {
    if (!newPriceRule.lista_precio_id) {
      toast.error('Selecciona una lista de precios');
      return;
    }
    const existing = (tarifaLineas ?? []) as any[];
    const listaId = newPriceRule.lista_precio_id || null;
    const duplicate = existing.find((l: any) => {
      const existLista = l.lista_precios?.id ?? l.lista_precio_id ?? null;
      return existLista === listaId;
    });
    if (duplicate) {
      const listaName = duplicate.lista_precios?.nombre ?? 'esta lista';
      toast.error(`Ya existe una regla en "${listaName}" para este combo.`);
      return;
    }

    try {
      await saveTarifaLinea.mutateAsync({
        tarifa_id: newPriceRule.tarifa_id,
        lista_precio_id: newPriceRule.lista_precio_id || null,
        aplica_a: 'producto',
        tipo_calculo: newPriceRule.tipo_calculo,
        precio: newPriceRule.precio,
        margen_pct: newPriceRule.margen_pct,
        descuento_pct: newPriceRule.descuento_pct,
        precio_minimo: newPriceRule.precio_minimo,
        producto_ids: [comboId!],
        clasificacion_ids: [],
      } as any);
      toast.success('Precio agregado');
      setShowPriceModal(false);
      setNewPriceRule({
        aplica_a: 'producto',
        clasificacion_ids: [],
        tarifa_id: '',
        lista_precio_id: '',
        tipo_calculo: 'precio_fijo',
        precio: form.precio_principal || 0,
        margen_pct: 0,
        descuento_pct: 0,
        precio_minimo: form.costo || 0,
      });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeletePriceRule = async (lineaId: string) => {
    try {
      await deleteTarifaLineaMut.mutateAsync(lineaId);
      toast.success('Precio eliminado');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const startEditPrice = (linea: any, col: string) => {
    setEditingPriceId(linea.id);
    setEditingPriceCol(col);
    setEditPriceVal({
      tipo_calculo: linea.tipo_calculo,
      precio: linea.precio,
      margen_pct: linea.margen_pct,
      descuento_pct: linea.descuento_pct,
      precio_minimo: linea.precio_minimo,
      comision_pct: linea.comision_pct ?? 0,
      redondeo: linea.redondeo ?? 'ninguno',
      base_precio: linea.base_precio ?? 'sin_impuestos',
    });
  };

  const saveEditPrice = async (lineaId: string) => {
    try {
      await saveTarifaLinea.mutateAsync({ id: lineaId, ...editPriceVal } as any);
      setEditingPriceId(null);
      setEditingPriceCol(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const applyRedondeo = (precio: number, redondeo: string) => {
    if (!redondeo || redondeo === 'ninguno') return precio;
    if (redondeo === 'arriba') return Math.ceil(precio);
    if (redondeo === 'abajo') return Math.floor(precio);
    return Math.round(precio);
  };

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
    costo: number;
    calculo_costo: string;
    tiene_iva: boolean;
    iva_pct: number;
    tiene_ieps: boolean;
    ieps_pct: number;
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
      setLinkToSuggested(true);
    } else if (existingCombo) {
      const pr = Number(existingCombo.precio_principal) || 0;
      const sug = Number(existingCombo.precio_sugerido_publico) || 0;
      setLinkToSuggested(Math.abs(pr - sug) < 0.01);
    }
  }, [open, comboId, existingCombo]);

  useEffect(() => {
    if (!open || !comboId || !existingCombo || !allListas) return;
    if (existingCombo.tarifa_id && !form.lista_id) {
      const match = allListas.find(l => l.tarifa_id === existingCombo.tarifa_id && l.es_principal)
        || allListas.find(l => l.tarifa_id === existingCombo.tarifa_id);
      if (match) {
        setForm(prev => ({ ...prev, lista_id: match.id }));
      }
    }
  }, [open, comboId, existingCombo, allListas, form.lista_id]);

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
      precio_sugerido_publico: Number(existingCombo.precio_sugerido_publico ?? 0),
      costo: Number(existingCombo.costo ?? 0),
      calculo_costo: existingCombo.calculo_costo ?? 'promedio',
      tiene_iva: !!existingCombo.tiene_iva,
      iva_pct: Number(existingCombo.iva_pct ?? 16),
      tiene_ieps: !!existingCombo.tiene_ieps,
      ieps_pct: Number(existingCombo.ieps_pct ?? 0),
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
        .select('id, codigo, nombre, precio_principal, precio_sugerido_publico, costo, tiene_iva, iva_pct, tiene_ieps, ieps_pct, ieps_tipo')
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

  const costSummary = useMemo(() => {
    let total = 0;
    for (const linea of stagedLines) {
      const prod = productMap.get(linea.componente_id);
      const costoUnitario = Number(prod?.costo) || 0;
      total += linea.cantidad * costoUnitario;
    }
    return Number(total.toFixed(2));
  }, [stagedLines, productMap]);

  const [costModeModal, setCostModeModal] = useState<{ type: 'to_manual' | 'to_auto' } | null>(null);

  const confirmCostModeChange = () => {
    if (costModeModal) {
      const toAuto = costModeModal.type === 'to_auto';
      setForm((prev) => ({
        ...prev,
        calculo_costo: toAuto ? 'promedio' : 'manual',
        costo: toAuto ? costSummary : prev.costo || 0,
      }));
      setCostModeModal(null);
    }
  };

  useEffect(() => {
    if (form.calculo_costo === 'manual') return;
    setForm((prev) => ({
      ...prev,
      costo: costSummary,
    }));
  }, [costSummary, form.calculo_costo]);

  const currentPrecioPrincipal = form.precio_principal ?? 0;
  const currentCosto = form.costo ?? 0;
  const currentUtilidad = currentPrecioPrincipal - currentCosto;
  const currentMargenPct = currentPrecioPrincipal > 0 ? (currentUtilidad / currentPrecioPrincipal) * 100 : 0;
  const isUtilidadPositiva = currentUtilidad > 0;

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

    const priceChanged = Number(form.precio_principal ?? 0) !== initial.precio_principal;
    const sugeridoChanged = Number(form.precio_sugerido_publico ?? 0) !== (initial as any).precio_sugerido_publico;
    const costChanged = Number(form.costo ?? 0) !== initial.costo;
    const taxChanged =
      !!form.tiene_iva !== initial.tiene_iva ||
      Number(form.iva_pct ?? 16) !== initial.iva_pct ||
      !!form.tiene_ieps !== initial.tiene_ieps ||
      Number(form.ieps_pct ?? 0) !== initial.ieps_pct;

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
      sugeridoChanged ||
      costChanged ||
      taxChanged ||
      (form.calculo_costo ?? 'promedio') !== initial.calculo_costo ||
      JSON.stringify(currentLines) !== JSON.stringify(initial.lines)
    );
  }, [comboId, form, stagedLines]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      precio_sugerido_publico: priceSummary.sugerido,
      ...(linkToSuggested ? { precio_principal: priceSummary.sugerido } : {}),
    }));
  }, [linkToSuggested, priceSummary.sugerido]);

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

  const saveAll = async (forceSave = false) => {
    if (!form.codigo?.trim() || !form.nombre?.trim()) {
      toast.error('Código y nombre son obligatorios');
      return;
    }
    if (!empresa?.id) {
      toast.error('Sin empresa');
      return;
    }

    const precioPrincipal = Number(form.precio_principal ?? (comboId ? 0 : priceSummary.principal)) || 0;
    const costo = Number(form.costo ?? (form.calculo_costo !== 'manual' ? costSummary : 0)) || 0;
    const utilidad = precioPrincipal - costo;

    if (!forceSave && utilidad <= 0) {
      setShowConfirmModal(true);
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
        precio_principal: precioPrincipal,
        precio_sugerido_publico: Number(form.precio_sugerido_publico ?? priceSummary.sugerido) || 0,
        costo: costo,
        calculo_costo: form.calculo_costo ?? 'promedio',
        tiene_iva: !!form.tiene_iva,
        iva_pct: Number(form.iva_pct ?? 16),
        tiene_ieps: !!form.tiene_ieps,
        ieps_pct: Number(form.ieps_pct ?? 0),
        usa_listas_precio: !!form.usa_listas_precio,
        tarifa_id: form.usa_listas_precio ? form.tarifa_id ?? null : null,
        lista_id: null,
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

          <div className="grid md:grid-cols-2 gap-4">
            {/* Cost and Taxes Card (Left) */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Costo promedio</h3>
                  <p className="text-xs text-muted-foreground">Define el costo del combo para calcular ganancias.</p>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                  <input
                    type="checkbox"
                    checked={form.calculo_costo !== 'manual'}
                    onChange={(e) => {
                      const auto = e.target.checked;
                      if (!comboId) {
                        // Combo nuevo, cambiar directamente
                        setForm((prev) => ({
                          ...prev,
                          calculo_costo: auto ? 'promedio' : 'manual',
                          costo: auto ? costSummary : prev.costo || 0,
                        }));
                        return;
                      }
                      
                      // Combo existente, pedir confirmación
                      setCostModeModal({ type: auto ? 'to_auto' : 'to_manual' });
                    }}
                    className="rounded border-input h-3.5 w-3.5"
                  />
                  Costo automático
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-muted/20 rounded-lg p-3">
                <div>
                  <div className="text-xxs font-medium text-muted-foreground uppercase tracking-wider">Sin impuestos</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">
                    {form.calculo_costo !== 'manual' ? (
                      `$ ${costSummary.toFixed(2)}`
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">$</span>
                        <input
                          type="number"
                          step="0.01;any"
                          min="0"
                          value={form.costo ?? 0}
                          onChange={(e) => set('costo', Number(e.target.value) || 0)}
                          className="bg-transparent border-b border-border focus:border-primary focus:outline-none w-20 text-lg font-semibold p-0"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xxs font-medium text-muted-foreground uppercase tracking-wider">Con impuestos</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-primary">
                    $ {((form.costo ?? 0) * (1 + ((form.tiene_iva ? (form.iva_pct ?? 16) : 0) + (form.tiene_ieps ? (form.ieps_pct ?? 0) : 0)) / 100)).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Impuestos block */}
              <div className="border-t border-border pt-3 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground">Impuestos aplicados al combo</div>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.tiene_iva}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setForm((prev) => ({
                          ...prev,
                          tiene_iva: val,
                          iva_pct: val ? prev.iva_pct || 16 : 0,
                        }));
                      }}
                      className="rounded border-input h-3.5 w-3.5"
                    />
                    Aplicar IVA
                  </label>
                  {form.tiene_iva && (
                    <div className="flex gap-1">
                      {[0, 8, 16].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => set('iva_pct', rate)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${form.iva_pct === rate ? 'bg-primary text-primary-foreground border-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                        >
                          {rate}%
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.tiene_ieps}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setForm((prev) => ({
                          ...prev,
                          tiene_ieps: val,
                          ieps_pct: val ? prev.ieps_pct || 8 : 0,
                        }));
                      }}
                      className="rounded border-input h-3.5 w-3.5"
                    />
                    Aplicar IEPS
                  </label>
                  {form.tiene_ieps && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={form.ieps_pct ?? 0}
                        onChange={(e) => set('ieps_pct', Number(e.target.value) || 0)}
                        className="w-12 h-6 text-center border border-border rounded text-xs"
                      />
                      <span>%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Price and Mode Card (Right) */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm font-semibold">Modo de precio</h3>
                    <p className="text-xs text-muted-foreground">Elige si este combo usa precio directo o una lista de precios.</p>
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

                <div className={form.usa_listas_precio ? "grid md:grid-cols-2 gap-4 items-end" : "space-y-2"}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">Precio principal</label>
                      <label className="flex items-center gap-1 cursor-pointer text-[10px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={linkToSuggested}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setLinkToSuggested(checked);
                            if (checked) {
                              setForm(prev => ({ ...prev, precio_principal: priceSummary.sugerido }));
                            }
                          }}
                          className="rounded border-input h-3 w-3"
                        />
                        Vincular al sugerido
                      </label>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.precio_principal ?? 0}
                      disabled={linkToSuggested}
                      onChange={(e) => {
                        setPriceManuallyEdited(true);
                        set('precio_principal', Number(e.target.value) || 0);
                      }}
                    />
                  </div>
                  {form.usa_listas_precio && (
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
                    </div>
                  )}
                </div>

                {/* Sub-grid of price cards */}
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {/* Always show suggested price */}
                  <div className={`rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 ${form.usa_listas_precio ? 'col-span-1' : 'col-span-2'}`}>
                    <div className="text-xs font-medium text-muted-foreground">Precio sugerido</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">$ {priceSummary.sugerido.toFixed(2)}</div>
                    <p className="text-[10px] text-muted-foreground leading-tight">Calculado de los componentes.</p>
                  </div>

                  {form.usa_listas_precio && (
                    (() => {
                      const activeRule = (tarifaLineas ?? []).find((linea: any) => {
                        const ruleListaId = linea.lista_precios?.id ?? linea.lista_precio_id;
                        return ruleListaId === form.lista_id;
                      });

                      if (!activeRule) {
                        return (
                          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 flex flex-col justify-between">
                            <div>
                              <div className="text-xs font-medium text-muted-foreground">Precio de la lista</div>
                              <div className="mt-1 text-lg font-semibold tabular-nums">$ {(form.precio_principal ?? 0).toFixed(2)}</div>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-tight mt-1">Sin regla (usa precio principal).</p>
                          </div>
                        );
                      }

                      const pr = form.precio_principal ?? 0;
                      const costo = form.costo ?? 0;
                      const ivaPct = form.tiene_iva ? (form.iva_pct ?? 16) : 0;
                      const iepsPct = form.tiene_ieps ? (form.ieps_pct ?? 0) : 0;
                      const taxMult = 1 + (ivaPct + iepsPct) / 100;

                      let rawSinImp = 0;
                      let ruleText = 'Precio fijo';
                      if (activeRule.tipo_calculo === 'margen_costo') {
                        rawSinImp = Math.max(costo * (1 + ((activeRule.margen_pct as number) ?? 0) / 100), (activeRule.precio_minimo as number) ?? 0);
                        ruleText = `Fórmula (+${activeRule.margen_pct}% s/costo)`;
                      } else if (activeRule.tipo_calculo === 'descuento_precio') {
                        rawSinImp = Math.max(pr * (1 - ((activeRule.descuento_pct as number) ?? 0) / 100), (activeRule.precio_minimo as number) ?? 0);
                        ruleText = `Descuento (-${activeRule.descuento_pct}% s/precio)`;
                      } else {
                        rawSinImp = Math.max((activeRule.precio as number) ?? 0, (activeRule.precio_minimo as number) ?? 0);
                        ruleText = `Precio fijo ($ ${Number(activeRule.precio).toFixed(2)})`;
                      }

                      const basePrecio = (activeRule.base_precio ?? 'sin_impuestos') as string;
                      let precioSinImp: number;
                      if (basePrecio === 'con_impuestos') {
                        const precioConImp = applyRedondeo(rawSinImp * taxMult, activeRule.redondeo as string ?? 'ninguno');
                        precioSinImp = precioConImp / taxMult;
                      } else {
                        precioSinImp = applyRedondeo(rawSinImp, activeRule.redondeo as string ?? 'ninguno');
                      }

                      return (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 flex flex-col justify-between">
                          <div>
                            <div className="text-xs font-medium text-primary">Precio de la lista</div>
                            <div className="mt-1 text-lg font-semibold tabular-nums text-primary">$ {precioSinImp.toFixed(2)}</div>
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-tight mt-1 truncate" title={ruleText}>
                            {ruleText}
                          </p>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Utilidad block */}
                <div className={`p-3 rounded-lg border flex items-center justify-between text-xs transition-colors ${
                  isUtilidadPositiva
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-destructive/10 border-destructive/20 text-destructive'
                }`}>
                  <div className="space-y-0.5">
                    <span className="font-medium text-muted-foreground text-[10px] uppercase tracking-wider block">Utilidad estimada</span>
                    <span className="text-sm font-semibold font-mono">
                      $ {currentUtilidad.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="font-medium text-muted-foreground text-[10px] uppercase tracking-wider block">Margen</span>
                    <span className="text-sm font-semibold font-mono">
                      {currentMargenPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              {form.usa_listas_precio && (
                <p className="text-[11px] text-muted-foreground">
                  El combo usará los precios de la lista seleccionada. El precio directo queda como referencia.
                </p>
              )}
            </div>
          </div>

          {/* Listas de Precios y Variantes Rule Table */}
          {comboId ? (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Listas de precios y Variantes</h3>
                  <p className="text-xs text-muted-foreground">Define reglas de precio para mayoreo, menudeo, clientes específicos, etc.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 text-xs font-medium border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40"
                  onClick={() => {
                    setNewPriceRule({
                      aplica_a: 'producto',
                      clasificacion_ids: [],
                      tarifa_id: '',
                      lista_precio_id: '',
                      tipo_calculo: 'precio_fijo',
                      precio: form.precio_principal || 0,
                      margen_pct: 0,
                      descuento_pct: 0,
                      precio_minimo: form.costo || 0,
                    });
                    setShowPriceModal(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar un precio
                </Button>
              </div>

              <div className="overflow-x-auto border border-border rounded-lg bg-background">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="py-2 px-3 text-left font-semibold text-muted-foreground">Tarifa</th>
                      <th className="py-2 px-3 text-left font-semibold text-muted-foreground">Lista</th>
                      <th className="py-2 px-3 text-left font-semibold text-muted-foreground">Tipo</th>
                      <th className="py-2 px-3 text-right font-semibold text-muted-foreground">Valor</th>
                      <th className="py-2 px-3 text-center font-semibold text-muted-foreground">Redondeo</th>
                      <th className="py-2 px-3 text-center font-semibold text-muted-foreground">Base</th>
                      <th className="py-2 px-3 text-right font-semibold text-muted-foreground">Precio s/imp</th>
                      <th className="py-2 px-3 text-right font-semibold text-muted-foreground">Precio c/imp</th>
                      <th className="py-2 px-3 text-right font-semibold text-muted-foreground">Ganancia $</th>
                      <th className="py-2 px-3 text-right font-semibold text-muted-foreground">Ganancia %</th>
                      <th className="py-2 px-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const allRulesFlat = (tarifaLineas ?? []).map((tl: any) => {
                        return {
                          ...tl,
                          _tarifaId: tl.tarifas?.id,
                          _tarifaNombre: tl.tarifas?.nombre,
                        };
                      });

                      if (allRulesFlat.length === 0) {
                        return (
                          <tr>
                            <td colSpan={11} className="text-center py-8 text-muted-foreground font-medium">
                              Sin precios alternativos aplicados a este combo.
                            </td>
                          </tr>
                        );
                      }

                      return allRulesFlat.map((linea: any) => {
                        const isEditing = editingPriceId === linea.id;
                        const currentVals = isEditing ? editPriceVal : linea;
                        const costo = form.costo ?? 0;
                        const ivaPct = form.tiene_iva ? (form.iva_pct ?? 16) : 0;
                        const iepsPct = form.tiene_ieps ? (form.ieps_pct ?? 0) : 0;
                        const taxMult = 1 + (ivaPct + iepsPct) / 100;
                        const basePrecio = ((isEditing ? (editPriceVal.base_precio ?? linea.base_precio) : linea.base_precio) ?? 'sin_impuestos') as string;
                        const redondeoVal = ((isEditing ? (editPriceVal.redondeo ?? linea.redondeo) : linea.redondeo) ?? 'ninguno') as string;
                        const redondeoLabel = ({ arriba: '⬆ Arriba', abajo: '⬇ Abajo', cercano: '↕ Cercano', ninguno: '—' } as Record<string, string>)[redondeoVal] ?? '—';
                        const baseLabel = basePrecio === 'con_impuestos' ? 'Con imp.' : 'Sin imp.';

                        const srcLinea = isEditing ? { ...linea, ...editPriceVal } : linea;
                        const pr = form.precio_principal ?? 0;
                        let rawSinImp = 0;
                        if (srcLinea.tipo_calculo === 'margen_costo') rawSinImp = Math.max(costo * (1 + ((srcLinea.margen_pct as number) ?? 0) / 100), (srcLinea.precio_minimo as number) ?? 0);
                        else if (srcLinea.tipo_calculo === 'descuento_precio') rawSinImp = Math.max(pr * (1 - ((srcLinea.descuento_pct as number) ?? 0) / 100), (srcLinea.precio_minimo as number) ?? 0);
                        else rawSinImp = Math.max((srcLinea.precio as number) ?? 0, (srcLinea.precio_minimo as number) ?? 0);

                        let precioSinImp: number, precioConImp: number;
                        if (basePrecio === 'con_impuestos') {
                          precioConImp = applyRedondeo(rawSinImp * taxMult, srcLinea.redondeo as string ?? 'ninguno');
                          precioSinImp = precioConImp / taxMult;
                        } else {
                          precioSinImp = applyRedondeo(rawSinImp, srcLinea.redondeo as string ?? 'ninguno');
                          precioConImp = precioSinImp * taxMult;
                        }

                        const ganancia = precioSinImp - costo;
                        const ganPct = costo > 0 ? (ganancia / costo) * 100 : 0;
                        const listaName = linea.lista_precios?.nombre;
                        const esPrincipal = linea.lista_precios?.es_principal;

                        const cellClick = (col: string) => (e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (editingPriceId === linea.id && editingPriceCol === col) return;
                          if (editingPriceId && editingPriceId !== linea.id) saveEditPrice(editingPriceId);
                          startEditPrice(linea, col);
                        };

                        const handleBlur = () => { setTimeout(() => saveEditPrice(linea.id), 150); };

                        return (
                          <tr key={linea.id} className="border-b border-border last:border-0 hover:bg-muted/10 font-medium">
                            <td className="py-2 px-3 text-muted-foreground">{linea._tarifaNombre}</td>
                            <td className="py-2 px-3">
                              {listaName ? (
                                <span className="flex items-center gap-1">
                                  {esPrincipal && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                                  {listaName}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-2 px-3 cursor-pointer" onClick={cellClick('tipo')}>
                              {isEditing && editingPriceCol === 'tipo' ? (
                                <select autoFocus className="border border-border rounded px-1.5 py-0.5 text-xs bg-background focus:outline-none" value={currentVals.tipo_calculo as string}
                                  onChange={e => setEditPriceVal(p => ({ ...p, tipo_calculo: e.target.value }))} onBlur={handleBlur}>
                                  <option value="precio_fijo">Precio fijo</option>
                                  <option value="margen_costo">Fórmula (margen)</option>
                                  <option value="descuento_precio">Descuento</option>
                                </select>
                              ) : (
                                <span className="underline decoration-dashed decoration-primary/40 underline-offset-2">
                                  {linea.tipo_calculo === 'margen_costo' ? `+${linea.margen_pct}% s/costo` : linea.tipo_calculo === 'descuento_precio' ? `-${linea.descuento_pct}% s/precio` : 'Precio fijo'}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right cursor-pointer" onClick={cellClick('valor')}>
                              {isEditing && editingPriceCol === 'valor' ? (
                                <input autoFocus type="number" step="any" className="border border-border rounded px-1.5 py-0.5 text-xs bg-background focus:outline-none w-16 text-right"
                                  value={(currentVals.tipo_calculo === 'precio_fijo' ? currentVals.precio : currentVals.tipo_calculo === 'margen_costo' ? currentVals.margen_pct : currentVals.descuento_pct) as number}
                                  onChange={e => { const v = +e.target.value; setEditPriceVal(p => ({ ...p, ...(p.tipo_calculo === 'precio_fijo' ? { precio: v } : p.tipo_calculo === 'margen_costo' ? { margen_pct: v } : { descuento_pct: v }) })); }}
                                  onBlur={handleBlur} onKeyDown={e => { if (e.key === 'Enter') handleBlur(); }} />
                              ) : (
                                <span className="underline decoration-dashed decoration-primary/40 underline-offset-2 font-mono">
                                  {linea.tipo_calculo === 'precio_fijo' ? `$ ${(linea.precio ?? 0).toFixed(2)}` : linea.tipo_calculo === 'margen_costo' ? `${linea.margen_pct}%` : `${linea.descuento_pct}%`}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center cursor-pointer" onClick={cellClick('redondeo')}>
                              {isEditing && editingPriceCol === 'redondeo' ? (
                                <select autoFocus className="border border-border rounded px-1.5 py-0.5 text-xs bg-background focus:outline-none" value={(currentVals.redondeo as string) ?? 'ninguno'}
                                  onChange={e => setEditPriceVal(p => ({ ...p, redondeo: e.target.value }))} onBlur={handleBlur}>
                                  <option value="ninguno">Ninguno</option>
                                  <option value="arriba">Arriba</option>
                                  <option value="abajo">Abajo</option>
                                  <option value="cercano">Cercano</option>
                                </select>
                              ) : (
                                <span className="underline decoration-dashed decoration-primary/40 underline-offset-2">{redondeoLabel}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center cursor-pointer" onClick={cellClick('base')}>
                              {isEditing && editingPriceCol === 'base' ? (
                                <select autoFocus className="border border-border rounded px-1.5 py-0.5 text-xs bg-background focus:outline-none" value={(currentVals.base_precio as string) ?? 'sin_impuestos'}
                                  onChange={e => setEditPriceVal(p => ({ ...p, base_precio: e.target.value }))} onBlur={handleBlur}>
                                  <option value="sin_impuestos">Sin impuestos</option>
                                  <option value="con_impuestos">Con impuestos</option>
                                </select>
                              ) : (
                                <span className="underline decoration-dashed decoration-primary/40 underline-offset-2">{baseLabel}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold font-mono text-muted-foreground">$ {precioSinImp.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-semibold font-mono text-primary">$ {precioConImp.toFixed(2)}</td>
                            <td className={`py-2 px-3 text-right font-semibold font-mono ${ganancia >= 0 ? 'text-green-600' : 'text-destructive'}`}>$ {ganancia.toFixed(2)}</td>
                            <td className={`py-2 px-3 text-right font-semibold font-mono ${ganPct >= 0 ? 'text-green-600' : 'text-destructive'}`}>{ganPct.toFixed(1)}%</td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeletePriceRule(linea.id)}
                                className="text-destructive hover:text-destructive/80 transition-colors p-1 rounded hover:bg-destructive/5"
                                title="Eliminar regla de precio"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border border-dashed bg-muted/10 p-5 text-center text-xs text-muted-foreground font-medium">
              💡 Guarda el combo por primera vez para poder configurar múltiples listas de precios y variantes (ej. Mayoreo, Menudeo, Especiales, etc.).
            </div>
          )}

          {/* Pricing Rule Creator Modal */}
          {showPriceModal && (
            <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPriceModal(false)}>
              <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-[540px] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/15">
                  <h3 className="text-sm font-semibold text-foreground">Crear regla de precio</h3>
                  <button onClick={() => setShowPriceModal(false)} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
                </div>
                <div className="p-4 space-y-4 text-xs font-medium">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground text-xxs uppercase tracking-wider">Aplica a</span>
                      <div className="px-3 py-2 bg-muted/30 rounded border border-border font-medium text-foreground">
                        Este Combo: {form.nombre}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground text-xxs uppercase tracking-wider">Costo base (Ref.)</span>
                      <div className="px-3 py-2 bg-muted/30 rounded border border-border font-mono font-medium text-foreground">
                        $ {(form.costo ?? 0).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-muted-foreground text-xxs uppercase tracking-wider">Lista de precios</span>
                    <SearchableSelect
                      options={(allListas ?? []).map((l: any) => ({
                        value: l.id,
                        label: `${l.es_principal ? '★ ' : ''}${l.nombre}`,
                        searchText: l.nombre,
                      }))}
                      value={newPriceRule.lista_precio_id}
                      onChange={val => {
                        const lista = (allListas ?? []).find((l: any) => l.id === val);
                        setNewPriceRule(p => ({ ...p, lista_precio_id: val, tarifa_id: (lista as any)?.tarifa_id ?? '' }));
                      }}
                      placeholder="Selecciona una lista..."
                      onCreateNew={handleCreateLista}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground text-xxs uppercase tracking-wider">Tipo de precio</span>
                      <div className="flex flex-col gap-2 pt-1">
                        {(['precio_fijo', 'margen_costo', 'descuento_precio'] as TipoCalculoTarifa[]).map(t => (
                          <label key={t} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                            <input type="radio" name="tipo_calc" checked={newPriceRule.tipo_calculo === t} onChange={() => setNewPriceRule(p => ({ ...p, tipo_calculo: t }))} className="h-3.5 w-3.5 border-input" />
                            {t === 'precio_fijo' ? 'Precio fijo' : t === 'margen_costo' ? 'Fórmula (margen %)' : 'Descuento %'}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 flex flex-col justify-end">
                      {newPriceRule.tipo_calculo === 'precio_fijo' && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground text-xxs uppercase tracking-wider">Precio fijo</span>
                          <Input type="number" step="0.01" value={newPriceRule.precio} onChange={e => setNewPriceRule(p => ({ ...p, precio: +e.target.value || 0 }))} />
                        </div>
                      )}
                      {newPriceRule.tipo_calculo === 'margen_costo' && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground text-xxs uppercase tracking-wider">Margen %</span>
                          <Input type="number" step="any" value={newPriceRule.margen_pct} onChange={e => setNewPriceRule(p => ({ ...p, margen_pct: +e.target.value || 0 }))} />
                        </div>
                      )}
                      {newPriceRule.tipo_calculo === 'descuento_precio' && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground text-xxs uppercase tracking-wider">Descuento %</span>
                          <Input type="number" step="any" value={newPriceRule.descuento_pct} onChange={e => setNewPriceRule(p => ({ ...p, descuento_pct: +e.target.value || 0 }))} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted/10">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowPriceModal(false)}>Descartar</Button>
                  <Button type="button" size="sm" onClick={handleSavePriceRule} disabled={saveTarifaLinea.isPending}>Guardar regla</Button>
                </div>
              </div>
            </div>
          )}

          {showConfirmModal && (
            <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowConfirmModal(false)}>
              <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-[400px] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/15">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Confirmar precio del combo
                  </h3>
                  <button onClick={() => setShowConfirmModal(false)} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-5 space-y-4 text-sm font-medium">
                  <p className="text-muted-foreground leading-relaxed">
                    La utilidad calculada para este combo es de{' '}
                    <span className="font-semibold text-destructive font-mono">
                      $ {((form.precio_principal ?? 0) - (form.costo ?? 0)).toFixed(2)}
                    </span>{' '}
                    (no es positiva).
                  </p>
                  <p className="text-foreground">
                    ¿Deseas mantener este precio y guardar el combo de todos modos?
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted/10">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setShowConfirmModal(false)}
                  >
                    No, corregir precio
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={() => {
                      setShowConfirmModal(false);
                      saveAll(true);
                    }}
                  >
                    Sí, guardar combo
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={close} disabled={saving} className="gap-2 min-w-[140px]">
              Descartar
            </Button>
            <Button type="button" onClick={() => saveAll(false)} disabled={saving || (!comboId ? false : !hasChanges)} className="gap-2 min-w-[180px]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar combo
            </Button>
          </div>
          {costModeModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <h3 className="text-[15px] font-semibold">
                      {costModeModal.type === 'to_manual' ? 'Cambiar a costo manual' : 'Cambiar a costo automático'}
                    </h3>
                  </div>
                  <button onClick={() => setCostModeModal(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-5 py-5 space-y-3">
                  {costModeModal.type === 'to_manual' ? (
                    <>
                      <p className="text-[13px] text-foreground">
                        ¿Estás seguro de desactivar el costo automático?
                      </p>
                      <p className="text-[13px] text-muted-foreground">
                        El costo del combo ya no se actualizará automáticamente cuando cambies los componentes. Tendrás que capturarlo tú mismo.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[13px] text-foreground">
                        El costo automático se activará y recalculará el costo en base a los componentes del combo cuando guardes los cambios.
                      </p>
                      <p className="text-[13px] text-muted-foreground">
                        Durante la edición, el campo de costo se bloqueará.
                      </p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
                  <button
                    onClick={confirmCostModeChange}
                    className="btn-odoo-primary"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setCostModeModal(null)}
                    className="btn-odoo-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
