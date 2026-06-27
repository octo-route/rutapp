/**
 * Resolves the sale price of a product based on the tarifa rules and lista de precios.
 *
 * Hierarchy: 1) Product-specific rule, 2) Category rule, 3) Global ('todos') rule
 * Falls back to producto.precio_principal if no tarifa rule matches.
 */

export interface TarifaLineaRule {
  aplica_a: string; // 'todos' | 'producto' | 'categoria' | 'presentacion'
  producto_ids: string[];
  clasificacion_ids: string[];
  presentacion_ids?: string[];
  tipo_calculo: string; // 'precio_fijo' | 'margen_costo' | 'descuento_precio'
  precio: number;
  precio_minimo: number | null;
  margen_pct: number | null;
  descuento_pct: number | null;
  redondeo: string;
  base_precio: string;
  lista_precio_id: string | null;
}

export interface ProductForPricing {
  id: string;
  precio_principal: number;
  costo?: number;
  clasificacion_id?: string | null;
  tiene_iva?: boolean;
  iva_pct?: number;
  tiene_ieps?: boolean;
  ieps_pct?: number;
  ieps_tipo?: string;
  usa_listas_precio?: boolean;
  costos_adicionales?: { id: string; tipo: 'valor' | 'porcentaje'; valor: number }[];
}

export interface ResolvedProductPricing {
  unitPrice: number;
  displayPrice: number;
  rawUnitPrice: number;
  rawDisplayPrice: number;
  basePrecio: string;
  appliedRule: TarifaLineaRule | null;
}

