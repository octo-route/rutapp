CREATE OR REPLACE FUNCTION public.borrar_todo_empresa(p_empresa_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
  v_user_ids UUID[];
BEGIN
  -- Verificar que el usuario que ejecuta sea el dueño de la empresa
  SELECT owner_user_id INTO v_owner_id FROM public.empresas WHERE id = p_empresa_id;
  
  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'No autorizado. Solo el dueño de la empresa puede borrar todo.';
  END IF;

  -- Auditorías y Conteos
  BEGIN DELETE FROM auditoria_escaneos WHERE auditoria_id IN (SELECT id FROM auditorias WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM auditoria_entradas WHERE auditoria_linea_id IN (SELECT id FROM auditoria_lineas WHERE auditoria_id IN (SELECT id FROM auditorias WHERE empresa_id = p_empresa_id)); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM auditoria_lineas WHERE auditoria_id IN (SELECT id FROM auditorias WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM auditorias WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  BEGIN DELETE FROM conteo_entradas WHERE conteo_linea_id IN (SELECT id FROM conteo_lineas WHERE conteo_id IN (SELECT id FROM conteos_fisicos WHERE empresa_id = p_empresa_id)); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM conteo_lineas WHERE conteo_id IN (SELECT id FROM conteos_fisicos WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM conteos_fisicos WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  -- Facturación y Entregas
  BEGIN DELETE FROM cfdi_lineas WHERE cfdi_id IN (SELECT id FROM cfdis WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM cfdis WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  BEGIN DELETE FROM entrega_lineas WHERE entrega_id IN (SELECT id FROM entregas WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM entregas WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  BEGIN DELETE FROM descarga_ruta_lineas WHERE descarga_id IN (SELECT id FROM descarga_ruta WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM descarga_ruta WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  -- Ventas, Cobros, Cargas
  BEGIN DELETE FROM cobro_aplicaciones WHERE cobro_id IN (SELECT id FROM cobros WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM cobros WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  BEGIN DELETE FROM venta_lineas WHERE venta_id IN (SELECT id FROM ventas WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM carga_pedidos WHERE carga_id IN (SELECT id FROM cargas WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM ventas WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  BEGIN DELETE FROM devolucion_lineas WHERE devolucion_id IN (SELECT id FROM devoluciones WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM devoluciones WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  BEGIN DELETE FROM carga_lineas WHERE carga_id IN (SELECT id FROM cargas WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM cargas WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  BEGIN DELETE FROM compra_lineas WHERE compra_id IN (SELECT id FROM compras WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM compras WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  BEGIN DELETE FROM traspaso_lineas WHERE traspaso_id IN (SELECT id FROM traspasos WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM traspasos WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  BEGIN DELETE FROM factura_lineas WHERE factura_id IN (SELECT id FROM facturas WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM facturas WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  -- Productos y Presentaciones/Combos
  BEGIN DELETE FROM combo_lineas WHERE combo_id IN (SELECT id FROM productos WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM producto_presentaciones WHERE producto_id IN (SELECT id FROM productos WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;

  -- Inventarios
  BEGIN DELETE FROM movimientos_inventario WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM stock_almacen WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM ajustes_inventario WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  -- Clientes y Visitas
  BEGIN DELETE FROM cliente_pedido_sugerido WHERE cliente_id IN (SELECT id FROM clientes WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM visitas WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM clientes WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  -- Productos
  BEGIN DELETE FROM producto_proveedores WHERE producto_id IN (SELECT id FROM productos WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM productos WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  -- Catálogos Base
  BEGIN DELETE FROM proveedores WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM clasificaciones WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM marcas WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM unidades WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM tasas_iva WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM tasas_ieps WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  
  BEGIN DELETE FROM tarifa_lineas WHERE tarifa_id IN (SELECT id FROM tarifas WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM tarifas WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  
  BEGIN DELETE FROM lista_precios_lineas WHERE lista_precio_id IN (SELECT id FROM lista_precios WHERE empresa_id = p_empresa_id); EXCEPTION WHEN OTHERS THEN END;
  
  BEGIN DELETE FROM lista_precios WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM zonas WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM cobradores WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM vendedores WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM almacenes WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM promociones WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  -- Caja y Facturación
  BEGIN DELETE FROM caja_movimientos WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM caja_turnos WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM emisor_fiscal WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  -- Optimizacion de rutas
  BEGIN DELETE FROM optimizacion_rutas_log WHERE empresa_id = p_empresa_id; EXCEPTION WHEN OTHERS THEN END;

  -- Usuarios secundarios de la empresa
  BEGIN DELETE FROM role_permisos WHERE role_id IN (SELECT id FROM roles WHERE empresa_id = p_empresa_id AND id NOT IN (SELECT role_id FROM user_roles WHERE user_id = v_owner_id)); EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE empresa_id = p_empresa_id) AND user_id != v_owner_id; EXCEPTION WHEN OTHERS THEN END;
  BEGIN DELETE FROM roles WHERE empresa_id = p_empresa_id AND id NOT IN (SELECT role_id FROM user_roles WHERE user_id = v_owner_id); EXCEPTION WHEN OTHERS THEN END;

  SELECT array_agg(user_id) INTO v_user_ids FROM profiles WHERE empresa_id = p_empresa_id AND user_id != v_owner_id;
  
  BEGIN DELETE FROM profiles WHERE empresa_id = p_empresa_id AND user_id != v_owner_id; EXCEPTION WHEN OTHERS THEN END;
  
  IF cardinality(v_user_ids) > 0 THEN
    BEGIN DELETE FROM auth.users WHERE id = ANY(v_user_ids); EXCEPTION WHEN OTHERS THEN END;
  END IF;

  -- Resetear datos de la empresa (manteniendo el registro)
  BEGIN 
    UPDATE empresas SET 
      direccion = NULL, colonia = NULL, ciudad = NULL, estado = NULL, cp = NULL, 
      telefono = NULL, email = NULL, rfc = NULL, logo_url = NULL, razon_social = NULL,
      regimen_fiscal = NULL, notas_ticket = NULL 
    WHERE id = p_empresa_id;
  EXCEPTION WHEN OTHERS THEN END;

END $$;
