import { useIsMobile } from '@/hooks/use-mobile';
import { OdooDatePicker } from '@/components/OdooDatePicker';
import { useCurrency } from '@/hooks/useCurrency';
import SearchableSelect from '@/components/SearchableSelect';
import { cn, fmtDate } from '@/lib/utils';

interface Props {
  form: Record<string, any>;
  readOnly: boolean;
  isNew: boolean;
  clienteOptions: { value: string; label: string }[];
  vendedorOptions: { value: string; label: string }[];
  clienteNombre?: string;
  set: (field: string, val: any) => void;
  onClienteChange: (cId: string) => void;
}

export function CotizacionFormFields({ form, readOnly, isNew, clienteOptions, vendedorOptions, clienteNombre, set, onClienteChange }: Props) {
  const isMobile = useIsMobile();
  const { fmt } = useCurrency();

  const condicionBtns = [
    { value: 'contado', label: 'Contado' },
    { value: 'credito', label: 'Crédito' },
    { value: 'por_definir', label: 'Por definir' },
  ];

  const renderCondicion = () => readOnly
    ? <div className="text-[13px] py-1.5 px-1 text-foreground capitalize">{form.condicion_pago}</div>
    : (
      <div className="flex gap-1">
        {condicionBtns.map(o => (
          <button key={o.value} onClick={() => set('condicion_pago', o.value)}
            className={cn("flex-1 py-1.5 text-[12px] font-medium rounded border transition-colors", form.condicion_pago === o.value ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-input hover:bg-secondary")}>
            {o.label}
          </button>
        ))}
      </div>
    );

  const renderCliente = () => readOnly
    ? <div className="text-[13px] py-1.5 px-1 text-foreground">{clienteNombre || '—'}</div>
    : <SearchableSelect options={clienteOptions} value={form.cliente_id ?? ''} onChange={onClienteChange} placeholder="Buscar cliente..." />;

  const renderVendedor = () => readOnly
    ? <div className="text-[13px] py-1.5 px-1 text-foreground">{vendedorOptions.find(v => v.value === form.vendedor_id)?.label || '—'}</div>
    : <SearchableSelect options={vendedorOptions} value={form.vendedor_id ?? ''} onChange={v => set('vendedor_id', v)} placeholder="Buscar vendedor..." />;

  const renderTotales = () => !isNew && form.status !== 'borrador' && (
    <div className="bg-card border border-border rounded-md p-2.5 space-y-0.5 text-[13px]">
      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{fmt(form.subtotal ?? 0)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">IVA</span><span className="font-medium">{fmt(form.iva_total ?? 0)}</span></div>
      <div className="flex justify-between border-t border-border pt-0.5"><span className="font-medium">Total</span><span className="font-semibold text-foreground">{fmt(form.total ?? 0)}</span></div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="space-y-3">
        <div><label className="label-odoo label-required">Cliente</label>{renderCliente()}</div>
        <div><label className="label-odoo">Condición de pago</label>{renderCondicion()}</div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label-odoo">Fecha</label>{readOnly ? <div className="text-[13px] py-1.5 px-1 text-foreground">{fmtDate(form.fecha)}</div> : <OdooDatePicker value={form.fecha} onChange={v => set('fecha', v)} />}</div>
          <div><label className="label-odoo">Vencimiento</label>{readOnly ? <div className="text-[13px] py-1.5 px-1 text-foreground">{fmtDate(form.fecha_vencimiento) || '—'}</div> : <OdooDatePicker value={form.fecha_vencimiento} onChange={v => set('fecha_vencimiento', v)} placeholder="Opcional" />}</div>
        </div>
        <div><label className="label-odoo">Folio</label><div className="text-[13px] text-muted-foreground py-1.5 px-1">{form.folio || (isNew ? 'Al guardar' : '—')}</div></div>
        <div><label className="label-odoo">Vendedor</label>{renderVendedor()}</div>
        {renderTotales()}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="space-y-3">
        <div><label className="label-odoo label-required">Cliente</label>{renderCliente()}</div>
        <div><label className="label-odoo">Condición de pago</label>{renderCondicion()}</div>
        <div><label className="label-odoo">Vendedor</label>{renderVendedor()}</div>
      </div>
      <div className="space-y-3">
        <div><label className="label-odoo">Fecha</label>{readOnly ? <div className="text-[13px] py-1.5 px-1 text-foreground">{fmtDate(form.fecha)}</div> : <OdooDatePicker value={form.fecha} onChange={v => set('fecha', v)} />}</div>
        <div><label className="label-odoo">Vencimiento</label>{readOnly ? <div className="text-[13px] py-1.5 px-1 text-foreground">{fmtDate(form.fecha_vencimiento) || '—'}</div> : <OdooDatePicker value={form.fecha_vencimiento} onChange={v => set('fecha_vencimiento', v)} placeholder="Opcional" />}</div>
        <div><label className="label-odoo">Folio</label><div className="text-[13px] text-muted-foreground py-1.5 px-1">{form.folio || (isNew ? 'Se asigna al guardar' : '—')}</div></div>
      </div>
      <div className="space-y-3">
        {renderTotales()}
      </div>
    </div>
  );
}
