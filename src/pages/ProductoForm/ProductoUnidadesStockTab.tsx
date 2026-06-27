import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Star, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductoPresentacion } from '@/hooks/usePresentaciones';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useCurrency } from '@/hooks/useCurrency';

interface Props {
  isNew: boolean;
  esGranel: boolean;
  unidadGranel: string;
  precioPrincipal: number;
  stock: number;
  presentaciones: ProductoPresentacion[];
  setPresentaciones: React.Dispatch<React.SetStateAction<ProductoPresentacion[]>>;
  setDeletedPresentaciones: React.Dispatch<React.SetStateAction<string[]>>;
  unidadesCatalog: any[];
}

export function ProductoUnidadesStockTab({ isNew, esGranel, unidadGranel, precioPrincipal, stock, presentaciones, setPresentaciones, setDeletedPresentaciones, unidadesCatalog }: Props) {
  const { symbol, fmt } = useCurrency();
  const unidadBase = esGranel ? unidadGranel : 'pz';

  const [draft, setDraft] = useState<{ codigo_barras: string; nombre: string; factor_base: string; precio_especial: string; unidad_id: string }>({
    codigo_barras: '', nombre: '', factor_base: '', precio_especial: '', unidad_id: ''
  });
  
  const [deleteTarget, setDeleteTarget] = useState<ProductoPresentacion | null>(null);

  // Auto-generate name when unidad_id or factor_base changes
  useEffect(() => {
    if (!draft.unidad_id) return;
    const unidad = unidadesCatalog.find(u => u.id === draft.unidad_id);
    if (!unidad) return;
    
    // Only auto-update if the user hasn't explicitly typed a custom name that doesn't match the auto-pattern
    const isAutoName = !draft.nombre || unidadesCatalog.some(u => draft.nombre.startsWith(u.nombre));
    if (isAutoName) {
      let newName = unidad.nombre;
      if (draft.factor_base) {
        newName += ` ${draft.factor_base} ${unidadBase}`;
      }
      setDraft(prev => ({ ...prev, nombre: newName }));
    }
  }, [draft.unidad_id, draft.factor_base, unidadesCatalog, unidadBase]);

  const onAdd = () => {
    const factor = Number(draft.factor_base);
    if (!draft.nombre.trim() || !factor || factor <= 0) {
      toast.error('Nombre y factor son obligatorios');
      return;
    }
    
    const newPres: ProductoPresentacion = {
      id: `temp-${crypto.randomUUID()}`,
      empresa_id: '',
      producto_id: '',
      codigo_barras: draft.codigo_barras.trim() || null,
      nombre: draft.nombre.trim(),
      factor_base: factor,
      precio_especial: draft.precio_especial ? Number(draft.precio_especial) : null,
      orden: presentaciones.length,
      activo: true,
      es_principal_stock: presentaciones.length === 0, // First one is principal by default
      unidad_id: draft.unidad_id || null
    };

    setPresentaciones(prev => [...prev, newPres]);
    setDraft({ codigo_barras: '', nombre: '', factor_base: '', precio_especial: '', unidad_id: '' });
  };

  const onUpdate = (pId: string, patch: Partial<ProductoPresentacion>) => {
    setPresentaciones(prev => prev.map(p => p.id === pId ? { ...p, ...patch } : p));
  };

  const onTogglePrincipal = (pId: string) => {
    setPresentaciones(prev => prev.map(p => ({
      ...p,
      es_principal_stock: p.id === pId ? !p.es_principal_stock : false // Only one can be principal
    })));
  };

  const onConfirmDelete = () => {
    if (!deleteTarget) return;
    setPresentaciones(prev => prev.filter(p => p.id !== deleteTarget.id));
    if (!deleteTarget.id.startsWith('temp-')) {
      setDeletedPresentaciones(prev => [...prev, deleteTarget.id]);
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 p-1">
      <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/15 rounded-lg p-4 space-y-2">
        <p>Define las presentaciones de empaque (ej. <strong>Caja 12 {unidadBase}</strong>, <strong>Six pack 6 {unidadBase}</strong>). El factor es cuántas unidades base ({unidadBase}) trae cada presentación. El stock se sigue contando en {unidadBase}.</p>
        <p>Marca con la <Star className="h-3 w-3 inline text-warning" /> la presentación <strong>principal</strong> para mostrar el desglose de stock (ej. "1 caja + 6 {unidadBase}") en listados e inventario.</p>
        <p> El <strong>Nombre / Descripción</strong> se crea automáticamente al seleccionar la unidad y el factor para mayor facilidad, pero es un campo totalmente <strong>editable</strong>.</p>
        <p className="flex items-center gap-1.5 mt-1 text-primary font-medium">
          <Info className="h-4 w-4" />
          <span>El <strong>código de barras</strong> debe ser único en toda la empresa. Si dos presentaciones comparten el mismo código, el POS no sabrá cuál elegir.</span>
        </p>
        <p className="text-warning-foreground bg-warning/10 border border-warning/20 rounded-md p-2 mt-2 font-medium">
          <strong>Nota:</strong> Debes presionar el botón <strong>Guardar</strong> en la parte superior/inferior del formulario del producto para aplicar los cambios en las presentaciones. De lo contrario, los cambios se descartarán automáticamente al salir.
        </p>
      </div>

      <div className="bg-accent/10 border border-border rounded-xl p-4 sm:p-5">
        <h4 className="text-sm font-semibold mb-4">Agregar Presentación</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Unidad (Catálogo)</label>
            <select
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
              value={draft.unidad_id}
              onChange={(e) => setDraft({ ...draft, unidad_id: e.target.value })}
            >
              <option value="">(Selecciona)</option>
              {unidadesCatalog.map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nombre / Descripción</label>
            <input
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
              placeholder={esGranel ? `Bulto X ${unidadBase}` : `Caja 12 ${unidadBase}`}
              value={draft.nombre}
              onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Factor ({unidadBase})</label>
            <input
              type="number" step="0.001"
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm tabular-nums focus:ring-1 focus:ring-primary outline-none"
              placeholder="Ej. 12"
              value={draft.factor_base}
              onChange={(e) => setDraft({ ...draft, factor_base: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Precio Especial
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded ml-2">Opcional</span>
            </label>
            <input
              type="number" step="0.01"
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm tabular-nums focus:ring-1 focus:ring-primary outline-none"
              placeholder="Precio directo"
              value={draft.precio_especial}
              onChange={(e) => setDraft({ ...draft, precio_especial: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Código Barras
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded ml-2">Opcional</span>
            </label>
            <div className="flex gap-2">
              <input
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                placeholder="Escanea aquí"
                value={draft.codigo_barras}
                onChange={(e) => setDraft({ ...draft, codigo_barras: e.target.value })}
              />
              <button
                type="button"
                onClick={onAdd}
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 shadow-sm flex-shrink-0"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="text-center px-4 py-3 w-12" title="Principal"><Star className="h-3.5 w-3.5 inline" /></th>
              <th className="text-left px-4 py-3 min-w-[120px]">Código de Barras</th>
              <th className="text-left px-4 py-3">Unidad / Nombre</th>
              <th className="text-right px-4 py-3 w-28">Factor</th>
              <th className="text-right px-4 py-3 w-32">P. Especial</th>
              <th className="text-center px-4 py-3 w-24">Stock ({unidadBase})</th>
              <th className="text-center px-4 py-3 w-16">Activo</th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {presentaciones.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  No hay presentaciones configuradas. Usa el formulario de arriba para agregar una.
                </td>
              </tr>
            )}
            {presentaciones.map(p => {
              const qtyStock = Math.floor(stock / Number(p.factor_base));
              
              return (
                <tr key={p.id} className="group bg-card hover:bg-accent/20 transition-colors">
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onTogglePrincipal(p.id)}
                      title={p.es_principal_stock ? 'Presentación principal' : 'Marcar como principal'}
                      className={`p-1.5 rounded-full hover:bg-accent transition-all ${p.es_principal_stock ? 'text-warning bg-warning/10' : 'text-muted-foreground/30 hover:text-muted-foreground'}`}
                    >
                      <Star className={`h-4 w-4 ${p.es_principal_stock ? 'fill-current' : ''}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <input className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none py-1 text-xs"
                      defaultValue={p.codigo_barras || ''}
                      placeholder="Sin código"
                      onBlur={(e) => e.target.value !== (p.codigo_barras || '') && onUpdate(p.id, { codigo_barras: e.target.value || null })} />
                  </td>
                  <td className="px-4 py-3 space-y-1">
                    <div className="flex gap-2">
                      <select
                        className="bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none py-1 text-xs font-medium text-muted-foreground w-24"
                        value={p.unidad_id || ''}
                        onChange={(e) => onUpdate(p.id, { unidad_id: e.target.value || null })}
                      >
                        <option value="">(Sin unid.)</option>
                        {unidadesCatalog.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                      </select>
                      <input className="flex-1 bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none py-1 font-semibold"
                        defaultValue={p.nombre || ''}
                        onBlur={(e) => e.target.value !== p.nombre && onUpdate(p.id, { nombre: e.target.value })} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input type="number" step="0.001" className="w-full text-right bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none py-1 tabular-nums font-medium"
                      defaultValue={p.factor_base}
                      onBlur={(e) => Number(e.target.value) !== Number(p.factor_base) && onUpdate(p.id, { factor_base: Number(e.target.value) })} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input type="number" step="0.01" className="w-full text-right bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none py-1 tabular-nums font-medium"
                      defaultValue={p.precio_especial || ''}
                      placeholder="-"
                      onBlur={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        if (val !== p.precio_especial) onUpdate(p.id, { precio_especial: val });
                      }} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex items-center justify-center bg-accent/50 px-2.5 py-1 rounded-md">
                      <span className="tabular-nums font-bold" title={`${qtyStock} empaques enteros disponibles`}>
                        {qtyStock > 0 ? qtyStock : '0'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={p.activo} onChange={(e) => onUpdate(p.id, { activo: e.target.checked })} />
                      <div className="w-9 h-5 bg-border rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setDeleteTarget(p)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md p-1.5 transition-colors" title="Eliminar presentación">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar presentación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la presentación <strong>{deleteTarget?.nombre}</strong>. Para guardar los cambios, recuerda hacer clic en Guardar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
