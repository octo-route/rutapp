import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, DollarSign, Percent } from 'lucide-react';
import type { ProductoCostoAdicional } from '@/types';
import { useCurrency } from '@/hooks/useCurrency';
import { calcularCostoTotal } from '@/lib/priceResolver';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  costoBase: number;
  costosAdicionales: ProductoCostoAdicional[];
  onSave: (costos: ProductoCostoAdicional[]) => void;
}

export function CostosAdicionalesModal({ isOpen, onClose, costoBase, costosAdicionales, onSave }: Props) {
  const { symbol } = useCurrency();
  const [lines, setLines] = useState<ProductoCostoAdicional[]>(costosAdicionales || []);

  if (!isOpen) return null;

  const handleAddLine = () => {
    const newLine: ProductoCostoAdicional = {
      id: crypto.randomUUID(),
      nombre: '',
      tipo: 'valor',
      valor: 0,
    };
    setLines([...lines, newLine]);
  };

  const handleRemoveLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id));
  };

  const handleChange = (id: string, field: keyof ProductoCostoAdicional, value: any) => {
    setLines(lines.map(l => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const costoTotal = calcularCostoTotal(costoBase, lines);

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Gastos Adicionales</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5">Agrega fletes, empaques u otros costos logísticos</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {lines.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-xl bg-muted/10">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-6 h-6" />
              </div>
              <p className="text-[14px] font-medium text-foreground">No hay gastos adicionales</p>
              <p className="text-[13px] text-muted-foreground mt-1 mb-4">El costo base será el costo total del producto.</p>
              <button onClick={handleAddLine} className="btn-odoo-secondary text-[13px]">
                <Plus className="w-4 h-4 mr-2" />
                Agregar primer gasto
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-3 pb-2 border-b border-border text-[12px] font-medium text-muted-foreground px-1">
                <div className="col-span-6">Concepto (Ej. Flete, Empaque)</div>
                <div className="col-span-3">Tipo</div>
                <div className="col-span-2">Valor</div>
                <div className="col-span-1 text-right"></div>
              </div>

              {lines.map((line) => (
                <div key={line.id} className="grid grid-cols-12 gap-3 items-center group">
                  <div className="col-span-6">
                    <input
                      type="text"
                      value={line.nombre}
                      onChange={e => handleChange(line.id, 'nombre', e.target.value)}
                      placeholder="Ej. Flete envío"
                      className="w-full text-[13px] h-9 px-3 border border-border rounded-lg bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                  <div className="col-span-3">
                    <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => handleChange(line.id, 'tipo', 'valor')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${line.tipo === 'valor' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Monto
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange(line.id, 'tipo', 'porcentaje')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${line.tipo === 'porcentaje' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <Percent className="w-3.5 h-3.5" />
                        %
                      </button>
                    </div>
                  </div>
                  <div className="col-span-2 relative">
                    {line.tipo === 'valor' && (
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">{symbol}</span>
                    )}
                    <input
                      type="number"
                      value={line.valor || ''}
                      onChange={e => handleChange(line.id, 'valor', Number(e.target.value))}
                      className={`w-full text-[13px] h-9 pr-3 border border-border rounded-lg bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-right ${line.tipo === 'valor' ? 'pl-6' : 'pl-3'}`}
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => handleRemoveLine(line.id)}
                      className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Eliminar línea"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <button onClick={handleAddLine} className="text-[13px] text-primary hover:text-primary/80 font-medium flex items-center gap-1.5 mt-2 transition-colors">
                <Plus className="w-4 h-4" />
                Agregar otra línea
              </button>
            </div>
          )}
        </div>

        <div className="bg-muted/30 border-t border-border p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1 flex gap-6 text-[13px] bg-background border border-border px-4 py-3 rounded-xl shadow-sm">
            <div>
              <p className="text-muted-foreground mb-1">Costo Base</p>
              <p className="font-medium text-foreground">{symbol} {costoBase.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="w-px bg-border my-1"></div>
            <div>
              <p className="text-muted-foreground mb-1 text-primary">Costo Total Calculado</p>
              <p className="font-semibold text-lg text-primary">{symbol} {costoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={onClose} className="btn-odoo-secondary flex-1 sm:flex-none">
              Cancelar
            </button>
            <button onClick={() => { onSave(lines); onClose(); }} className="btn-odoo-primary flex-1 sm:flex-none">
              Guardar Gastos
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
