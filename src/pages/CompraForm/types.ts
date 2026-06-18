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
  _precio_incluye_iva?: boolean;
  _precio_incluye_ieps?: boolean;
  _tiene_ieps: boolean;
  _ieps_pct: number;
  _ieps_tipo: string;
  _iva_amount?: number;
  _ieps_amount?: number;
  _unidad_compra: string;
  _factor_conversion: number;
  _piezas_total: number;
  /** Costo por caja = precio_unitario × factor_conversion  (bidireccional) */
  _costo_caja: number;
  /** Precio unitario de la última compra recibida para este producto (para mostrar ▲/▼) */
  _precio_anterior: number | null;
  productos?: {
    id: string;
    codigo: string;
    nombre: string;
    nombre_compra?: string | null;
    costo: number;
  };
}

export function emptyLine(): Partial<CompraLinea> {
  return {
    cantidad: 1,
    precio_unitario: 0,
    subtotal: 0,
    total: 0,
    _tiene_iva: false,
    _iva_pct: 16,
    _precio_incluye_iva: false,
    _precio_incluye_ieps: false,
    _tiene_ieps: false,
    _ieps_pct: 0,
    _ieps_tipo: "porcentaje",
    _unidad_compra: "",
    _factor_conversion: 1,
    _piezas_total: 1,
    _costo_caja: 0,
    _precio_anterior: null,
  };
}

export function calcLineTotals(line: Partial<CompraLinea>) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const cant = Number(line.cantidad) || 0;
  const precio = Number(line.precio_unitario) || 0;
  const factor = Number(line._factor_conversion) || 1;
  const ivaPct = line._tiene_iva ? (Number(line._iva_pct) || 0) : 0;
  const iepsPct = line._tiene_ieps ? (Number(line._ieps_pct) || 0) : 0;
  const isCuota = line._ieps_tipo === "cuota";

  const totalBase = cant * precio * factor;

  let subtotal = 0;
  let iepsAmount = 0;
  let ivaAmount = 0;
  let total = 0;

  const incIeps = line._precio_incluye_ieps ? 1 : 0;
  const incIva = line._precio_incluye_iva ? 1 : 0;
  const iPct = ivaPct / 100;
  const ePct = iepsPct / 100;

  if (isCuota) {
    const fixedIeps = iepsPct * cant;
    const num = totalBase - (incIeps * fixedIeps) - (incIva * fixedIeps * iPct);
    const den = 1 + (incIva * iPct);
    subtotal = num / den;
    iepsAmount = fixedIeps;
    ivaAmount = (subtotal + iepsAmount) * iPct;
  } else {
    const den = 1 + (incIeps * ePct) + (incIva * (1 + ePct) * iPct);
    subtotal = totalBase / den;
    iepsAmount = subtotal * ePct;
    ivaAmount = (subtotal + iepsAmount) * iPct;
  }

  total = subtotal + iepsAmount + ivaAmount;

  line.subtotal = r2(subtotal);
  line.total = r2(total);
  line._iva_amount = r2(ivaAmount);
  line._ieps_amount = r2(iepsAmount);
  line._piezas_total = r2(cant * factor);
  line._costo_caja = r2(precio * factor);

  return line;
}

export const COMPRA_STEPS = [
  { key: "borrador", label: "Borrador" },
  { key: "confirmada", label: "Confirmada" },
  { key: "recibida", label: "Recibida" },
  { key: "pagada", label: "Pagada" },
  { key: "cancelada", label: "Cancelada" },
];
