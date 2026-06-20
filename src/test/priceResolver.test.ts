import { describe, it, expect } from 'vitest';
import { resolveProductPrice, resolveProductPricing, calculatePrice, toDisplayPrice, resolvePresentacionPricing, type TarifaLineaRule } from '@/lib/priceResolver';
import { productoBasico, productoConIeps, productoDirecto } from './fixtures/productos';
import { reglaPrecioFijo, reglaMargenCosto, reglaDescuento } from './fixtures/tarifas';

describe('resolveProductPrice', () => {
  it('returns precio_principal when no rules', () => {
    expect(resolveProductPrice([], productoBasico)).toBe(10);
  });

  it('applies precio_fijo rule for specific product', () => {
    expect(resolveProductPrice([reglaPrecioFijo], productoBasico)).toBe(12);
  });

  it('ignores product rule when product id does not match', () => {
    expect(resolveProductPrice([reglaPrecioFijo], productoConIeps)).toBe(15);
  });

  it('applies descuento rule by category', () => {
    const price = resolveProductPrice([reglaDescuento], productoBasico);
    expect(price).toBe(9); // 10 - 10%
  });

  it('applies margen_costo rule as global fallback', () => {
    const price = resolveProductPrice([reglaMargenCosto], productoConIeps);
    expect(price).toBe(12);
  });

  it('enforces precio_minimo', () => {
    const lowCostProduct = { ...productoBasico, costo: 2 };
    const price = resolveProductPrice([reglaMargenCosto], lowCostProduct);
    expect(price).toBe(8);
  });

  it('product rule has priority over category rule', () => {
    const price = resolveProductPrice([reglaPrecioFijo, reglaDescuento], productoBasico);
    expect(price).toBe(12);
  });
});

describe('calculatePrice – base_precio con_impuestos', () => {
  it('extracts pre-tax price when base includes taxes', () => {
    const rule = { ...reglaPrecioFijo, precio: 11.6, base_precio: 'con_impuestos' };
    const price = calculatePrice(rule, productoBasico);
    expect(price).toBe(10);
  });

  it('returns null for precio_fijo = 0 placeholder rules', () => {
    const rule = { ...reglaPrecioFijo, precio: 0, precio_minimo: null, aplica_a: 'categoria' as const, clasificacion_ids: ['cat-001'], producto_ids: [] };
    const price = calculatePrice(rule, productoBasico);
    expect(price).toBeNull();
  });
});

describe('resolveProductPrice – placeholder rules fallback', () => {
  it('falls back to precio_principal when precio_fijo = 0 category rule matches', () => {
    const placeholderRule: TarifaLineaRule = {
      ...reglaPrecioFijo, precio: 0, precio_minimo: null, aplica_a: 'categoria',
      clasificacion_ids: ['cat-001'], producto_ids: [],
    };
    const price = resolveProductPrice([placeholderRule], productoBasico);
    expect(price).toBe(10);
  });
});

describe('toDisplayPrice – always returns gross + rounded', () => {
  it('adds taxes to net price for sin_impuestos rule', () => {
    // productoBasico: iva 16%, no ieps → 12 * 1.16 = 13.92
    const display = toDisplayPrice(12, productoBasico, 'ninguno');
    expect(display).toBe(13.92);
  });

  it('applies redondeo as final step', () => {
    // 12 * 1.16 = 13.92 → cercano → 14
    const display = toDisplayPrice(12, productoBasico, 'cercano');
    expect(display).toBe(14);
  });
});

describe('resolveProductPricing – display price is always Precio Final (gross + rounded)', () => {
  it('sin_impuestos: displayPrice includes taxes and rounding', () => {
    const pricing = resolveProductPricing([reglaPrecioFijo], productoBasico);
    // unitPrice = 12 (net), displayPrice = 12 * 1.16 = 13.92 (no rounding rule)
    expect(pricing.unitPrice).toBe(12);
    expect(pricing.displayPrice).toBe(13.92);
    expect(pricing.basePrecio).toBe('sin_impuestos');
  });

  it('con_impuestos: displayPrice is gross with rounding', () => {
    const rule: TarifaLineaRule = {
      ...reglaPrecioFijo,
      tipo_calculo: 'precio_fijo',
      precio: 27.5,
      precio_minimo: null,
      redondeo: 'cercano',
      base_precio: 'con_impuestos',
    };

    const pricing = resolveProductPricing([rule], productoBasico);
    // 27.5 / 1.16 = 23.7069 → round2 = 23.71 (unitPrice)
    // displayPrice: 23.71 * 1.16 = 27.5036 → round2 = 27.5 → cercano → 28
    expect(pricing.unitPrice).toBe(23.71);
    expect(pricing.displayPrice).toBe(28);
    expect(pricing.basePrecio).toBe('con_impuestos');
  });

  it('no rules: displayPrice includes taxes on precio_principal', () => {
    const pricing = resolveProductPricing([], productoBasico);
    // precio_principal = 10, displayPrice = 10 * 1.16 = 11.6
    expect(pricing.unitPrice).toBe(10);
    expect(pricing.displayPrice).toBe(11.6);
  });
});

