-- Fix the foreign key for vendedor_id in cotizaciones
-- It was originally pointing to the deprecated public.vendedores table
-- Now it should point to public.profiles

ALTER TABLE public.cotizaciones
  DROP CONSTRAINT IF EXISTS cotizaciones_vendedor_id_fkey;

ALTER TABLE public.cotizaciones
  ADD CONSTRAINT cotizaciones_vendedor_id_fkey
  FOREIGN KEY (vendedor_id) REFERENCES public.profiles(id);
