BEGIN;

-- 1) Corregir políticas RLS para combo_lineas agregando soporte a super_admins
DROP POLICY IF EXISTS "Tenant isolation" ON public.combo_lineas;
CREATE POLICY "Tenant isolation" ON public.combo_lineas
  FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (empresa_id = public.get_my_empresa_id() OR public.is_super_admin(auth.uid()));

-- 2) Corregir políticas RLS para producto_presentaciones agregando soporte a super_admins
DROP POLICY IF EXISTS "Empresa puede ver sus presentaciones" ON public.producto_presentaciones;
CREATE POLICY "Empresa puede ver sus presentaciones" ON public.producto_presentaciones
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Empresa puede crear sus presentaciones" ON public.producto_presentaciones;
CREATE POLICY "Empresa puede crear sus presentaciones" ON public.producto_presentaciones
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_my_empresa_id() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Empresa puede actualizar sus presentaciones" ON public.producto_presentaciones;
CREATE POLICY "Empresa puede actualizar sus presentaciones" ON public.producto_presentaciones
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (empresa_id = public.get_my_empresa_id() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Empresa puede eliminar sus presentaciones" ON public.producto_presentaciones;
CREATE POLICY "Empresa puede eliminar sus presentaciones" ON public.producto_presentaciones
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR public.is_super_admin(auth.uid()));

COMMIT;
