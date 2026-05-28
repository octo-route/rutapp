BEGIN;

CREATE TABLE IF NOT EXISTS public.combo_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  combo_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  componente_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  cantidad NUMERIC NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT combo_lineas_cantidad_positiva CHECK (cantidad > 0),
  CONSTRAINT combo_lineas_no_self CHECK (combo_id <> componente_id),
  CONSTRAINT combo_lineas_unique_component UNIQUE (combo_id, componente_id)
);

CREATE INDEX IF NOT EXISTS idx_combo_lineas_empresa_id
  ON public.combo_lineas (empresa_id);

CREATE INDEX IF NOT EXISTS idx_combo_lineas_combo_id
  ON public.combo_lineas (combo_id);

CREATE INDEX IF NOT EXISTS idx_combo_lineas_componente_id
  ON public.combo_lineas (componente_id);

ALTER TABLE public.combo_lineas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation" ON public.combo_lineas;

CREATE POLICY "Tenant isolation" ON public.combo_lineas
  FOR ALL
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'combo_lineas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.combo_lineas;
  END IF;
END
$$;

COMMIT;
