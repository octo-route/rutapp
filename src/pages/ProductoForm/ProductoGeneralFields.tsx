import { useState } from 'react';
import { createPortal } from 'react-dom';
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

const isMethodAuto = (method: string) => method !== 'manual' && method !== 'estandar';

const modalContentMap: Record<string, { title: string; message: string; details: string }> = {
  manual: {
    title: 'Cambiar a cálculo manual',
    message: '¿Estás seguro de cambiar a cálculo manual?',
    details: 'A partir de este momento el costo no se actualizará automáticamente al recibir compras. Tendrás que capturarlo tú mismo.\n\nDurante la edición, podrás modificar el campo de costo libremente.',
  },
  promedio: {
    title: 'Cambiar a costo promedio',
    message: 'El costo se calculará de forma automática usando el promedio ponderado móvil.',
    details: 'El costo se recalculará basándose en todo el historial de entradas y compras.\n\nAl cambiar de modo, puede tardar en actualizarse, ya que se hace el cálculo completo desde la base de datos.\n\nDurante la edición, el campo de costo se bloqueará y se actualizara hasta que se le de en guardar al producto.',
  },
  ultimo: {
    title: 'Cambiar a último costo de compra',
    message: 'El costo se actualizará automáticamente con el valor de la última compra registrada.',
    details: 'Al recibir una compra, el costo del producto se actualizará directamente al último precio de compra (incluyendo descuentos).\n\nDurante la edición, el campo de costo se bloqueará y se actualizara hasta que se le de en guardar al producto.',
  },
  ultimo_proveedor: {
    title: 'Cambiar a último costo del proveedor principal',
    message: 'El costo se actualizará automáticamente con el último precio de compra registrado con el proveedor principal.',
    details: 'El costo tomará directamente el valor de la última compra realizada al proveedor principal asignado al producto.\n\nDurante la edición, el campo de costo se bloqueará y se actualizara hasta que se le de en guardar al producto.',
  },
  ultimo_compra: {
    title: 'Cambiar a último costo (compra directa)',
    message: 'El costo se actualizará automáticamente con el valor de la última compra directa registrada.',
    details: 'El costo tomará el valor de la última compra directa registrada en el sistema.\n\nDurante la edición, el campo de costo se bloqueará y se actualizara hasta que se le de en guardar al producto.',
  },
};

