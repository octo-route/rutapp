import { ArrowLeft } from 'lucide-react';
import { useCallback } from 'react';
import TicketVenta from '@/components/ruta/TicketVenta';
import { STEPS, STEP_LABELS } from './types';
import { useRutaVenta } from './useRutaVenta';
import { printTicket } from '@/lib/printTicketUtil';
import type { TicketData } from '@/lib/ticketHtml';
import { StepTipo } from './StepTipo';
import { StepSinCompra } from './StepSinCompra';
import { StepCliente } from './StepCliente';
import { StepDevoluciones } from './StepDevoluciones';
import { StepProductos } from './StepProductos';
import { StepResumen } from './StepResumen';
import { StepPago } from './StepPago';
import { useAlmacenGuard } from '@/hooks/useAlmacenGuard';
import { PresentacionSelectorModal } from '@/components/ruta/PresentacionSelectorModal';

export default function RutaNuevaVenta() {
  const { checkAlmacen, AlmacenDialog } = useAlmacenGuard();
  const h = useRutaVenta({ onAlmacenMissing: () => checkAlmacen() });

  const ticketAncho = (h.empresa as any)?.ticket_ancho ?? '80';

  const handlePrintTicket = useCallback(async () => {
    if (!h.ticketInfo) return;
    const lineas = h.cart.map(item => {
      const lineSub = item.precio_unitario * item.cantidad;
      const lineIeps = item.tiene_ieps ? lineSub * (item.ieps_pct / 100) : 0;
      const lineIva = item.tiene_iva ? (lineSub + lineIeps) * (item.iva_pct / 100) : 0;
      return { nombre: item.nombre, cantidad: item.cantidad, precio: item.precio_unitario, total: lineSub + lineIva + lineIeps, iva_monto: lineIva, ieps_monto: lineIeps, descuento_pct: 0, esCambio: item.es_cambio, producto_id: item.producto_id };
    });
    const td: TicketData = {
      empresa: { nombre: h.empresa?.nombre ?? '', telefono: h.empresa?.telefono, direccion: h.empresa?.direccion, logo_url: h.empresa?.logo_url, rfc: h.empresa?.rfc, razon_social: (h.empresa as any)?.razon_social, colonia: (h.empresa as any)?.colonia, ciudad: (h.empresa as any)?.ciudad, estado: (h.empresa as any)?.estado, cp: (h.empresa as any)?.cp, email: (h.empresa as any)?.email, moneda: (h.empresa as any)?.moneda, notas_ticket: (h.empresa as any)?.notas_ticket, ticket_campos: (h.empresa as any)?.ticket_campos },
      folio: h.ticketInfo.folio, fecha: h.ticketInfo.fecha, clienteNombre: h.clienteNombre,
      vendedorNombre: h.profile?.nombre ?? '',
      lineas, subtotal: h.totals.subtotal, iva: h.totals.iva, ieps: h.totals.ieps, total: h.totals.total,
      condicionPago: h.condicionPago, metodoPago: h.pagos.map(p => p.metodo_pago).join(', '),
      montoRecibido: h.montoRecibidoNum, cambio: h.cambio,
      saldoAnterior: h.saldoPendienteTotal, pagoAplicado: h.totalAplicarCuentas,
      saldoNuevo: h.saldoPendienteTotal - h.totalAplicarCuentas + (h.condicionPago === 'credito' ? h.totals.total : 0),
      promociones: h.promoResults.filter(r => r.descuento > 0).map(r => ({ descripcion: r.descripcion, descuento: r.descuento, producto_id: r.producto_id })),
      pagos: h.pagos.map(p => ({ metodo: p.metodo_pago, monto: Number(p.monto), fecha: h.ticketInfo.fecha })),
    };
    await printTicket(td, { ticketAncho });
  }, [h.ticketInfo, h.cart, h.empresa, h.clienteNombre, h.totals, h.condicionPago, h.pagos, h.montoRecibidoNum, h.cambio, h.saldoPendienteTotal, h.totalAplicarCuentas, h.promoResults, ticketAncho]);

  if (h.ticketInfo) {
    return (
      <TicketVenta
        empresa={{ nombre: h.empresa?.nombre ?? '', telefono: h.empresa?.telefono, direccion: h.empresa?.direccion, logo_url: h.empresa?.logo_url, rfc: h.empresa?.rfc, moneda: (h.empresa as any)?.moneda, razon_social: (h.empresa as any)?.razon_social, colonia: (h.empresa as any)?.colonia, ciudad: (h.empresa as any)?.ciudad, estado: (h.empresa as any)?.estado, cp: (h.empresa as any)?.cp, email: (h.empresa as any)?.email, notas_ticket: (h.empresa as any)?.notas_ticket }}
        folio={h.ticketInfo.folio} fecha={h.ticketInfo.fecha} clienteNombre={h.clienteNombre}
        vendedorNombre={h.profile?.nombre ?? ''}
        lineas={h.cart.map(item => { const lineSub = item.precio_unitario * item.cantidad; const lineIeps = item.tiene_ieps ? lineSub * (item.ieps_pct / 100) : 0; const lineIva = item.tiene_iva ? (lineSub + lineIeps) * (item.iva_pct / 100) : 0; return { nombre: item.nombre, cantidad: item.cantidad, precio: item.precio_unitario, subtotal: lineSub, iva_monto: lineIva, ieps_monto: lineIeps, descuento_pct: 0, total: lineSub + lineIeps + lineIva, esCambio: item.es_cambio, producto_id: item.producto_id }; })}
        subtotal={h.totals.subtotal} iva={h.totals.iva} ieps={h.totals.ieps} total={h.totals.total}
        descuentoDevolucion={h.totals.descuentoDevolucion ?? 0}
        devoluciones={h.devoluciones.map(d => ({ nombre: d.nombre, cantidad: d.cantidad, motivo: d.motivo, accion: d.accion, monto: d.precio_unitario * d.cantidad }))}
        condicionPago={h.condicionPago} metodoPago={h.pagos.map(p => p.metodo_pago).join(', ')} montoRecibido={h.montoRecibidoNum} cambio={h.cambio}
        saldoAnterior={h.saldoPendienteTotal} pagoAplicado={h.totalAplicarCuentas}
        saldoNuevo={h.saldoPendienteTotal - h.totalAplicarCuentas + (h.condicionPago === 'credito' ? h.totals.total : 0)}
        promociones={h.promoResults.filter(r => r.descuento > 0).map(r => ({ descripcion: r.descripcion, descuento: r.descuento, producto_id: r.producto_id }))}
        pagos={h.pagos.map(p => ({ metodo: p.metodo_pago, monto: Number(p.monto), fecha: h.ticketInfo.fecha }))}
        productosList={h.productos as any}
        onPrintTicket={handlePrintTicket}
        onClose={() => h.navigate('/ruta')}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {AlmacenDialog}
      <header className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border pt-[max(0px,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 px-3 h-12">
          <button onClick={h.goBack} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent active:scale-95 transition-all"><ArrowLeft className="h-[18px] w-[18px] text-foreground" /></button>
          <span className="text-[15px] font-semibold text-foreground flex-1">Nueva venta</span>
        </div>
        <div className="flex px-3 pb-2.5 gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-[3px] w-full rounded-full transition-colors ${i <= h.currentStepIdx ? 'bg-primary' : 'bg-border'}`} />
              <span className={`text-[9px] font-medium transition-colors ${i <= h.currentStepIdx ? 'text-primary' : 'text-muted-foreground/60'}`}>{STEP_LABELS[s]}</span>
            </div>
          ))}
        </div>
      </header>

      {h.step === 'tipo' && !h.sinCompra && <StepTipo sinCompra={h.sinCompra} setSinCompra={h.setSinCompra} setTipoVenta={h.setTipoVenta} setCondicionPago={h.setCondicionPago} setStep={h.setStep} urlClienteId={h.urlClienteId} />}
      {h.step === 'tipo' && h.sinCompra && <StepSinCompra clienteNombre={h.clienteNombre} motivoSinCompra={h.motivoSinCompra} setMotivoSinCompra={h.setMotivoSinCompra} notas={h.notas} setNotas={h.setNotas} savingSinCompra={h.savingSinCompra} setSavingSinCompra={h.setSavingSinCompra} setSinCompra={h.setSinCompra} saveVisita={h.saveVisita} markVisited={h.markVisited} clienteId={h.clienteId} urlClienteId={h.urlClienteId} navigate={h.navigate} />}
      {h.step === 'cliente' && <StepCliente searchCliente={h.searchCliente} setSearchCliente={h.setSearchCliente} filteredClientes={h.filteredClientes} clienteId={h.clienteId} setClienteId={h.setClienteId} setClienteNombre={h.setClienteNombre} setClienteCredito={h.setClienteCredito} setCondicionPago={h.setCondicionPago} setStep={h.setStep} />}
      {h.step === 'devoluciones' && <StepDevoluciones clienteNombre={h.clienteNombre} searchDevProducto={h.searchDevProducto} setSearchDevProducto={h.setSearchDevProducto} filteredDevProductos={h.filteredDevProductos} devoluciones={h.devoluciones} addDevolucion={h.addDevolucion} updateDevQty={h.updateDevQty} updateDevMotivo={h.updateDevMotivo} updateDevAccion={h.updateDevAccion} batchUpdateDevDefaults={h.batchUpdateDevDefaults} showReemplazoFor={h.showReemplazoFor} setShowReemplazoFor={h.setShowReemplazoFor} searchReemplazo={h.searchReemplazo} setSearchReemplazo={h.setSearchReemplazo} filteredReemplazoProductos={h.filteredReemplazoProductos} setReemplazo={h.setReemplazo} processDevolucionesAndGoToProductos={h.processDevolucionesAndGoToProductos} fmt={h.fmt} />}
      {h.step === 'productos' && <StepProductos clienteNombre={h.clienteNombre} devoluciones={h.devoluciones} searchProducto={h.searchProducto} setSearchProducto={h.setSearchProducto} filteredProductos={h.filteredProductos} cart={h.cart} cambioItems={h.cambioItems} tipoVenta={h.tipoVenta} totals={h.totals} addToCart={h.addToCart} updateQty={h.updateQty} removeFromCart={h.removeFromCart} getItemInCart={h.getItemInCart} getMaxQty={h.getMaxQty} setStep={h.setStep} setCart={h.setCart} stockAbordo={h.stockAbordo} usandoAlmacen={h.usandoAlmacen} fmt={h.fmt} insights={h.insights} bannerDismissed={h.bannerDismissed} setBannerDismissed={h.setBannerDismissed} applyManualList={h.applyManualList} applyHistorialAvg={h.applyHistorialAvg} repeatLastSale={h.repeatLastSale} findProductByCode={h.findProductByCode} setItemQty={h.setItemQty} getSuggestedPrice={h.getSuggestedPrice} setItemPriceManual={h.setItemPriceManual} setItemPriceFromLista={h.setItemPriceFromLista} resetItemToSuggested={h.resetItemToSuggested} canChangePrice={h.canChangePrice} />}
      {h.step === 'resumen' && <StepResumen clienteNombre={h.clienteNombre} devoluciones={h.devoluciones} cambioItems={h.cambioItems} chargedItems={h.chargedItems} promoResults={h.promoResults} totals={h.totals} saldoPendienteTotal={h.saldoPendienteTotal} setStep={h.setStep} goToPayment={h.goToPayment} navigate={h.navigate} cart={h.cart} fmt={h.fmt} canApplyDiscount={h.canApplyDiscount} descuentoExtraTipo={h.descuentoExtraTipo} setDescuentoExtraTipo={h.setDescuentoExtraTipo} descuentoExtraValor={h.descuentoExtraValor} setDescuentoExtraValor={h.setDescuentoExtraValor} descuentoExtraMotivo={h.descuentoExtraMotivo} setDescuentoExtraMotivo={h.setDescuentoExtraMotivo} />}
      {h.step === 'pago' && <StepPago tipoVenta={h.tipoVenta} entregaInmediata={h.entregaInmediata} fechaEntrega={h.fechaEntrega} setFechaEntrega={h.setFechaEntrega} condicionPago={h.condicionPago} setCondicionPago={h.setCondicionPago} clienteCredito={h.clienteCredito} excedeCredito={h.excedeCredito} creditoDisponible={h.creditoDisponible} saldoPendienteTotal={h.saldoPendienteTotal} cuentasPendientes={h.cuentasPendientes} liquidarTodas={h.liquidarTodas} updateCuentaMonto={h.updateCuentaMonto} totalAplicarCuentas={h.totalAplicarCuentas} pagos={h.pagos} setPagos={h.setPagos} notas={h.notas} setNotas={h.setNotas} totals={h.totals} totalACobrar={h.totalACobrar} cambio={h.cambio} saving={h.saving} cart={h.cart} devoluciones={h.devoluciones} handleSave={h.handleSave} navigate={h.navigate} fmt={h.fmt} canApplyDiscount={h.canApplyDiscount} descuentoExtraTipo={h.descuentoExtraTipo} setDescuentoExtraTipo={h.setDescuentoExtraTipo} descuentoExtraValor={h.descuentoExtraValor} setDescuentoExtraValor={h.setDescuentoExtraValor} descuentoExtraMotivo={h.descuentoExtraMotivo} setDescuentoExtraMotivo={h.setDescuentoExtraMotivo} />}
      
      {h.showPresentacionModal && h.selectedProductoPresentacion && (
        <PresentacionSelectorModal
          open={h.showPresentacionModal}
          onClose={() => h.setShowPresentacionModal(false)}
          producto={h.selectedProductoPresentacion}
          presentaciones={h.presentaciones.filter((pr: any) => pr.producto_id === h.selectedProductoPresentacion.id)}
          precioPorUnidadBase={h.selectedProductoPresentacion?.precio_principal ?? 0}
          stockMax={
            (h.selectedProductoPresentacion?.vender_sin_stock || h.selectedProductoPresentacion?.es_combo || h.selectedProductoPresentacion?.se_puede_inventariar === false)
              ? Infinity
              : Number(h.selectedProductoPresentacion?.cantidad ?? 0)
          }
          tarifaRules={h.tarifaLineasOffline ?? []}
          clienteListaPrecioId={h.clienteListaPrecioId}
          onConfirm={(payload: any) => {
            h.setCart((prev: any[]) => [
              ...prev,
              {
                producto_id: h.selectedProductoPresentacion.id,
                codigo: h.selectedProductoPresentacion.codigo,
                nombre: h.selectedProductoPresentacion.nombre,
                precio_unitario: payload.pricing.unitPrice,
                precio_unitario_sin_redondeo: payload.pricing.rawUnitPrice,
                precio_display_sin_redondeo: payload.pricing.rawDisplayPrice,
                cantidad: payload.cantidadBase,
                tiene_iva: h.selectedProductoPresentacion.tiene_iva ?? false,
                iva_pct: h.selectedProductoPresentacion.tiene_iva ? (h.selectedProductoPresentacion.iva_pct ?? 16) : 0,
                tiene_ieps: h.selectedProductoPresentacion.tiene_ieps ?? false,
                ieps_pct: h.selectedProductoPresentacion.tiene_ieps ? (h.selectedProductoPresentacion.ieps_pct ?? 0) : 0,
                unidad: h.selectedProductoPresentacion.unidad_granel ?? "kg",
                base_precio: payload.pricing.basePrecio,
                redondeo: payload.pricing.appliedRule?.redondeo ?? "ninguno",
                _max_stock: h.selectedProductoPresentacion.vender_sin_stock ? Infinity : (h.selectedProductoPresentacion.cantidad ?? 0),
                _es_granel: true,
                presentacion_id: payload.presentacion?.id ?? null,
                presentacion_nombre: payload.presentacion?.nombre ?? null,
                presentacion_factor: payload.presentacion?.factor_base ? Number(payload.presentacion.factor_base) : null,
                paquetes: payload.paquetes ?? null,
              },
            ]);
            h.setShowPresentacionModal(false);
            h.setSelectedProductoPresentacion(null);
          }}
        />
      )}
    </div>
  );
}
