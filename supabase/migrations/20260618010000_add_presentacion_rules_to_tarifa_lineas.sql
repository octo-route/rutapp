-- Add 'presentacion' to applies to enum (aplica_a_tarifa)
ALTER TYPE public.aplica_a_tarifa ADD VALUE IF NOT EXISTS 'presentacion';

-- Add presentacion_ids column to public.tarifa_lineas
ALTER TABLE public.tarifa_lineas
  ADD COLUMN IF NOT EXISTS presentacion_ids uuid[] NOT NULL DEFAULT '{}';

-- Create GIN index for presentacion_ids array search performance
CREATE INDEX IF NOT EXISTS idx_tarifa_lineas_presentaciones
  ON public.tarifa_lineas USING gin (presentacion_ids);
