import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, FileCheck, DollarSign } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import { fmtDate, extractEdgeFunctionError, roundMoney } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cobroId?: string | null;
  onSuccess?: () => void;
}

export function TimbrarPagoDialog({ open, onOpenChange, cobroId, onSuccess }: Props) {
  const { empresa, user } = useAuth();
  const { fmt: fmtC } = useCurrency();
  const queryClient = useQueryClient();
  const [timbrating, setTimbrating] = useState(false);

  // Receiver form (loaded from the first client associated with the cobro)
  const [receiver, setReceiver] = useState({
    rfc: '',
    name: '',
    fiscal_regime: '601',
    tax_zip_code: '',
  });

  const [paymentForm, setPaymentForm] = useState('01');

  // Load basic cobro data
  const { data: cobro } = useQuery({
    queryKey: ['cobro-detalle', cobroId],
    enabled: !!cobroId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobros')
        .select(`
          *,
          clientes (
            nombre, rfc, regimen_fiscal, uso_cfdi, cp, 
            facturama_rfc, facturama_razon_social, facturama_regimen_fiscal, facturama_uso_cfdi, facturama_cp
          ),
          cobro_aplicaciones (
            id, monto,
            ventas (
              id, folio, total, cfdis (id, folio_fiscal, status, cfdi_type)
            )
          )
        `)
        .eq('id', cobroId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Calculate the related documents (invoices) and their installment numbers
  const { data: relatedDocs } = useQuery({
    queryKey: ['cobro-related-docs', cobroId],
    enabled: !!cobroId && !!cobro && open,
    queryFn: async () => {
      if (!cobro) return [];
      
      const docs = [];
      for (const app of (cobro.cobro_aplicaciones || [])) {
        if (!app.ventas) continue;
        const venta = Array.isArray(app.ventas) ? app.ventas[0] : app.ventas; // Ensure it's single object
        if (!venta) continue;
        
        // Ensure there is a parent CFDI stamped for this venta
        const parentCfdis = Array.isArray(venta.cfdis) ? venta.cfdis : (venta.cfdis ? [venta.cfdis] : []);
        const stampedParent = parentCfdis.find((c: any) => c.status === 'timbrado' && c.cfdi_type !== 'P');
        
        if (!stampedParent || !stampedParent.folio_fiscal) {
          continue; // Cannot emit payment receipt if parent is not stamped
        }

        // Find previous payments applied to this venta to calculate installment number and previous balance
        const { data: allApps } = await supabase
          .from('cobro_aplicaciones')
          .select('id, monto, cobros(fecha)')
          .eq('venta_id', venta.id)
          .order('created_at', { ascending: true });

        let prevBalance = venta.total || 0;
        let installmentNumber = 0;
        let foundCurrent = false;

        for (let i = 0; i < (allApps || []).length; i++) {
          const a = (allApps || [])[i];
          if (a.id === app.id) {
            installmentNumber = i + 1;
            foundCurrent = true;
            break;
          }
          prevBalance -= (a.monto || 0);
        }

        if (!foundCurrent) continue;

        docs.push({
          Uuid: stampedParent.folio_fiscal,
          Currency: 'MXN',
          PaymentMethod: 'PPD', // Required for related documents in a REP
          InstallmentNumber: installmentNumber,
          PreviousBalanceAmount: roundMoney(prevBalance),
          AmountPaid: roundMoney(app.monto),
          OutstandingBalanceAmount: roundMoney(Math.max(0, prevBalance - (app.monto || 0))),
          TaxObject: "01", // "01" means not subject to tax breakdown (Simplification to avoid full tax unrolling on REP, if allowed. Most PPD allow 01 if no breakdown is required, else we might need full calculation)
          folio_venta: venta.folio || venta.id.substring(0, 8),
          parentCfdiId: stampedParent.id
        });
      }
      return docs;
    },
  });

  // Catalogs
  const { data: formasPago } = useQuery({
    queryKey: ['cat_forma_pago_active'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('cat_forma_pago').select('clave, descripcion').eq('activo', true).order('clave');
      return data || [];
    },
  });

  const { data: regimenesList } = useQuery({
    queryKey: ['cat_regimen_fiscal_active'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('cat_regimen_fiscal').select('clave, descripcion').eq('activo', true).order('clave');
      return data || [];
    },
  });

  useEffect(() => {
    if (cobro?.clientes) {
      const c = cobro.clientes as any;
      setReceiver({
        rfc: c.facturama_rfc || c.rfc || '',
        name: c.facturama_razon_social || c.nombre || '',
        fiscal_regime: c.facturama_regimen_fiscal || c.regimen_fiscal || '601',
        tax_zip_code: c.facturama_cp || c.cp || '',
      });
    }

    if (cobro?.metodo_pago) {
      if (cobro.metodo_pago === 'transferencia') setPaymentForm('03');
      else if (cobro.metodo_pago === 'tarjeta') setPaymentForm('04');
      else setPaymentForm('01'); // efectivo
    }
  }, [cobro]);

  const timbrarMutation = useMutation({
    mutationFn: async () => {
      if (!empresa?.id || !user?.id || !cobro) throw new Error("Datos faltantes");
      if (!receiver.rfc || !receiver.name || !receiver.tax_zip_code) throw new Error("Datos fiscales del receptor incompletos");
      if (!relatedDocs || relatedDocs.length === 0) throw new Error("No hay facturas timbradas asociadas a este cobro");

      // 1. Crear registro en cfdis con status = 'generando', cfdi_type = 'P'
      const { data: cfdi, error: cfdiErr } = await supabase.from('cfdis').insert({
        empresa_id: empresa.id,
        user_id: user.id,
        cfdi_type: 'P',
        status: 'generando',
        total: cobro.monto || 0,
        subtotal: cobro.monto || 0,
        currency: 'MXN',
        payment_form: paymentForm,
        payment_method: 'PPD',
        receiver_name: receiver.name,
        receiver_rfc: receiver.rfc,
        receiver_cfdi_use: 'CP01',
        receiver_fiscal_regime: receiver.fiscal_regime,
        receiver_tax_zip_code: receiver.tax_zip_code,
        cobro_id: cobro.id
      }).select('id').single();

      if (cfdiErr) throw new Error("Error creando registro CFDI: " + cfdiErr.message);

      // 2. Invocar Facturama edge function
      const dateStr = new Date(cobro.fecha || Date.now()).toISOString().split('.')[0]; // YYYY-MM-DDTHH:mm:ss
      
      const payload = {
        action: "timbrar_pago",
        cfdi_id: cfdi.id,
        cobro_id: cobro.id,
        empresa_id: empresa.id,
        serie: "P",
        expedition_place: empresa.cp || "00000",
        name_id: "1",
        receiver: {
          name: receiver.name,
          rfc: receiver.rfc,
          fiscal_regime: receiver.fiscal_regime,
          tax_zip_code: receiver.tax_zip_code,
        },
        complemento: {
          Payments: [
            {
              Date: dateStr,
              PaymentForm: paymentForm,
              Amount: cobro.monto || 0,
              RelatedDocuments: relatedDocs.map(d => ({
                Uuid: d.Uuid,
                Currency: d.Currency,
                PaymentMethod: d.PaymentMethod,
                InstallmentNumber: d.InstallmentNumber,
                PreviousBalanceAmount: d.PreviousBalanceAmount,
                AmountPaid: d.AmountPaid,
                OutstandingBalanceAmount: d.OutstandingBalanceAmount,
                TaxObject: "01"
              }))
            }
          ]
        }
      };

      const res = await supabase.functions.invoke('facturama', { body: payload });
      if (res.error) throw new Error(extractEdgeFunctionError(res.error));
      
      return res.data;
    },
    onSuccess: () => {
      toast.success('¡Complemento de Pago timbrado con éxito!');
      queryClient.invalidateQueries({ queryKey: ['cobro-detalle'] });
      queryClient.invalidateQueries({ queryKey: ['cobros'] });
      queryClient.invalidateQueries({ queryKey: ['cfdis'] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al timbrar el pago');
    },
    onSettled: () => setTimbrating(false),
  });

  const handleTimbrar = () => {
    setTimbrating(true);
    timbrarMutation.mutate();
  };

  const isReady = !!cobro && !!relatedDocs;
  const noDocs = relatedDocs?.length === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !timbrating && onOpenChange(v)}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="w-5 h-5 text-green-600" />
            Timbrar Complemento de Pago (REP)
          </DialogTitle>
          <DialogDescription>
            El Complemento de Pago notifica al SAT que se recibió el abono de una o más facturas a crédito.
          </DialogDescription>
        </DialogHeader>

        {!isReady ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : noDocs ? (
          <div className="p-8 text-center text-muted-foreground">
            Este pago no está asociado a ninguna factura PPD timbrada previamente.
            Solo se puede generar un REP si las facturas originales ya están timbradas ante el SAT.
          </div>
        ) : (
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              
              <div className="bg-muted/30 p-4 rounded-lg border grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Fecha del Pago</Label>
                  <p className="font-medium">{fmtDate(cobro.fecha || '')}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Monto Total</Label>
                  <p className="font-medium text-green-600">{fmtC(cobro.monto || 0)}</p>
                </div>
              </div>

              {/* Fiscal form */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Receptor (RFC)</Label>
                  <Input value={receiver.rfc} onChange={e => setReceiver(r => ({...r, rfc: e.target.value.toUpperCase()}))} placeholder="RFC" />
                </div>
                <div className="space-y-1">
                  <Label>Razón Social</Label>
                  <Input value={receiver.name} onChange={e => setReceiver(r => ({...r, name: e.target.value.toUpperCase()}))} placeholder="Razón Social" />
                </div>
                <div className="space-y-1">
                  <Label>Código Postal (Fiscal)</Label>
                  <Input value={receiver.tax_zip_code} onChange={e => setReceiver(r => ({...r, tax_zip_code: e.target.value}))} placeholder="C.P." />
                </div>
                <div className="space-y-1">
                  <Label>Régimen Fiscal</Label>
                  <SearchableSelect
                    options={regimenesList?.map(u => ({ label: `${u.clave} - ${u.descripcion}`, value: u.clave })) || []}
                    value={receiver.fiscal_regime}
                    onChange={(v) => setReceiver(r => ({...r, fiscal_regime: v}))}
                    placeholder="Seleccionar..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>Forma de Pago</Label>
                  <SearchableSelect
                    options={formasPago?.map(u => ({ label: `${u.clave} - ${u.descripcion}`, value: u.clave })) || []}
                    value={paymentForm}
                    onChange={setPaymentForm}
                    placeholder="01, 03..."
                  />
                </div>
              </div>

              {/* Related Docs */}
              <div>
                <Label className="mb-2 block font-semibold text-sm">Facturas Relacionadas (Doctos Relacionados)</Label>
                <div className="border rounded-lg overflow-hidden divide-y">
                  {relatedDocs.map((d, i) => (
                    <div key={i} className="p-3 text-sm grid grid-cols-3 gap-2 bg-background">
                      <div className="col-span-3 font-medium flex justify-between">
                        <span>Folio Venta: {d.folio_venta}</span>
                        <Badge variant="outline">UUID: {d.Uuid.slice(0,8)}...</Badge>
                      </div>
                      <div className="col-span-1 text-muted-foreground flex flex-col text-xs">
                        <span>Parcialidad: <b>{d.InstallmentNumber}</b></span>
                        <span>Saldo Ant: <b>{fmtC(d.PreviousBalanceAmount)}</b></span>
                      </div>
                      <div className="col-span-1 text-muted-foreground flex flex-col text-xs">
                        <span>Imp Pagado: <b>{fmtC(d.AmountPaid)}</b></span>
                        <span>Saldo Insoluto: <b>{fmtC(d.OutstandingBalanceAmount)}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </ScrollArea>
        )}

        <div className="p-4 border-t flex justify-end gap-3 bg-muted/20 mt-auto">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={timbrating}>Cancelar</Button>
          <Button onClick={handleTimbrar} disabled={timbrating || !isReady || noDocs} className="gap-2">
            {timbrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
            Timbrar Complemento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
