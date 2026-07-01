import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { OdooStatusbar } from '@/components/OdooStatusbar';
import { OdooTabs } from '@/components/OdooTabs';
import { TableSkeleton } from '@/components/TableSkeleton';
import { useCotizacionForm, COTIZACION_STEPS } from './useCotizacionForm';
import { CotizacionFormFields } from './CotizacionFormFields';
import { CotizacionLineasTab } from './CotizacionLineasTab';
import { Save, Trash, ArrowLeft, RefreshCw, FileText } from 'lucide-react';
import type { StatusCotizacion } from '@/types';
import SearchableSelect from '@/components/SearchableSelect';
import { useAlmacenes } from '@/hooks/useData';
import { PresentacionSelectorModal } from '@/components/ruta/PresentacionSelectorModal';
import DocumentPreviewModal from '@/components/DocumentPreviewModal';

export default function CotizacionFormPage() {
  const isMobile = useIsMobile();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [selectedAlmacen, setSelectedAlmacen] = useState<string>('');
  const { data: almacenesList } = useAlmacenes();

  const {
    id, isNew, form, lineas, setLineas, readOnly, canEditCotizacion, isLoading,
    productBeingConfigured, setProductBeingConfigured, handleConfirmPresentacion, handleEditPresentacion,
    navigate, clientesList, productosList, tarifasList, vendedoresList,
    profile, user, empresa, totals, saveCotizacion, tarifaRules, effectiveListaId,
    set, handleProductSelect, handleSave, handleDelete, handleStatusChange, handleConvertToVenta,
    addLine, updateLine, removeLine, setCellRef, handleCellKeyDown, navigateCell,
  } = useCotizacionForm();

  if (!isNew && isLoading) return <div className="p-4 min-h-full"><TableSkeleton rows={6} cols={4} /></div>;

  const clienteOptions = (clientesList ?? [])
    .filter(c => c.status === 'activo' || c.id === form.cliente_id)
    .map(c => ({ value: c.id, label: `${c.codigo ? c.codigo + ' · ' : ''}${c.nombre}` }));
  const vendedorOptions = (vendedoresList ?? []).map(v => ({ value: v.id, label: v.nombre }));
  const clienteNombre = clientesList?.find(c => c.id === form.cliente_id)?.nombre;

  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);

  const handleConvert = () => {
    handleConvertToVenta(selectedAlmacen || undefined);
    setShowConvertConfirm(false);
  };

  const handleGenerarPdf = async () => {
    const clienteData = clientesList?.find(c => c.id === form.cliente_id);
    const vendedorNombre = (form as any).vendedores?.nombre;
    const { generarCotizacionPdf } = await import('./CotizacionPdfHandler');
    const blob = await generarCotizacionPdf({
      form,
      empresa,
      profile,
      userEmail: user?.email,
      clienteData,
      lineas,
      productosList: productosList ?? [],
      entregasExistentes: [],
      pagosData: [],
      vendedorNombre,
    });
    setPdfBlob(blob);
    setShowPdfModal(true);
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-20 flex items-center justify-between px-3 sm:px-5 h-14">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ventas/cotizaciones')} className="p-1.5 -ml-1.5 hover:bg-muted rounded text-muted-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
              {isNew ? 'Nueva Cotización' : form.folio}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={handleGenerarPdf}
              className="btn-odoo-secondary bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Compartir / PDF</span>
            </button>
          )}
          {!readOnly && (
            <button
              onClick={() => handleSave()}
              disabled={saveCotizacion.isPending}
              className="btn-odoo-primary"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">{saveCotizacion.isPending ? 'Guardando...' : 'Guardar'}</span>
            </button>
          )}
          {!isNew && !(form as any).venta_id && (
            <button
              onClick={() => setShowConvertConfirm(true)}
              className="btn-odoo-secondary bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Convertir a Venta</span>
            </button>
          )}
          {!isNew && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-odoo-secondary text-destructive hover:bg-destructive/10 border-transparent hover:border-destructive/20"
            >
              <Trash className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!isNew && <div className="px-5 pt-3"><OdooStatusbar steps={COTIZACION_STEPS} current={form.status as string} onStepClick={(!canEditCotizacion || (form as any).venta_id) ? undefined : k => handleStatusChange(k as StatusCotizacion)} /></div>}
      
      <div className="p-3 sm:p-5 space-y-4 max-w-[1200px]">
        <div className="bg-card border border-border rounded-md p-5">
          {readOnly && <div className="mb-3 text-xs text-muted-foreground bg-muted/60 border border-border px-3 py-2 rounded flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/50" />Esta cotización está {form.status} y no se puede editar.</div>}
          {(form as any).venta_id && <div className="mb-3 text-sm font-medium text-primary bg-primary/10 border border-primary/20 px-3 py-2 rounded flex items-center gap-2">Esta cotización fue convertida a la venta: {(form as any).ventas?.folio || 'Ver Venta'}</div>}
          <CotizacionFormFields form={form} readOnly={readOnly} isNew={isNew} clienteOptions={clienteOptions} vendedorOptions={vendedorOptions} clienteNombre={clienteNombre} set={set} onClienteChange={(cId) => set('cliente_id', cId)} />
        </div>
        
        <div className="bg-card border border-border rounded-md">
          <OdooTabs tabs={[
            { key: 'lineas', label: 'Líneas de cotización', content: <CotizacionLineasTab lineas={lineas} productosList={productosList ?? []} readOnly={readOnly} totals={totals} promoResults={[]} onProductSelect={handleProductSelect} onUpdateLine={updateLine} onRemoveLine={removeLine} onAddLine={addLine} setCellRef={setCellRef} onCellKeyDown={handleCellKeyDown} navigateCell={navigateCell} setLineas={setLineas} onEditPresentacion={handleEditPresentacion} readOnlyForm={readOnly} saldoPendiente={0} /> },
            { key: 'notas', label: 'Notas', content: <div className="p-4">{readOnly ? <p className="text-[13px] text-foreground whitespace-pre-wrap">{form.notas || 'Sin notas'}</p> : <textarea className="input-odoo w-full min-h-[100px]" value={form.notas ?? ''} onChange={e => set('notas', e.target.value)} placeholder="Notas para el cliente..." />}</div> },
          ]} />
        </div>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta cotización?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. La cotización y todas sus líneas serán eliminadas permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert to Venta confirm */}
      <AlertDialog open={showConvertConfirm} onOpenChange={setShowConvertConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convertir a Venta</AlertDialogTitle>
            <AlertDialogDescription>
              Se creará una nueva venta en estado "borrador" con los datos de esta cotización. 
              Puedes seleccionar un almacén para afectar el inventario al confirmar la venta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="label-odoo">Almacén (Opcional)</label>
            <select
              className="input-odoo w-full"
              value={selectedAlmacen}
              onChange={(e) => setSelectedAlmacen(e.target.value)}
            >
              <option value="">Seleccionar almacén...</option>
              {(almacenesList ?? []).map((a: any) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvert}>Convertir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Presentaciones Modal */}
      {productBeingConfigured && (
        <PresentacionSelectorModal
          open={!!productBeingConfigured}
          producto={productBeingConfigured.producto}
          presentaciones={productBeingConfigured.presentaciones}
          precioPorUnidadBase={productBeingConfigured.precioBase}
          tarifaRules={tarifaRules ?? []}
          clienteListaPrecioId={effectiveListaId ?? null}
          onConfirm={handleConfirmPresentacion}
          onClose={() => setProductBeingConfigured(null)}
        />
      )}

      <DocumentPreviewModal 
        open={showPdfModal} 
        onClose={() => { setShowPdfModal(false); setPdfBlob(null); }} 
        pdfBlob={pdfBlob} 
        fileName={`${form.folio ?? 'cotizacion'}.pdf`} 
        empresaId={empresa?.id ?? ''} 
        defaultPhone={clientesList?.find(c => c.id === form.cliente_id)?.telefono ?? ''} 
        caption={`Cotización ${form.folio}`} 
        tipo="cotizacion" 
        referencia_id={form.id} 
      />
    </div>
  );
}