export function calcularCostoTotal(costoBase: number, adicionales?: { tipo: 'valor' | 'porcentaje'; valor: number }[]): number {
  if (!adicionales || adicionales.length === 0) return costoBase;
  let total = costoBase;
  for (const adic of adicionales) {
    if (adic.tipo === 'porcentaje') {
      total += costoBase * (adic.valor / 100);
    } else {
      total += adic.valor;
    }
  }
  return total;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function applyRedondeo(precio: number, redondeo: string): number {
  if (!redondeo || redondeo === 'ninguno') return precio;
  if (redondeo === 'arriba') return Math.ceil(precio);
  if (redondeo === 'abajo') return Math.floor(precio);
  return Math.round(precio); // cercano
}

function getTaxMultiplier(producto: ProductForPricing): number {
  const iepsPct = producto.tiene_ieps ? (producto.ieps_pct ?? 0) : 0;
  const ivaPct = producto.tiene_iva ? (producto.iva_pct ?? 0) : 0;
  return (1 + iepsPct / 100) * (1 + ivaPct / 100);
}

/**
 * Find the best matching tarifa rule for a product.
 * Priority: producto > categoria > todos
 */
function findMatchingRule(
  rules: TarifaLineaRule[],
  producto: ProductForPricing,
  listaPrecioId?: string | null
): TarifaLineaRule | null {
  const filtered = listaPrecioId
    ? rules.filter(r => r.lista_precio_id === listaPrecioId || !r.lista_precio_id)
    : rules.filter(r => !r.lista_precio_id);

  const prodRule = filtered.find(
    r => r.aplica_a === 'producto' && (r.producto_ids ?? []).includes(producto.id)
  );
  if (prodRule) return prodRule;

  if (producto.clasificacion_id) {
    const catRule = filtered.find(
      r => r.aplica_a === 'categoria' && (r.clasificacion_ids ?? []).includes(producto.clasificacion_id!)
    );
    if (catRule) return catRule;
  }

  const globalRule = filtered.find(r => r.aplica_a === 'todos');
  return globalRule ?? null;
}

/**
 * Get the raw rule price BEFORE rounding or tax adjustment.
 * Returns null for placeholder rules (precio_fijo = 0 with no minimum).
 */
export function calculateRawPrice(rule: TarifaLineaRule, producto: ProductForPricing): number | null {
  let precio = 0;

  if (rule.tipo_calculo === 'precio_fijo') {
    precio = rule.precio ?? 0;
    if (precio <= 0 && (rule.precio_minimo ?? 0) <= 0) return null;
  } else if (rule.tipo_calculo === 'margen_costo') {
    let baseAmount = calcularCostoTotal(producto.costo ?? 0, producto.costos_adicionales);
    if (rule.base_precio !== 'con_impuestos') {
      const divisor = getTaxMultiplier(producto);
      baseAmount = divisor > 0 ? baseAmount / divisor : baseAmount;
    }
    precio = baseAmount * (1 + (rule.margen_pct ?? 0) / 100);
  } else if (rule.tipo_calculo === 'descuento_precio') {
    let basePrice = producto.precio_principal;
    if (rule.base_precio === 'con_impuestos') {
      basePrice *= getTaxMultiplier(producto);
    }
    precio = basePrice * (1 - (rule.descuento_pct ?? 0) / 100);
  }

  let min = rule.precio_minimo ?? 0;

  return Math.max(precio, min);
}

/**
 * Calculate the NET (before-tax) unit price from a tarifa rule.
 * Flow: Raw rule price → extract net (if con_impuestos) → round2
 * Rounding (redondeo) is NOT applied here — it applies on the final gross price.
 */
export function calculatePrice(rule: TarifaLineaRule, producto: ProductForPricing): number | null {
  const raw = calculateRawPrice(rule, producto);
  if (raw == null) return null;

  let neto = raw;
  if (rule.base_precio === 'con_impuestos') {
    const divisor = getTaxMultiplier(producto);
    neto = divisor > 0 ? raw / divisor : raw;
  }

  return round2(neto);
}

export function calculateDisplayPrice(rule: TarifaLineaRule, producto: ProductForPricing): number | null {
  const raw = calculateRawPrice(rule, producto);
  if (raw == null) return null;
  let gross = raw;
  if (rule.base_precio !== 'con_impuestos') {
    gross *= getTaxMultiplier(producto);
  }
  return applyRedondeo(gross, rule.redondeo);
}

/**
 * Calculate the customer-facing display price (gross = net + taxes + redondeo).
 * Note: If you have the rule, prefer calculateDisplayPrice to avoid intermediate rounding.
 */
export function toDisplayPrice(
  unitPrice: number,
  producto: ProductForPricing,
  redondeo?: string,
): number {
  const gross = round2(unitPrice * getTaxMultiplier(producto));
  return applyRedondeo(gross, redondeo ?? 'ninguno');
}

/**
 * Resolve both the persisted unit price and the customer-facing display price.
 *
 * Flow: Cost → Tarifa Rule (net or gross) → Net extraction → +Taxes → Redondeo → Precio Final
 */
export function resolveProductPricing(
  rules: TarifaLineaRule[],
  producto: ProductForPricing,
  listaPrecioId?: string | null
): ResolvedProductPricing {
  // Short-circuit: if product uses precio_directo, skip all tarifa rules
  if (producto.usa_listas_precio === false) {
    const fallback = round2(producto.precio_principal);
    const fallbackDisplay = round2(fallback * getTaxMultiplier(producto));
    return {
      unitPrice: fallback,
      displayPrice: fallbackDisplay,
      rawUnitPrice: fallback,
      rawDisplayPrice: fallback * getTaxMultiplier(producto),
      basePrecio: 'sin_impuestos',
      appliedRule: null,
    };
  }

  const rule = findMatchingRule(rules, producto, listaPrecioId);

  if (!rule) {
    const fallback = round2(producto.precio_principal);
    const fallbackDisplay = round2(fallback * getTaxMultiplier(producto));
    return {
      unitPrice: fallback,
      displayPrice: fallbackDisplay,
      rawUnitPrice: fallback,
      rawDisplayPrice: fallback * getTaxMultiplier(producto),
      basePrecio: 'sin_impuestos',
      appliedRule: null,
    };
  }

  const unitPrice = calculatePrice(rule, producto);
  if (unitPrice == null) {
    const fallback = round2(producto.precio_principal);
    const fallbackDisplay = round2(fallback * getTaxMultiplier(producto));
    return {
      unitPrice: fallback,
      displayPrice: fallbackDisplay,
      rawUnitPrice: fallback,
      rawDisplayPrice: fallback * getTaxMultiplier(producto),
      basePrecio: 'sin_impuestos',
      appliedRule: null,
    };
  }

  const rawBase = calculateRawPrice(rule, producto) ?? producto.precio_principal;
  let rawUnitPrice: number;
  if (rule.base_precio === 'con_impuestos') {
    const divisor = getTaxMultiplier(producto);
    rawUnitPrice = divisor > 0 ? rawBase / divisor : rawBase;
  } else {
    rawUnitPrice = rawBase;
  }
  const rawDisplayPrice = rawUnitPrice * getTaxMultiplier(producto);

  return {
    unitPrice,
    displayPrice: calculateDisplayPrice(rule, producto) ?? applyRedondeo(unitPrice * getTaxMultiplier(producto), rule.redondeo),
    rawUnitPrice,
    rawDisplayPrice,
    basePrecio: rule.base_precio ?? 'sin_impuestos',
    appliedRule: rule,
  };
}

/**
 * Resolve the sale price for a product given tarifa rules.
 * Returns precio_principal as fallback.
 */
export function resolveProductPrice(
  rules: TarifaLineaRule[],
  producto: ProductForPricing,
  listaPrecioId?: string | null
): number {
  return resolveProductPricing(rules, producto, listaPrecioId).unitPrice;
}

export interface PresentacionForPricing {
  id: string;
  factor_base: number;
  precio_especial?: number | null;
}

export function resolvePresentacionPricing(
  rules: TarifaLineaRule[],
  presentacion: PresentacionForPricing,
  producto: ProductForPricing,
  baseProductPricing: ResolvedProductPricing,
  listaPrecioId?: string | null
): ResolvedProductPricing {
  if (producto.usa_listas_precio === false) {
    let unitPrice: number;
    let displayPrice: number;
    let basePrecio: 'sin_impuestos' | 'con_impuestos' = 'sin_impuestos';

    if (presentacion.precio_especial != null) {
      displayPrice = round2(presentacion.precio_especial);
      const divisor = getTaxMultiplier(producto);
      unitPrice = divisor > 0 ? round2(displayPrice / divisor) : displayPrice;
      basePrecio = 'con_impuestos';
    } else {
      unitPrice = round2(baseProductPricing.unitPrice * presentacion.factor_base);
      displayPrice = round2(baseProductPricing.displayPrice * presentacion.factor_base);
      basePrecio = baseProductPricing.basePrecio as any;
    }

    return {
      unitPrice,
      displayPrice,
      rawUnitPrice: unitPrice,
      rawDisplayPrice: displayPrice,
      basePrecio,
      appliedRule: null,
    };
  }

  const filtered = listaPrecioId
    ? rules.filter(r => r.lista_precio_id === listaPrecioId || !r.lista_precio_id)
    : rules.filter(r => !r.lista_precio_id);

  const rule = filtered.find(
    r => r.aplica_a === 'presentacion' && (r.presentacion_ids ?? []).includes(presentacion.id)
  );

  if (!rule) {
    let unitPrice: number;
    let displayPrice: number;
    let basePrecio: 'sin_impuestos' | 'con_impuestos' = 'sin_impuestos';

    if (presentacion.precio_especial != null) {
      displayPrice = round2(presentacion.precio_especial);
      const divisor = getTaxMultiplier(producto);
      unitPrice = divisor > 0 ? round2(displayPrice / divisor) : displayPrice;
      basePrecio = 'con_impuestos';
    } else {
      unitPrice = round2(baseProductPricing.unitPrice * presentacion.factor_base);
      displayPrice = round2(baseProductPricing.displayPrice * presentacion.factor_base);
      basePrecio = baseProductPricing.basePrecio as any;
    }

    return {
      unitPrice,
      displayPrice,
      rawUnitPrice: unitPrice,
      rawDisplayPrice: displayPrice,
      basePrecio,
      appliedRule: null,
    };
  }

  let rawBase = 0;
  if (rule.tipo_calculo === 'precio_fijo') {
    rawBase = rule.precio ?? 0;
  } else if (rule.tipo_calculo === 'margen_costo') {
    const costoTotal = calcularCostoTotal(producto.costo ?? 0, producto.costos_adicionales);
    const presentationCost = costoTotal * presentacion.factor_base;
    rawBase = presentationCost * (1 + (rule.margen_pct ?? 0) / 100);
  } else if (rule.tipo_calculo === 'descuento_precio') {
    const basePresPrice = presentacion.precio_especial != null 
      ? presentacion.precio_especial 
      : producto.precio_principal * presentacion.factor_base;
    rawBase = basePresPrice * (1 - (rule.descuento_pct ?? 0) / 100);
  }

  const raw = Math.max(rawBase, rule.precio_minimo ?? 0);

  let unitPrice: number;
  let displayPrice: number;

  if (rule.base_precio === 'con_impuestos') {
    displayPrice = round2(applyRedondeo(raw, rule.redondeo));
    const divisor = getTaxMultiplier(producto);
    unitPrice = divisor > 0 ? round2(displayPrice / divisor) : displayPrice;
  } else {
    unitPrice = round2(applyRedondeo(raw, rule.redondeo));
    displayPrice = round2(unitPrice * getTaxMultiplier(producto));
  }

  return {
    unitPrice,
    displayPrice,
    rawUnitPrice: unitPrice,
    rawDisplayPrice: displayPrice,
    basePrecio: rule.base_precio ?? 'sin_impuestos',
    appliedRule: rule,
  };
}
