-- Add vende_por_presentaciones to productos
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS vende_por_presentaciones BOOLEAN NOT NULL DEFAULT false;

-- Add codigo_barras to producto_presentaciones
ALTER TABLE public.producto_presentaciones
  ADD COLUMN IF NOT EXISTS codigo_barras TEXT NULL;

-- Create index for faster scanning in POS
CREATE INDEX IF NOT EXISTS idx_producto_presentaciones_codigo_barras
  ON public.producto_presentaciones(codigo_barras)
  WHERE codigo_barras IS NOT NULL;