export function ProductoGeneralFields({ form, set, setForm, marcas, clasificaciones, listas, tarifasDisp, unidades, unidadesSat, createMarca, createClasificacion, createUnidad, createLista }: Props) {
  const { fmt, symbol } = useCurrency();
  const isNew = !form.id;

  const uVenta = unidades?.find(u => u.id === form.unidad_venta_id);
  const uCompra = unidades?.find(u => u.id === form.unidad_compra_id);
  const salesUnitName = uVenta?.nombre ? uVenta.nombre.toLowerCase() : 'venta';
  const purchaseUnitName = uCompra?.nombre ? uCompra.nombre.toLowerCase() : 'compra';

  // Modal de confirmación para cambios de cálculo de costo
  const [modalConfig, setModalConfig] = useState<{ type: string; pendingVal: any } | null>(null);

  const handleCalculoCostoChange = (newVal: any) => {
    const prevVal = form.calculo_costo ?? 'promedio';
    if (isNew) {
      set('calculo_costo', newVal);
      return;
    }

    if (newVal === prevVal) return;

    setModalConfig({ type: newVal, pendingVal: newVal });
  };

  const confirmModal = () => {
    if (modalConfig) {
      set('calculo_costo', modalConfig.pendingVal);
      setModalConfig(null);
    }
  };

  const cancelModal = () => {
    setModalConfig(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 mb-4 pb-4 border-b border-border">
        <div>
          <OdooField label="Código" value={form.codigo} help helpText="Código de barras o identificador único del producto. Debe ser único en el sistema." onChange={v => set('codigo', v)} alwaysEdit={isNew} required />
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
          <div className="odoo-field-row">
            <span className="odoo-field-label">Vender por presentaciones</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => set('vende_por_presentaciones', !(form as any).vende_por_presentaciones)}
                className={`relative w-9 h-5 rounded-full transition-colors ${(form as any).vende_por_presentaciones ? 'bg-primary' : 'bg-border'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(form as any).vende_por_presentaciones ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-[12px] text-muted-foreground">Activa precios distintos por caja, bulto, etc.</span>
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
            helpText="Precio de venta base al público para una unidad (pieza) de este producto."
            onChange={v => set('precio_principal', +v)}
            format={v => `${symbol} ${(v ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />

          {/* Costo de Venta (Unidad Venta) */}
          <OdooField
            label={`Costo ${salesUnitName}`}
            value={form.costo}
            type="number"
            teal
            help
            helpText={`Costo unitario del producto (por ${salesUnitName}). Si el cálculo es automático, este campo se bloqueará al guardar y se actualizará con cada compra. Para productos nuevos, este valor sirve como costo inicial.`}
            readOnly={isMethodAuto(form.calculo_costo ?? 'promedio') && !isNew}
            onChange={v => set('costo', +v)}
            format={v => `${symbol} ${(v ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            labelSuffix={isMethodAuto(form.calculo_costo ?? 'promedio') && !isNew
              ? <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Auto</span>
              : undefined
            }
          />

          {/* Costo de Compra (Unidad Compra) */}
          <OdooField
            label={`Costo ${purchaseUnitName}`}
            value={(form.costo ?? 0) * (form.factor_conversion ?? 1)}
            type="number"
            teal
            help
            helpText={`Costo del producto por unidad de compra (${purchaseUnitName}). Se calcula multiplicando el costo unitario por el factor de conversión (${form.factor_conversion ?? 1}).`}
            readOnly={isMethodAuto(form.calculo_costo ?? 'promedio') && !isNew}
            onChange={v => {
              const factor = form.factor_conversion ?? 1;
              set('costo', Math.round(((+v) / factor) * 10000) / 10000);
            }}
            format={v => `${symbol} ${(v ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            labelSuffix={isMethodAuto(form.calculo_costo ?? 'promedio') && !isNew
              ? <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Auto</span>
              : undefined
            }
          />

          <OdooField
            label="Precio sugerido público"
            value={(form as any).precio_sugerido_publico}
            type="number"
            help
            helpText="Precio de venta sugerido por el proveedor o fabricante para el público general."
            onChange={v => set('precio_sugerido_publico' as any, +v)}
            format={v => `${symbol} ${(Number(v) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />
          <OdooField
            label="Cálculo costo"
            value={form.calculo_costo}
            type="select"
            help
            helpText="Determina cómo se calcula el costo de forma automática al recibir compras (Promedio ponderado móvil, Último costo, etc.). Si seleccionas Manual, el costo no se actualizará con las compras."
            options={[
              { value: 'manual', label: 'Manual' },
              { value: 'ultimo', label: 'Último costo de compra' },
              { value: 'ultimo_proveedor', label: 'Último costo del proveedor principal' },
              { value: 'promedio', label: 'Promedio' },
              { value: 'ultimo_compra', label: 'Último costo (compra directa)' },
            ]}
            onChange={handleCalculoCostoChange}
            format={() => costLabels[form.calculo_costo ?? 'promedio'] ?? ''}
          />
          <OdooField label="Stock mínimo" value={form.min ?? 0} type="number" onChange={v => setForm(f => ({ ...f, min: Number(v) }))} placeholder="0" />
          <OdooField label="Stock máximo" value={form.max ?? 0} type="number" onChange={v => setForm(f => ({ ...f, max: Number(v) }))} placeholder="0" />
        </div>
      </div>

      {/* Modal de confirmación: cambio de método de costeo */}
      {modalConfig && (() => {
        const content = modalContentMap[modalConfig.type] || {
          title: 'Cambiar método de costo',
          message: '¿Estás seguro de cambiar el método de cálculo de costo?',
          details: 'Este cambio podría afectar cómo se calcula el costo de tu producto.',
        };
        return createPortal(
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <h3 className="text-[15px] font-semibold">
                    {content.title}
                  </h3>
                </div>
                <button onClick={cancelModal} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-5 py-5 space-y-3">
                <p className="text-[13px] text-foreground font-medium">
                  {content.message}
                </p>
                <p className="text-[13px] text-muted-foreground whitespace-pre-line">
                  {content.details}
                </p>
              </div>
              <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
                <button
                  onClick={confirmModal}
                  className="btn-odoo-primary"
                >
                  Confirmar
                </button>
                <button
                  onClick={cancelModal}
                  className="btn-odoo-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </>
  );
}
