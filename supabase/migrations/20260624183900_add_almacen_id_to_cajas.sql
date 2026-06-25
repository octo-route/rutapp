-- Migration to add almacen_id to cajas
ALTER TABLE public.cajas
ADD COLUMN almacen_id UUID REFERENCES public.almacenes(id) ON DELETE SET NULL;
