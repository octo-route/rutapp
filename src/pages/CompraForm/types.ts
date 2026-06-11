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

  if (line._precio_incluye_iva) {
    if (isCuota) {
      const iepsTotal = iepsPct * cant;
      const baseConIeps = totalBase / (1 + ivaPct / 100);
      ivaAmount = totalBase - baseConIeps;
      subtotal = baseConIeps - iepsTotal;
      iepsAmount = iepsTotal;
      total = totalBase;
    } else {
      const taxFactor = (1 + iepsPct / 100) * (1 + ivaPct / 100);
      subtotal = taxFactor > 0 ? totalBase / taxFactor : totalBase;
      iepsAmount = subtotal * (iepsPct / 100);
      ivaAmount = (subtotal + iepsAmount) * (ivaPct / 100);
      total = totalBase;
    }
  } else {
    subtotal = totalBase;
    iepsAmount = isCuota ? iepsPct * cant : totalBase * (iepsPct / 100);
    ivaAmount = (totalBase + iepsAmount) * (ivaPct / 100);
    total = totalBase + iepsAmount + ivaAmount;
  }

  line.subtotal = r2(subtotal);
  line.total = r2(total);
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
