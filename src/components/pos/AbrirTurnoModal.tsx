import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCajaTurno } from '@/hooks/useCajaTurno';
import { toast } from 'sonner';
import { LockOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermisos } from '@/hooks/usePermisos';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AbrirTurnoModal({ open, onOpenChange }: Props) {
  const { abrirTurno } = useCajaTurno();
  const { empresa } = useAuth();
  const [cajaNombre, setCajaNombre] = useState('');
  const [fondo, setFondo] = useState('');
  const [notas, setNotas] = useState('');
  const [busy, setBusy] = useState(false);
  const { hasModulo } = usePermisos();
  const navigate = useNavigate();
  const canManageCajas = hasModulo('catalogo.cajas');

  const { data: cajas, isLoading: loadingCajas } = useQuery({
    queryKey: ['cajas-activas', empresa?.id],
    enabled: !!empresa?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cajas')
        .select('*')
        .eq('empresa_id', empresa!.id)
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (open && cajas && cajas.length > 0) {
      const exists = cajas.some(c => c.nombre === cajaNombre);
      if (!exists) {
        setCajaNombre(cajas[0].nombre);
      }
    } else if (!open) {
      setCajaNombre('');
    }
  }, [open, cajas]);

  const handleSubmit = async () => {
    const monto = parseFloat(fondo) || 0;
    if (monto < 0) { toast.error('El fondo no puede ser negativo'); return; }
    if (!cajaNombre.trim()) { toast.error('Debe seleccionar una caja'); return; }
    setBusy(true);
    try {
      await abrirTurno.mutateAsync({ caja_nombre: cajaNombre.trim(), fondo_inicial: monto, notas: notas.trim() || undefined });
      toast.success('Turno abierto');
      onOpenChange(false);
      setFondo(''); setNotas('');
    } catch (e: any) {
      toast.error(e.message || 'Error al abrir turno');
    } finally {
      setBusy(false);
    }
  };

  const hasNoCajas = !loadingCajas && (!cajas || cajas.length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockOpen className="h-5 w-5 text-primary" /> Abrir turno de caja
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {hasNoCajas ? (
            <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
              <div className="rounded-full bg-destructive/10 p-3">
                <LockOpen className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground">No hay cajas registradas</h3>
                <p className="text-sm text-muted-foreground mt-1 px-4">
                  Para poder abrir un turno, primero necesitas registrar una caja en el catálogo.
                </p>
              </div>
              {canManageCajas && (
                <Button 
                  className="mt-2"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/catalogos/cajas');
                  }}
                >
                  Ir a crear caja
                </Button>
              )}
            </div>
          ) : (
            <>
              <div>
                <Label>Nombre de caja</Label>
                {loadingCajas ? (
                  <div className="text-xs text-muted-foreground animate-pulse py-2">
                    Cargando cajas...
                  </div>
                ) : (
                  <Select value={cajaNombre} onValueChange={setCajaNombre}>
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder="Selecciona una caja..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cajas?.map((c) => (
                        <SelectItem key={c.id} value={c.nombre}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>Fondo inicial (efectivo en caja)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={fondo}
                  onChange={(e) => setFondo(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div>
                <Label>Notas (opcional)</Label>
                <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {hasNoCajas ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!hasNoCajas && (
            <Button onClick={handleSubmit} disabled={busy || !cajaNombre}>
              {busy ? 'Abriendo…' : 'Abrir turno'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