describe('usa_listas_precio = false – always uses precio_principal', () => {
  it('ignores precio_fijo rule when usa_listas_precio is false', () => {
    expect(resolveProductPrice([reglaPrecioFijo], { ...productoBasico, usa_listas_precio: false })).toBe(10);
  });

  it('ignores margen_costo rule when usa_listas_precio is false', () => {
    expect(resolveProductPrice([reglaMargenCosto], { ...productoBasico, usa_listas_precio: false })).toBe(10);
  });

  it('ignores descuento rule when usa_listas_precio is false', () => {
    expect(resolveProductPrice([reglaDescuento], { ...productoBasico, usa_listas_precio: false })).toBe(10);
  });

  it('resolveProductPricing returns precio_principal with no appliedRule', () => {
    const pricing = resolveProductPricing([reglaPrecioFijo, reglaDescuento], productoDirecto);
    expect(pricing.unitPrice).toBe(20);
    expect(pricing.appliedRule).toBeNull();
  });

  it('usa_listas_precio = true still applies rules normally', () => {
    expect(resolveProductPrice([reglaPrecioFijo], productoBasico)).toBe(12);
  });
});

describe('resolvePresentacionPricing', () => {
  const presentacionCaja = {
    id: 'pres-caja-12',
    factor_base: 12,
    precio_especial: null
  };

  const presentacionConEspecial = {
    id: 'pres-caja-6',
    factor_base: 6,
    precio_especial: 50
  };

  it('uses default fallback pricing when no rules match (no precio_especial)', () => {
    const basePricing = resolveProductPricing([], productoBasico); // unitPrice = 10, displayPrice = 11.6
    const pricing = resolvePresentacionPricing([], presentacionCaja, productoBasico, basePricing);
    // 10 * 12 = 120 (unitPrice), 11.6 * 12 = 139.2 (displayPrice)
    expect(pricing.unitPrice).toBe(120);
    expect(pricing.displayPrice).toBe(139.2);
  });

  it('uses default fallback pricing when no rules match (with precio_especial)', () => {
    const basePricing = resolveProductPricing([], productoBasico);
    const pricing = resolvePresentacionPricing([], presentacionConEspecial, productoBasico, basePricing);
    // precio_especial = 50 (displayPrice con impuestos). Divisor = 1.16. unitPrice = 50 / 1.16 = 43.10
    expect(pricing.displayPrice).toBe(50);
    expect(pricing.unitPrice).toBe(43.1);
  });

  it('applies presentation rule of type precio_fijo', () => {
    const rule: TarifaLineaRule = {
      aplica_a: 'presentacion',
      producto_ids: [],
      clasificacion_ids: [],
      presentacion_ids: ['pres-caja-12'],
      tipo_calculo: 'precio_fijo',
      precio: 100, // sin impuestos
      precio_minimo: null,
      margen_pct: null,
      descuento_pct: null,
      redondeo: 'ninguno',
      base_precio: 'sin_impuestos',
      lista_precio_id: null
    };

    const basePricing = resolveProductPricing([], productoBasico);
    const pricing = resolvePresentacionPricing([rule], presentacionCaja, productoBasico, basePricing);
    // unitPrice = 100, displayPrice = 100 * 1.16 = 116
    expect(pricing.unitPrice).toBe(100);
    expect(pricing.displayPrice).toBe(116);
  });

  it('applies presentation rule of type margen_costo', () => {
    const rule: TarifaLineaRule = {
      aplica_a: 'presentacion',
      producto_ids: [],
      clasificacion_ids: [],
      presentacion_ids: ['pres-caja-12'],
      tipo_calculo: 'margen_costo',
      precio: 0,
      precio_minimo: null,
      margen_pct: 50, // 50% margin
      descuento_pct: null,
      redondeo: 'ninguno',
      base_precio: 'sin_impuestos',
      lista_precio_id: null
    };

    const basePricing = resolveProductPricing([], productoBasico); // product cost = 5
    const pricing = resolvePresentacionPricing([rule], presentacionCaja, productoBasico, basePricing);
    // presentation cost = 5 * 12 = 60. unitPrice = 60 * 1.5 = 90
    expect(pricing.unitPrice).toBe(90);
    expect(pricing.displayPrice).toBe(104.4); // 90 * 1.16
  });

  it('applies presentation rule of type descuento_precio', () => {
    const rule: TarifaLineaRule = {
      aplica_a: 'presentacion',
      producto_ids: [],
      clasificacion_ids: [],
      presentacion_ids: ['pres-caja-12'],
      tipo_calculo: 'descuento_precio',
      precio: 0,
      precio_minimo: null,
      margen_pct: null,
      descuento_pct: 10, // 10% discount
      redondeo: 'ninguno',
      base_precio: 'sin_impuestos',
      lista_precio_id: null
    };

    const basePricing = resolveProductPricing([], productoBasico); // principal price = 10
    const pricing = resolvePresentacionPricing([rule], presentacionCaja, productoBasico, basePricing);
    // standard presentation price = 10 * 12 = 120. unitPrice = 120 * 0.9 = 108
    expect(pricing.unitPrice).toBe(108);
  });
});
