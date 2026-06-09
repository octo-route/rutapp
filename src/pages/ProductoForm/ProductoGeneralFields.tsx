import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { OdooField } from '@/components/OdooFormField';
import SearchableSelect from '@/components/SearchableSelect';
import type { Producto, Marca, Proveedor, Clasificacion, Lista, Unidad, UnidadSat } from '@/types';

interface TarifaOption { id: string; nombre: string; tarifa_id?: string }
import { useCurrency } from '@/hooks/useCurrency';

interface Props {
  form: Partial<Producto>;
  set: (key: keyof Producto, value: any) => void;
  setForm: (fn: (prev: Partial<Producto>) => Partial<Producto>) => void;
  marcas?: Marca[];
  clasificaciones?: Clasificacion[];
  listas?: Lista[];
  tarifasDisp?: TarifaOption[];
  unidades?: Unidad[];
  unidadesSat?: UnidadSat[];
  createMarca: (n: string) => Promise<string | undefined>;
  createClasificacion: (n: string) => Promise<string | undefined>;
  createUnidad: (n: string) => Promise<string | undefined>;
  createLista: (n: string) => Promise<string | undefined>;
}

const findName = (list: { id: string; nombre: string }[] | undefined, id: string | undefined) =>
  list?.find(i => i.id === id)?.nombre ?? '';
const findUnit = (list: { id: string; nombre: string; abreviatura?: string }[] | undefined, id: string | undefined) => {
  const u = list?.find(i => i.id === id);
  return u ? `${u.nombre}${u.abreviatura ? ` (${u.abreviatura})` : ''}` : '';
};

const costLabels: Record<string, string> = {
  promedio: 'Promedio',
  ultimo: 'Último costo de compra',
  estandar: 'Estándar',
  manual: 'Manual',
  ultimo_compra: 'Último costo (compra directa)',
  ultimo_proveedor: 'Último costo del proveedor principal',
};

