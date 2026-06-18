-- Add unidad_id to producto_presentaciones
ALTER TABLE public.producto_presentaciones
  ADD COLUMN IF NOT EXISTS unidad_id UUID NULL REFERENCES public.unidades(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_producto_presentaciones_unidad_id
  ON public.producto_presentaciones(unidad_id);
