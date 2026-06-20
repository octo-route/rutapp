-- Create a new version of auto_create_empresa_basics that includes the "Vendedor" role
CREATE OR REPLACE FUNCTION public.auto_create_empresa_basics()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_role_id uuid;
  v_vendedor_role_id uuid;
  v_owner_user_id uuid;
  v_tarifa_id uuid;
  v_modulo text;
  v_accion text;
  v_modulos text[] := ARRAY[
    'dashboard','supervisor',
    'ventas','ventas.cobranza','ventas.promociones','pos',
    'clientes',
    'logistica.dashboard','logistica.pedidos','logistica.entregas','logistica.descargas','logistica.monitor','logistica.rutas','logistica.mapa_clientes','logistica.mapa_ventas',
    'catalogo.productos','catalogo.tarifas','catalogo.clasificaciones','catalogo.marcas','catalogo.proveedores','catalogo.unidades','catalogo.tasas_iva','catalogo.tasas_ieps',
    'almacen.inventario','almacen.traspasos','almacen.ajustes','almacen.auditorias','almacen.compras','almacen.lotes','almacen.almacenes',
    'finanzas.por_cobrar','finanzas.por_pagar','finanzas.gastos','finanzas.comisiones',
    'reportes.generales','reportes.entregas',
    'facturacion.cfdi','facturacion.catalogos',
    'configuracion.general','configuracion.usuarios','configuracion.whatsapp','configuracion.suscripcion'
  ];
  v_acciones text[] := ARRAY['ver','crear','editar','eliminar'];
BEGIN
  -- Almacén General
  INSERT INTO public.almacenes (empresa_id, nombre) VALUES (NEW.id, 'Almacén General');
  -- Tarifa General
  INSERT INTO public.tarifas (empresa_id, nombre, tipo, activa) VALUES (NEW.id, 'Tarifa General', 'general', true)
  RETURNING id INTO v_tarifa_id;
  -- Lista de Precios Principal (linked to Tarifa General)
  INSERT INTO public.lista_precios (tarifa_id, empresa_id, nombre, es_principal)
  VALUES (v_tarifa_id, NEW.id, 'Lista General', true);
  -- Unidad básica: Pieza
  INSERT INTO public.unidades (empresa_id, nombre, abreviatura) VALUES (NEW.id, 'Pieza', 'pza');
  -- Lista General (legacy table)
  INSERT INTO public.listas (empresa_id, nombre) VALUES (NEW.id, 'Lista General');
  -- Zona por defecto
  INSERT INTO public.zonas (empresa_id, nombre) VALUES (NEW.id, 'Zona General');

  -- Create Administrador role with all permissions
  INSERT INTO public.roles (empresa_id, nombre, descripcion, es_sistema, acceso_ruta_movil)
  VALUES (NEW.id, 'Administrador', 'Acceso total al sistema', true, true)
  RETURNING id INTO v_admin_role_id;

  FOREACH v_modulo IN ARRAY v_modulos LOOP
    FOREACH v_accion IN ARRAY v_acciones LOOP
      INSERT INTO public.role_permisos (role_id, modulo, accion, permitido)
      VALUES (v_admin_role_id, v_modulo, v_accion, true);
    END LOOP;
  END LOOP;

  -- Create Vendedor role with basic permissions
  INSERT INTO public.roles (empresa_id, nombre, descripcion, es_sistema, acceso_ruta_movil)
  VALUES (NEW.id, 'Vendedor', 'Acceso básico para ventas', true, true)
  RETURNING id INTO v_vendedor_role_id;

  -- Basic permissions for Vendedor
  INSERT INTO public.role_permisos (role_id, modulo, accion, permitido) VALUES
  (v_vendedor_role_id, 'ventas', 'ver', true),
  (v_vendedor_role_id, 'ventas', 'crear', true),
  (v_vendedor_role_id, 'pos', 'ver', true),
  (v_vendedor_role_id, 'pos', 'crear', true),
  (v_vendedor_role_id, 'clientes', 'ver', true),
  (v_vendedor_role_id, 'clientes', 'crear', true),
  (v_vendedor_role_id, 'catalogo.productos', 'ver', true),
  (v_vendedor_role_id, 'logistica.rutas', 'ver', true),
  (v_vendedor_role_id, 'dashboard', 'ver', true);

  SELECT user_id INTO v_owner_user_id
  FROM public.profiles WHERE empresa_id = NEW.id LIMIT 1;

  IF v_owner_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_owner_user_id, v_admin_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Also retroactively add the 'Vendedor' role to existing companies that don't have it
DO $$
DECLARE
  emp RECORD;
  v_vendedor_role_id uuid;
BEGIN
  FOR emp IN SELECT id FROM public.empresas LOOP
    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE empresa_id = emp.id AND nombre = 'Vendedor') THEN
      INSERT INTO public.roles (empresa_id, nombre, descripcion, es_sistema, acceso_ruta_movil)
      VALUES (emp.id, 'Vendedor', 'Acceso básico para ventas', true, true)
      RETURNING id INTO v_vendedor_role_id;

      INSERT INTO public.role_permisos (role_id, modulo, accion, permitido) VALUES
      (v_vendedor_role_id, 'ventas', 'ver', true),
      (v_vendedor_role_id, 'ventas', 'crear', true),
      (v_vendedor_role_id, 'pos', 'ver', true),
      (v_vendedor_role_id, 'pos', 'crear', true),
      (v_vendedor_role_id, 'clientes', 'ver', true),
      (v_vendedor_role_id, 'clientes', 'crear', true),
      (v_vendedor_role_id, 'catalogo.productos', 'ver', true),
      (v_vendedor_role_id, 'logistica.rutas', 'ver', true),
      (v_vendedor_role_id, 'dashboard', 'ver', true);
    END IF;
  END LOOP;
END;
$$;
