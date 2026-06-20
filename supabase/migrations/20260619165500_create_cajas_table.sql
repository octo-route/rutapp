-- Migración para crear la tabla de cajas (catálogo de cajas registradoras)
CREATE TABLE IF NOT EXISTS public.cajas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.cajas ENABLE ROW LEVEL SECURITY;

-- Política de aislamiento de inquilino (Tenant isolation)
CREATE POLICY "Tenant isolation" ON public.cajas
  FOR ALL USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- Índice por empresa_id para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_cajas_empresa ON public.cajas(empresa_id);
