-- Migration: Add cobro_id to cfdis to track complementos de pago
ALTER TABLE public.cfdis
ADD COLUMN cobro_id UUID REFERENCES public.cobros(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cfdis.cobro_id IS 'ID del cobro asociado (usado para complementos de pago)';
