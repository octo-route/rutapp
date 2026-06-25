-- Añadir columnas de presentaciones a venta_lineas
ALTER TABLE public.venta_lineas
  ADD COLUMN IF NOT EXISTS presentacion_id UUID NULL REFERENCES public.producto_presentaciones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS presentacion_nombre TEXT NULL,
  ADD COLUMN IF NOT EXISTS presentacion_factor NUMERIC(12,3) NULL,
  ADD COLUMN IF NOT EXISTS paquetes NUMERIC(12,3) NULL;
