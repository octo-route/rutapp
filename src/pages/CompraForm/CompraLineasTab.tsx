import { useState } from 'react';
import { Plus, X, TrendingUp, TrendingDown } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import QuickProductDialog from '@/components/QuickProductDialog';
import { Switch } from '@/components/ui/switch';
import type { CompraLinea } from './types';
import { useCurrency } from '@/hooks/useCurrency';
import { getNombreCompra } from '@/lib/productoNombres';

interface Props {
  lineas: Partial<CompraLinea>[];
  productosList: any[] | undefined;
  isEditable: boolean;
  updateLinea: (idx: number, key: string, val: any) => void;
  addLine: () => void;
  removeLine: (idx: number) => void;
}

export function CompraLineasTab({ lineas, productosList, isEditable, updateLinea, addLine, removeLine }: Props) {
  const { fmt } = useCurrency();
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickIdx, setQuickIdx] = useState<number | null>(null);
  const [quickName, setQuickName] = useState('');
  const [quickCosto, setQuickCosto] = useState(0);

  const triggerQuickCreate = (idx: number, name: string) => {
    setQuickIdx(idx);
    setQuickName(name);
    setQuickCosto(Number(lineas[idx]?.precio_unitario) || 0);
    setQuickOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded overflow-x-auto">
        <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '32px' }} />   {/* # */}
            <col />                               {/* Producto – flexible */}
            <col style={{ width: '52px' }} />   {/* Ud */}
            <col style={{ width: '84px' }} />   {/* Cant */}
            <col style={{ width: '72px' }} />   {/* Factor */}
            <col style={{ width: '72px' }} />   {/* Piezas */}
            <col style={{ width: '112px' }} />  {/* Costo caja */}
            <col style={{ width: '120px' }} />  {/* Costo Pieza */}
            <col style={{ width: '56px' }} />   {/* IVA */}
            <col style={{ width: '56px' }} />   {/* IEPS */}
            <col style={{ width: '88px' }} />   {/* Total */}
            {isEditable && <col style={{ width: '32px' }} />}
          </colgroup>
          <thead>
            <tr className="border-b border-table-border">
              <th className="th-odoo text-left">#</th>
              <th className="th-odoo text-left">Producto</th>
              <th className="th-odoo text-center">Ud.</th>
              <th className="th-odoo text-right">Cant.</th>
              <th className="th-odoo text-center">Factor</th>
              <th className="th-odoo text-right">Piezas</th>
              <th className="th-odoo text-right">Costo caja</th>
              <th className="th-odoo text-right">Costo Pieza</th>
              <th className="th-odoo text-center">IVA</th>
              <th className="th-odoo text-center">IEPS</th>
              <th className="th-odoo text-right">Total</th>
              {isEditable && <th className="th-odoo"></th>}
            </tr>
          </thead>
          <tbody>
            {lineas.map((line, idx) => {
              const iepsLabel = line._tiene_ieps
                ? (line._ieps_tipo === 'cuota' ? `$${line._ieps_pct}` : `${line._ieps_pct}%`)
                : '';
              const precioAnt = line._precio_anterior;
              const precioAct = line.precio_unitario ?? 0;
              const hayComparacion = precioAnt != null && precioAnt > 0;
              const subio = hayComparacion && precioAct > precioAnt!;
              const bajo = hayComparacion && precioAct < precioAnt!;
              const pctCambio = hayComparacion
                ? Math.abs(((precioAct - precioAnt!) / precioAnt!) * 100).toFixed(1)
                : null;

              return (
                <tr key={idx} className="border-b border-table-border" data-row={idx}>
                  {/* # */}
                  <td className="py-1.5 px-2 text-muted-foreground text-xs">{idx + 1}</td>

                  {/* Producto */}
                  <td className="py-1.5 px-2">
                    {isEditable ? (
                      <SearchableSelect
                        options={
                          (productosList as any[])
                            ?.filter(p => {
                              const usedIds = lineas.filter((_, j) => j !== idx).map(l => l.producto_id).filter(Boolean);
                              return !usedIds.includes(p.id) && p.se_puede_inventariar !== false && !p.es_combo;
                            })
                            .map(p => ({
                              value: p.id,
                              label: `[${p.codigo}] ${getNombreCompra(p)}`,
                              searchText: [p.codigo, p.nombre_compra, p.nombre].filter(Boolean).join(' '),
                            })) ?? []
                        }
                        value={line.producto_id ?? ''}
                        onChange={val => updateLinea(idx, 'producto_id', val)}
                        placeholder="Buscar producto..."
                        onCreateNew={async (name) => { triggerQuickCreate(idx, name); return undefined; }}
                      />
                    ) : (
                      <span className="text-xs truncate block">
                        {line.productos ? `[${line.productos.codigo}] ${getNombreCompra(line.productos)}` : '—'}
                      </span>
                    )}
                  </td>

                  {/* Unidad */}
                  <td className="py-1.5 px-1 text-center text-xs text-muted-foreground uppercase truncate">
                    {line._unidad_compra || 'pz'}
                  </td>

                  {/* Cantidad */}
                  <td className="py-1.5 px-1">
                    {isEditable
                      ? <input type="number" className="w-full text-right text-sm bg-transparent border border-border rounded px-2 py-1 tabular-nums focus:outline-none focus:ring-1 focus:ring-primary" value={line.cantidad ?? 1} onChange={e => updateLinea(idx, 'cantidad', Number(e.target.value))} min={0} />
                      : <span className="text-sm text-right block tabular-nums">{(line.cantidad ?? 1).toLocaleString('es-MX')}</span>
                    }
                  </td>

                  {/* Factor */}
                  <td className="py-1.5 px-1">
                    {isEditable
                      ? <input type="number" className="w-full text-center text-sm bg-transparent border border-border rounded px-2 py-1 tabular-nums focus:outline-none focus:ring-1 focus:ring-primary" value={line._factor_conversion ?? 1} onChange={e => updateLinea(idx, '_factor_conversion', Math.max(1, Number(e.target.value) || 1))} min={1} />
                      : <span className="text-sm text-center block tabular-nums">{(line._factor_conversion ?? 1).toLocaleString('es-MX')}</span>
                    }
                  </td>

                  {/* Piezas */}
                  <td className="py-1.5 px-2 text-right text-sm font-medium text-foreground tabular-nums">
                    {((line.cantidad ?? 1) * (line._factor_conversion ?? 1)).toLocaleString('es-MX')}
                  </td>

                  {/* Costo caja */}
                  <td className="py-1.5 px-1">
                    {isEditable
                      ? <input
                          type="number"
                          className="w-full text-right text-sm bg-transparent border border-border rounded px-2 py-1 tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                          value={line._costo_caja ?? 0}
                          onChange={e => updateLinea(idx, '_costo_caja', Number(e.target.value))}
                          step="0.01"
                          title={`Costo por caja = Costo × Factor (${line._factor_conversion ?? 1}). Edita aquí para calcular el costo unitario automáticamente.`}
                        />
                      : <span className="text-sm text-right block tabular-nums">{fmt(line._costo_caja ?? 0)}</span>
                    }
                  </td>

                  {/* Costo unitario + indicador ▲/▼ */}
                  <td className="py-1.5 px-1">
                    <div className="flex items-center gap-1">
                      {isEditable
                        ? <input
                            type="number"
                            className="flex-1 min-w-0 text-right text-sm bg-transparent border border-border rounded px-2 py-1 tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                            value={line.precio_unitario ?? 0}
                            onChange={e => updateLinea(idx, 'precio_unitario', Number(e.target.value))}
                            step="0.01"
                          />
                        : <span className="flex-1 text-sm text-right tabular-nums">{fmt(line.precio_unitario ?? 0)}</span>
                      }
                      {hayComparacion && subio && (
                        <span
                          title={`▲ Subió ${pctCambio}% (anterior: ${fmt(precioAnt!)})`}
                          className="text-red-500 flex-shrink-0 cursor-help"
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {hayComparacion && bajo && (
                        <span
                          title={`▼ Bajó ${pctCambio}% (anterior: ${fmt(precioAnt!)})`}
                          className="text-green-500 flex-shrink-0 cursor-help"
                        >
                          <TrendingDown className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* IVA */}
                  <td className="py-1.5 px-1 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <Switch checked={line._tiene_iva ?? false} onCheckedChange={v => updateLinea(idx, '_tiene_iva', v)} disabled={!isEditable} className="scale-75" />
                      {line._tiene_iva && <span className="text-[10px] text-muted-foreground">{line._iva_pct}%</span>}
                    </div>
                  </td>

                  {/* IEPS */}
                  <td className="py-1.5 px-1 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <Switch checked={line._tiene_ieps ?? false} onCheckedChange={v => updateLinea(idx, '_tiene_ieps', v)} disabled={!isEditable} className="scale-75" />
                      {line._tiene_ieps && <span className="text-[10px] text-muted-foreground">{iepsLabel}</span>}
                    </div>
                  </td>

                  {/* Total */}
                  <td className="py-1.5 px-2 text-right font-medium text-sm tabular-nums">{fmt(line.total ?? 0)}</td>

                  {/* Eliminar */}
                  {isEditable && (
                    <td className="py-1.5 px-1 text-center">
                      <button onClick={() => removeLine(idx)} className="text-destructive hover:text-destructive/80">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isEditable && (
        <button onClick={addLine} className="btn-odoo-secondary text-xs gap-1">
          <Plus className="h-3.5 w-3.5" /> Agregar línea
        </button>
      )}

      <QuickProductDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        initialName={quickName}
        initialCosto={quickCosto}
        onCreated={(prod) => {
          if (quickIdx === null) return;
          updateLinea(quickIdx, 'producto_id', prod.id);
          if (prod.costo && !lineas[quickIdx]?.precio_unitario) updateLinea(quickIdx, 'precio_unitario', prod.costo);
          updateLinea(quickIdx, '_tiene_iva', !!prod.tiene_iva);
          if (prod.tiene_iva) updateLinea(quickIdx, '_iva_pct', prod.iva_pct ?? 16);
          updateLinea(quickIdx, '_tiene_ieps', !!prod.tiene_ieps);
          if (prod.tiene_ieps) updateLinea(quickIdx, '_ieps_pct', prod.ieps_pct ?? 0);
          if (prod.factor_conversion) updateLinea(quickIdx, '_factor_conversion', prod.factor_conversion);
        }}
      />
    </div>
  );
}