export function ProductoGeneralFields({ form, set, setForm, marcas, clasificaciones, listas, tarifasDisp, unidades, unidadesSat, createMarca, createClasificacion, createUnidad, createLista }: Props) {
  const { fmt, symbol } = useCurrency();
  const isNew = !form.id;

  // Modal de confirmación para editar costo manualmente
  const [showCostoModal, setShowCostoModal] = useState(false);
  const [pendingCosto, setPendingCosto] = useState<number | null>(null);

  const costoEsAutomatico = !(form as any).costo_manual && (form.calculo_costo ?? 'promedio') !== 'manual';

  const handleCostoChange = (val: string | number) => {
    const num = +val;
    if (costoEsAutomatico && !isNew) {
      // Guardar el valor pendiente y mostrar modal
      setPendingCosto(num);
      setShowCostoModal(true);
    } else {
      set('costo', num);
    }
  };

  const confirmEditarCosto = () => {
    if (pendingCosto !== null) set('costo', pendingCosto);
    setForm(f => ({ ...f, costo_manual: true, calculo_costo: 'manual' } as any));
    setPendingCosto(null);
    setShowCostoModal(false);
  };

  const cancelEditarCosto = () => {
    setPendingCosto(null);
    setShowCostoModal(false);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 mb-4 pb-4 border-b border-border">
        <div>
          <OdooField label="Código" value={form.codigo} help onChange={v => set('codigo', v)} alwaysEdit={isNew} required />
          <OdooField label="Clave alterna" value={form.clave_alterna} onChange={v => set('clave_alterna', v)} />
          <OdooField label="Nombre en Compras" value={(form as any).nombre_compra ?? ''} onChange={v => set('nombre_compra' as any, v || null)} placeholder={form.nombre || 'Usa el nombre principal'} />
          <OdooField label="Nombre en Ventas" value={(form as any).nombre_venta ?? ''} onChange={v => set('nombre_venta' as any, v || null)} placeholder={form.nombre || 'Usa el nombre principal'} />
          <OdooField label="Nombre en Ticket" value={(form as any).nombre_ticket ?? ''} onChange={v => set('nombre_ticket' as any, v || null)} placeholder={form.nombre || 'Corto para impresora térmica'} />
          <OdooField label="Marca" value={form.marca_id} type="select" options={marcas?.map(m => ({ value: m.id, label: m.nombre })) ?? []} onChange={v => set('marca_id', v || null)} format={() => findName(marcas, form.marca_id ?? undefined)} onCreateNew={createMarca} />
          <OdooField label="Categoría" value={form.clasificacion_id} type="select" options={clasificaciones?.map(c => ({ value: c.id, label: c.nombre })) ?? []} onChange={v => set('clasificacion_id', v || null)} format={() => findName(clasificaciones, form.clasificacion_id ?? undefined)} onCreateNew={createClasificacion} />
          <OdooField label="Unid. venta" value={form.unidad_venta_id} type="select" options={unidades?.map(u => ({ value: u.id, label: `${u.nombre}${u.abreviatura ? ` (${u.abreviatura})` : ''}` })) ?? []} onChange={v => set('unidad_venta_id', v || null)} format={() => findUnit(unidades, form.unidad_venta_id ?? undefined)} onCreateNew={createUnidad} />
          <OdooField label="Unid. compra" value={form.unidad_compra_id} type="select" options={unidades?.map(u => ({ value: u.id, label: `${u.nombre}${u.abreviatura ? ` (${u.abreviatura})` : ''}` })) ?? []} onChange={v => set('unidad_compra_id', v || null)} format={() => findUnit(unidades, form.unidad_compra_id ?? undefined)} onCreateNew={createUnidad} />
          <OdooField label="Factor conversión" value={form.factor_conversion} type="number" onChange={v => set('factor_conversion', Number(v) || 1)} format={() => String(form.factor_conversion ?? 1)} />
          <div className="odoo-field-row">
            <span className="odoo-field-label">Producto a granel</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => set('es_granel', !form.es_granel)}
                className={`relative w-9 h-5 rounded-full transition-colors ${form.es_granel ? 'bg-primary' : 'bg-border'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.es_granel ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              {form.es_granel && (
                <select value={form.unidad_granel ?? 'kg'} onChange={e => set('unidad_granel', e.target.value)}
                  className="text-[12px] border border-border rounded px-2 py-0.5 bg-card text-foreground">
                  <option value="kg">Kilogramo (kg)</option>
                  <option value="g">Gramo (g)</option>
                  <option value="litro">Litro (L)</option>
                  <option value="ml">Mililitro (ml)</option>
                  <option value="pieza">Pieza (fraccionada)</option>
                </select>
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="odoo-field-row">
            <span className="odoo-field-label">Modo de precio</span>
            <div className="flex items-center gap-1">
              {['directo', 'listas'].map(mode => (
                <button key={mode} type="button" onClick={() => setForm(f => ({ ...f, usa_listas_precio: mode === 'listas' }))}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${((form as any).usa_listas_precio ? 'listas' : 'directo') === mode ? 'bg-primary text-primary-foreground border-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                  {mode === 'directo' ? 'Precio directo' : 'Listas de precio'}
                </button>
              ))}
            </div>
          </div>
          <OdooField
            label="Precio principal"
            value={form.precio_principal}
            type="number"
            teal
            help
            onChange={v => set('precio_principal', +v)}
            format={v => `${symbol} ${(v ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />

          {/* Campo Costo */}
          <OdooField
            label="Costo"
            value={form.costo}
            type="number"
            teal
            help
            onChange={handleCostoChange}
            format={v => `${symbol} ${(v ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            labelSuffix={costoEsAutomatico && !isNew
              ? <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Auto</span>
              : undefined
            }
          />

          <OdooField
            label="Precio sugerido público"
            value={(form as any).precio_sugerido_publico}
            type="number"
            help
            onChange={v => set('precio_sugerido_publico' as any, +v)}
            format={v => `${symbol} ${(Number(v) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />
          <OdooField label="Cálculo costo" value={form.calculo_costo} type="select" help
            options={[
              { value: 'manual', label: 'Manual' },
              { value: 'ultimo', label: 'Último costo de compra' },
              { value: 'ultimo_proveedor', label: 'Último costo del proveedor principal' },
              { value: 'promedio', label: 'Promedio' },
              { value: 'estandar', label: 'Estándar' },
              { value: 'ultimo_compra', label: 'Último costo (compra directa)' },
            ]}
            onChange={v => {
              set('calculo_costo', v);
              // Si cambian a manual desde el selector, también marcar costo_manual
              if (v === 'manual') setForm(f => ({ ...f, costo_manual: true } as any));
              else setForm(f => ({ ...f, costo_manual: false } as any));
            }}
            format={() => costLabels[form.calculo_costo ?? 'promedio'] ?? ''}
          />
          <OdooField label="Stock mínimo" value={form.min ?? 0} type="number" onChange={v => setForm(f => ({ ...f, min: Number(v) }))} placeholder="0" />
          <OdooField label="Stock máximo" value={form.max ?? 0} type="number" onChange={v => setForm(f => ({ ...f, max: Number(v) }))} placeholder="0" />
        </div>
      </div>

      {/* Modal de confirmación: editar costo manual */}
      {showCostoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h3 className="text-[15px] font-semibold">Editar costo manualmente</h3>
              </div>
              <button onClick={cancelEditarCosto} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-3">
              <p className="text-[13px] text-foreground">
                Editar el costo manualmente <strong>eliminará el historial de cálculo basado en compras</strong> para este producto.
              </p>
              <p className="text-[13px] text-muted-foreground">
                A partir de este momento el costo no se actualizará automáticamente al recibir compras. Puedes restaurar el cálculo automático cambiando la opción "Cálculo costo" a <em>Promedio</em> u otra.
              </p>
              {pendingCosto !== null && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg text-[13px]">
                  <span className="text-muted-foreground">Nuevo costo:</span>
                  <span className="font-semibold text-foreground">{symbol} {pendingCosto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
              <button
                onClick={confirmEditarCosto}
                className="btn-odoo-primary"
              >
                Confirmar y editar
              </button>
              <button
                onClick={cancelEditarCosto}
                className="btn-odoo-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
