import { useNavigate } from 'react-router-dom';
import { StatusChip } from '@/components/StatusChip';
import { cn, fmtDateTime } from '@/lib/utils';
import { TIPO_LABELS } from './ventasConstants';

interface Props {
  items: any[];
  fmt: (v: number | null | undefined) => string;
  columnVisibility?: Record<string, boolean>;
}

export function VentasProductosTable({ items, fmt, columnVisibility }: Props) {
  const navigate = useNavigate();
  const v = (key: string) => columnVisibility ? columnVisibility[key] !== false : true;

  const totalCols = ['folio', 'tipo', 'cliente', 'vendedor', 'fecha', 'codigo', 'producto', 'cantidad', 'precio_unitario', 'total', 'status']
    .filter(k => v(k)).length;

  const cellsAfterLabel = [
    v('cantidad') && 'cantidad',
    v('precio_unitario') && 'precio_unitario',
    v('total') && 'total',
    v('status') && 'status'
  ].filter(Boolean).length;

  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-table-border text-left">
          {v('folio') && <th className="py-2 px-3 text-muted-foreground font-medium text-[11px]">Folio</th>}
          {v('tipo') && <th className="py-2 px-3 text-muted-foreground font-medium text-[11px]">Tipo</th>}
          {v('cliente') && <th className="py-2 px-3 text-muted-foreground font-medium text-[11px]">Cliente</th>}
          {v('vendedor') && <th className="py-2 px-3 text-muted-foreground font-medium text-[11px] hidden md:table-cell">Vendedor</th>}
          {v('fecha') && <th className="py-2 px-3 text-muted-foreground font-medium text-[11px] hidden lg:table-cell">Fecha</th>}
          {v('codigo') && <th className="py-2 px-3 text-muted-foreground font-medium text-[11px]">Código</th>}
          {v('producto') && <th className="py-2 px-3 text-muted-foreground font-medium text-[11px]">Producto</th>}
          {v('cantidad') && <th className="py-2 px-3 text-muted-foreground font-medium text-[11px] text-right">Cantidad</th>}
          {v('precio_unitario') && <th className="py-2 px-3 text-muted-foreground font-medium text-[11px] text-right hidden md:table-cell">P. Unit.</th>}
          {v('total') && <th className="py-2 px-3 text-muted-foreground font-medium text-[11px] text-right">Total</th>}
          {v('status') && <th className="py-2 px-3 text-muted-foreground font-medium text-[11px] text-center hidden lg:table-cell">Estado</th>}
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && (
          <tr>
            <td colSpan={totalCols} className="text-center py-12 text-muted-foreground">No hay líneas de producto.</td>
          </tr>
        )}
        {items.map((row: any, i: number) => (
          <tr
            key={`${row.venta_id}-${row.linea_id}-${i}`}
            className="border-b border-table-border cursor-pointer transition-colors hover:bg-table-hover"
            onClick={() => navigate(`/ventas/${row.venta_id}`)}
          >
            {v('folio') && <td className="py-2 px-3 font-mono text-xs font-medium">{row.folio || row.venta_id?.slice(0, 8)}</td>}
            {v('tipo') && (
              <td className="py-2 px-3">
                <span className={cn(
                  "text-[11px] font-medium px-2 py-0.5 rounded",
                  row.tipo === 'pedido' ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"
                )}>
                  {TIPO_LABELS[row.tipo] || row.tipo}
                </span>
              </td>
            )}
            {v('cliente') && <td className="py-2 px-3 max-w-[160px] truncate">{row.cliente_nombre || 'Público en general'}</td>}
            {v('vendedor') && <td className="py-2 px-3 hidden md:table-cell text-muted-foreground">{row.vendedor_nombre ?? '—'}</td>}
            {v('fecha') && <td className="py-2 px-3 hidden lg:table-cell text-muted-foreground">{fmtDateTime(row.created_at)}</td>}
            {v('codigo') && <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{row.producto_codigo ?? ''}</td>}
            {v('producto') && <td className="py-2 px-3 max-w-[180px] truncate">{row.producto_nombre ?? ''}</td>}
            {v('cantidad') && <td className="py-2 px-3 text-right font-semibold tabular-nums">{row.cantidad}</td>}
            {v('precio_unitario') && <td className="py-2 px-3 text-right hidden md:table-cell text-muted-foreground tabular-nums">{fmt(row.precio_unitario)}</td>}
            {v('total') && <td className="py-2 px-3 text-right font-medium tabular-nums">{fmt(row.linea_total)}</td>}
            {v('status') && (
              <td className="py-2 px-3 text-center hidden lg:table-cell">
                <StatusChip status={row.status} />
              </td>
            )}
          </tr>
        ))}
      </tbody>
      {items.length > 0 && (
        <tfoot>
          <tr className="bg-card border-t border-border font-semibold text-[12px]">
            <td colSpan={Math.max(1, totalCols - cellsAfterLabel)} className="py-2 px-3 text-muted-foreground">{items.length} líneas</td>
            {v('cantidad') && (
              <td className="py-2 px-3 text-right tabular-nums">
                {items.reduce((s: number, r: any) => s + (r.cantidad ?? 0), 0)}
              </td>
            )}
            {v('precio_unitario') && (
              <td className="py-2 px-3 hidden md:table-cell" />
            )}
            {v('total') && (
              <td className="py-2 px-3 text-right font-bold tabular-nums">
                {fmt(items.reduce((s: number, r: any) => s + (r.linea_total ?? 0), 0))}
              </td>
            )}
            {v('status') && (
              <td className="hidden lg:table-cell" />
            )}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

