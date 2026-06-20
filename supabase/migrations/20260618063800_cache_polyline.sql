ALTER TABLE public.cliente_orden_ruta 
ADD COLUMN IF NOT EXISTS polyline text, 
ADD COLUMN IF NOT EXISTS distance_meters integer DEFAULT 0, 
ADD COLUMN IF NOT EXISTS duration text;
