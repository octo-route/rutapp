export interface CompraLinea {
  id?: string;
  compra_id?: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  total: number;
  _tiene_iva: boolean;
  _iva_pct: number;
  _tiene_ieps: boolean;
  _ieps_pct: number;
  _ieps_tipo: string;
  _unidad_compra: string;
  _factor_conversion: number;
  _piezas_total: number;
  /** Costo por caja = precio_unitario × factor_conversion  (bidireccional) */
  _costo_caja: number;
  /** Precio unitario de la última compra recibida para este producto (para mostrar ▲/▼) */
  _precio_anterior: number | null;
  productos?: { id: string; codigo: string; nombre: string; nombre_compra?: string | null; costo: number };
}

export function emptyLine(): Partial<CompraLinea> {
  return {
    cantidad: 1, precio_unitario: 0, subtotal: 0, total: 0,
    _tiene_iva: false, _iva_pct: 16, _tiene_ieps: false, _ieps_pct: 0,
    _ieps_tipo: 'porcentaje', _unidad_compra: '', _factor_conversion: 1,
    _piezas_total: 1, _costo_caja: 0, _precio_anterior: null,
  };
}

export function calcLineTotals(line: Partial<CompraLinea>) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const cant = Number(line.cantidad) || 0;
  const precio = Number(line.precio_unitario) || 0;
  const factor = Number(line._factor_conversion) || 1;
  const base = r2(cant * precio);
  let iepsAmount = 0;
  if (line._tiene_ieps) {
    iepsAmount = r2(line._ieps_tipo === 'cuota' ? cant * (Number(line._ieps_pct) || 0) : base * ((Number(line._ieps_pct) || 0) / 100));
  }
  const baseConIeps = r2(base + iepsAmount);
  const ivaAmount = line._tiene_iva ? r2(baseConIeps * ((Number(line._iva_pct) || 0) / 100)) : 0;
  line.subtotal = base;
  line.total = r2(base + iepsAmount + ivaAmount);
  line._piezas_total = r2(cant * factor);
  // Mantener costo_caja sincronizado
  line._costo_caja = r2(precio * factor);
  return line;
}

export const COMPRA_STEPS = [
  { key: 'borrador', label: 'Borrador' },
  { key: 'confirmada', label: 'Confirmada' },
  { key: 'recibida', label: 'Recibida' },
  { key: 'pagada', label: 'Pagada' },
  { key: 'cancelada', label: 'Cancelada' },
];
