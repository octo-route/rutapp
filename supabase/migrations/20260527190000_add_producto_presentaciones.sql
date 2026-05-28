CREATE TABLE IF NOT EXISTS public.producto_presentaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  factor_base NUMERIC(12,3) NOT NULL CHECK (factor_base > 0),
  precio_especial NUMERIC(12,2) NULL,
  orden INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  es_principal_stock BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_producto_presentaciones_producto
  ON public.producto_presentaciones(producto_id);

CREATE INDEX IF NOT EXISTS idx_producto_presentaciones_empresa
  ON public.producto_presentaciones(empresa_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_producto_presentaciones_principal_unica
  ON public.producto_presentaciones(producto_id)
  WHERE es_principal_stock = true;

ALTER TABLE public.producto_presentaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa puede ver sus presentaciones" ON public.producto_presentaciones;
CREATE POLICY "Empresa puede ver sus presentaciones"
ON public.producto_presentaciones FOR SELECT
USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Empresa puede crear sus presentaciones" ON public.producto_presentaciones;
CREATE POLICY "Empresa puede crear sus presentaciones"
ON public.producto_presentaciones FOR INSERT
WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Empresa puede actualizar sus presentaciones" ON public.producto_presentaciones;
CREATE POLICY "Empresa puede actualizar sus presentaciones"
ON public.producto_presentaciones FOR UPDATE
USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Empresa puede eliminar sus presentaciones" ON public.producto_presentaciones;
CREATE POLICY "Empresa puede eliminar sus presentaciones"
ON public.producto_presentaciones FOR DELETE
USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS trg_producto_presentaciones_updated ON public.producto_presentaciones;
CREATE TRIGGER trg_producto_presentaciones_updated
BEFORE UPDATE ON public.producto_presentaciones
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.venta_lineas
  ADD COLUMN IF NOT EXISTS presentacion_id UUID NULL,
  ADD COLUMN IF NOT EXISTS presentacion_nombre TEXT NULL,
  ADD COLUMN IF NOT EXISTS presentacion_factor NUMERIC(12,3) NULL,
  ADD COLUMN IF NOT EXISTS paquetes NUMERIC(12,3) NULL;

ALTER TABLE public.entrega_lineas
  ADD COLUMN IF NOT EXISTS presentacion_id UUID NULL,
  ADD COLUMN IF NOT EXISTS presentacion_nombre TEXT NULL,
  ADD COLUMN IF NOT EXISTS presentacion_factor NUMERIC(12,3) NULL,
  ADD COLUMN IF NOT EXISTS paquetes NUMERIC(12,3) NULL;
