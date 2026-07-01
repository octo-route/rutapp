import { useState, useEffect } from "react";
import { X, Plus, Minus } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import type { ProductoPresentacion } from "@/hooks/usePresentaciones";
import {
  resolvePresentacionPricing,
  resolveProductPricing,
} from "@/lib/priceResolver";

interface Props {
  open: boolean;
  onClose: () => void;
  producto: any | null;
  presentaciones: ProductoPresentacion[];
  /** Base unit price (per unidad_granel o pz) ya afectado por reglas de precio */
  precioPorUnidadBase: number;
  /** Máximo permitido (en unidad base). Infinity si no hay límite. */
  stockMax?: number;
  tarifaRules?: any[];
  clienteListaPrecioId?: string | null;
  onConfirm: (data: {
    cantidadBase: number;
    paquetes: number | null;
    presentacion: ProductoPresentacion | null;
    pricing: ReturnType<typeof resolveProductPricing>;
  }) => void;
}

export function PresentacionSelectorModal({
  open,
  onClose,
  producto,
  presentaciones,
  precioPorUnidadBase,
  stockMax = Infinity,
  tarifaRules,
  clienteListaPrecioId,
  onConfirm,
}: Props) {
  const { symbol } = useCurrency();
  const [mode, setMode] = useState<"pres" | "libre">("pres");
  const [presId, setPresId] = useState<string | null>("base"); // 'base' para la unidad base (1 pz)
  const [paquetes, setPaquetes] = useState("1");
  const [pesoOverride, setPesoOverride] = useState(""); // peso real total opcional
  const [pesoLibre, setPesoLibre] = useState("");

  const esGranel = producto?.es_granel;
  const unidad = esGranel ? producto?.unidad_granel || "kg" : "pz";
  const presActivas = presentaciones.filter((p) => p.activo);

  useEffect(() => {
    if (!open) return;
    setMode("pres");
    // Si no es granel, por defecto seleccionamos la unidad base. Si es granel, la primera presentación si la hay.
    if (!esGranel) {
      setPresId("base");
    } else if (presActivas.length > 0) {
      setPresId(presActivas[0].id);
    } else {
      setMode("libre");
      setPresId(null);
    }
    setPaquetes("1");
    setPesoOverride("");
    setPesoLibre("");
  }, [open, producto?.id]);

  if (!open || !producto) return null;

  const isBaseSelected = presId === "base";
  const presSel = presActivas.find((p) => p.id === presId) ?? null;
  const factor = isBaseSelected ? 1 : presSel ? Number(presSel.factor_base) : 0;
  const paqNum = Math.max(0, Number(paquetes) || 0);
  const pesoOvr = pesoOverride.trim() ? Number(pesoOverride) : null;

  const fmtNum = (n: number, dec = 2) =>
    n.toLocaleString("es-MX", {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  const fmtQty = (n: number) =>
    n.toLocaleString("es-MX", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });

  // Resolve base product pricing and presentation pricing using rules
  const rules = tarifaRules ?? [];
  const prodForPricing = {
    id: producto.id,
    precio_principal: producto.precio_principal ?? 0,
    costo: producto.costo ?? 0,
    costos_adicionales: producto.costos_adicionales,
    clasificacion_id: producto.clasificacion_id,
    tiene_iva: producto.tiene_iva,
    iva_pct: producto.iva_pct ?? 16,
    tiene_ieps: producto.tiene_ieps,
    ieps_pct: producto.ieps_pct ?? 0,
    ieps_tipo: producto.ieps_tipo,
    usa_listas_precio: producto.usa_listas_precio,
  };

  const basePricing = rules.length
    ? resolveProductPricing(rules, prodForPricing, clienteListaPrecioId)
    : {
        unitPrice: precioPorUnidadBase,
        displayPrice: precioPorUnidadBase,
        rawUnitPrice: precioPorUnidadBase,
        rawDisplayPrice: precioPorUnidadBase,
        basePrecio: "sin_impuestos",
        appliedRule: undefined,
      };

  const getResolvedPresPricing = (p: ProductoPresentacion) => {
    return resolvePresentacionPricing(
      rules,
      {
        id: p.id,
        factor_base: p.factor_base,
        precio_especial: p.precio_especial,
      },
      prodForPricing,
      basePricing,
      clienteListaPrecioId,
    );
  };

  let cantidadBase = 0;
  let pricingForBaseUnit: ReturnType<typeof resolveProductPricing> =
    basePricing;

  if (mode === "pres") {
    cantidadBase =
      esGranel && pesoOvr && pesoOvr > 0 ? pesoOvr : paqNum * factor;
    if (!isBaseSelected && presSel && factor > 0) {
      const resolvedPres = getResolvedPresPricing(presSel);
      pricingForBaseUnit = {
        unitPrice: resolvedPres.unitPrice / factor,
        displayPrice: resolvedPres.displayPrice / factor,
        rawUnitPrice: resolvedPres.rawUnitPrice / factor,
        rawDisplayPrice: resolvedPres.rawDisplayPrice / factor,
        basePrecio: resolvedPres.basePrecio,
        appliedRule: resolvedPres.appliedRule,
      };
    }
  } else {
    cantidadBase = Math.max(0, Number(pesoLibre) || 0);
  }

  const subtotal = cantidadBase * pricingForBaseUnit.displayPrice;
  const excedeStock = Number.isFinite(stockMax) && cantidadBase > stockMax;
  const canConfirm = cantidadBase > 0 && !excedeStock;

  const confirmar = () => {
    if (!canConfirm) return;
    onConfirm({
      cantidadBase,
      paquetes: mode === "pres" && !isBaseSelected ? paqNum : null,
      presentacion: mode === "pres" && !isBaseSelected ? presSel : null,
      pricing: pricingForBaseUnit,
    });
    onClose();
  };

  const adjustPaquetes = (delta: number) => {
    const next = Math.max(0, paqNum + delta);
    setPaquetes(String(next));
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-card w-full sm:max-w-2xl lg:max-w-3xl rounded-t-2xl sm:rounded-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10 rounded-t-2xl sm:rounded-2xl">
          <div>
            <h3 className="text-base sm:text-xl font-semibold">
              {producto.nombre}
            </h3>
            <p className="text-[12px] sm:text-sm text-muted-foreground">
              {symbol}
              {fmtNum(basePricing.displayPrice)} / {unidad}
              {Number.isFinite(stockMax) && (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-foreground">
                    Stock: {fmtQty(stockMax)} {unidad}
                  </span>
                </>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
          {/* Mode tabs solo si es granel */}
          {esGranel && (
            <div className="flex gap-1 bg-accent/40 p-1 rounded-lg">
              <button
                onClick={() => setMode("pres")}
                disabled={presActivas.length === 0}
                className={`flex-1 py-2 sm:py-2.5 text-[13px] sm:text-sm font-medium rounded-md transition-colors ${mode === "pres" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"} disabled:opacity-40`}
              >
                Presentaciones
              </button>
              <button
                onClick={() => setMode("libre")}
                className={`flex-1 py-2 sm:py-2.5 text-[13px] sm:text-sm font-medium rounded-md transition-colors ${mode === "libre" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                Peso libre
              </button>
            </div>
          )}

          {mode === "pres" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                {/* Opción de Unidad Base (siempre presente para no-granel) */}
                {!esGranel && (
                  <button
                    onClick={() => setPresId("base")}
                    className={`text-left rounded-lg px-3 py-3 border-2 transition-all ${isBaseSelected ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent/40"}`}
                  >
                    <p className="text-sm sm:text-base font-semibold leading-tight">
                      1 {unidad}
                    </p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                      Unidad base
                    </p>
                    <p className="text-sm sm:text-base font-bold text-primary mt-1">
                      {symbol}
                      {fmtNum(basePricing.displayPrice)}
                    </p>
                  </button>
                )}

                {presActivas.map((p) => {
                  const active = p.id === presId;
                  const resolved = getResolvedPresPricing(p);
                  const pUnit = resolved.displayPrice;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPresId(p.id)}
                      className={`text-left rounded-lg px-3 py-3 border-2 transition-all ${active ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent/40"}`}
                    >
                      <p className="text-sm sm:text-base font-semibold leading-tight">
                        {p.nombre}
                      </p>
                      <p className="text-[11px] sm:text-xs text-muted-foreground tabular-nums mt-0.5">
                        {fmtQty(Number(p.factor_base))} {unidad}
                      </p>
                      <p className="text-sm sm:text-base font-bold text-primary tabular-nums mt-1">
                        {symbol}
                        {fmtNum(pUnit)}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground uppercase">
                  Cantidad {isBaseSelected ? `(${unidad})` : "de paquetes"}
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => adjustPaquetes(-1)}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-accent flex items-center justify-center active:scale-95"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <input
                    type="number"
                    inputMode={esGranel ? "decimal" : "numeric"}
                    step={esGranel ? "0.001" : "1"}
                    min="0"
                    value={paquetes}
                    onChange={(e) => setPaquetes(e.target.value)}
                    className="flex-1 h-12 sm:h-14 text-center bg-card border border-border rounded-lg text-xl sm:text-2xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={() => adjustPaquetes(1)}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary text-primary-foreground flex items-center justify-center active:scale-95"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {esGranel && !isBaseSelected && (
                <div>
                  <label className="text-xs sm:text-sm font-medium text-muted-foreground uppercase">
                    Peso real total ({unidad}){" "}
                    <span className="normal-case font-normal text-muted-foreground/70">
                      — opcional, si los paquetes pesan distinto
                    </span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    min="0"
                    placeholder={`Sugerido: ${fmtQty(paqNum * factor)}`}
                    value={pesoOverride}
                    onChange={(e) => setPesoOverride(e.target.value)}
                    className="mt-2 w-full h-11 sm:h-12 px-3 bg-card border border-border rounded-lg text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              )}
            </>
          )}

          {mode === "libre" && esGranel && (
            <div>
              <label className="text-xs sm:text-sm font-medium text-muted-foreground uppercase">
                Peso ({unidad})
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                autoFocus
                value={pesoLibre}
                onChange={(e) => setPesoLibre(e.target.value)}
                className="mt-2 w-full h-14 sm:h-16 px-3 bg-card border border-border rounded-lg text-2xl sm:text-3xl font-bold text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          {/* Resumen */}
          <div className="bg-accent/30 rounded-lg p-4 space-y-2 mt-6">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cantidad total:</span>
              <span
                className={`font-semibold tabular-nums ${excedeStock ? "text-destructive" : ""}`}
              >
                {fmtQty(cantidadBase)} {unidad}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Precio unitario:</span>
              <span className="tabular-nums">
                {symbol}
                {fmtNum(pricingForBaseUnit.displayPrice)} / {unidad}
              </span>
            </div>
            <div className="flex justify-between text-base sm:text-lg pt-2 border-t border-border/60">
              <span className="font-semibold">Subtotal:</span>
              <span className="font-bold text-primary tabular-nums">
                {symbol}
                {fmtNum(subtotal)}
              </span>
            </div>
          </div>

          {excedeStock && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-center">
              No puedes vender más de {fmtQty(stockMax)} {unidad} disponibles en
              stock.
            </div>
          )}

          <button
            onClick={confirmar}
            disabled={!canConfirm}
            className="w-full bg-primary text-primary-foreground rounded-xl py-4 text-base sm:text-lg font-semibold active:scale-[0.98] transition-transform disabled:opacity-40 mt-4"
          >
            {excedeStock ? "Excede el stock disponible" : "Agregar al carrito"}
          </button>
        </div>
      </div>
    </div>
  );
}
