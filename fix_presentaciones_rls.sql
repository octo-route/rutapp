DROP POLICY IF EXISTS "Empresa puede ver sus presentaciones" ON public.producto_presentaciones;
DROP POLICY IF EXISTS "Empresa puede crear sus presentaciones" ON public.producto_presentaciones;
DROP POLICY IF EXISTS "Empresa puede actualizar sus presentaciones" ON public.producto_presentaciones;
DROP POLICY IF EXISTS "Empresa puede eliminar sus presentaciones" ON public.producto_presentaciones;

CREATE POLICY "Empresa puede ver sus presentaciones"
ON public.producto_presentaciones
FOR SELECT
USING (
  empresa_id IN (
    SELECT empresa_id
    FROM public.profiles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Empresa puede crear sus presentaciones"
ON public.producto_presentaciones
FOR INSERT
WITH CHECK (
  empresa_id IN (
    SELECT empresa_id
    FROM public.profiles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Empresa puede actualizar sus presentaciones"
ON public.producto_presentaciones
FOR UPDATE
USING (
  empresa_id IN (
    SELECT empresa_id
    FROM public.profiles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Empresa puede eliminar sus presentaciones"
ON public.producto_presentaciones
FOR DELETE
USING (
  empresa_id IN (
    SELECT empresa_id
    FROM public.profiles
    WHERE user_id = auth.uid()
  )
);