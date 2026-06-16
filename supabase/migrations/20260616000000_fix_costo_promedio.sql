-- Corrige el cálculo del costo promedio móvil
CREATE OR REPLACE FUNCTION public.recalc_producto_costo(
  p_producto_id uuid,
  p_compra_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calculo calculo_costo;
  v_new_cost numeric;
  v_empresa_id uuid;
  v_proveedor_id uuid;
  
  -- Para promedio móvil
  v_costo_actual numeric;
  v_stock_actual numeric;
  v_piezas_compra numeric;
  v_precio_unitario numeric;
  v_factor numeric;
  v_stock_previo numeric;
BEGIN
  SELECT calculo_costo, empresa_id, costo, cantidad, factor_conversion
    INTO v_calculo, v_empresa_id, v_costo_actual, v_stock_actual, v_factor
    FROM productos WHERE id = p_producto_id;

  IF v_calculo IS NULL OR v_calculo = 'manual' OR v_calculo = 'estandar' THEN
    RETURN; -- No calcular automáticamente en manual o estándar
  END IF;

  IF v_calculo = 'promedio' THEN
    IF p_compra_id IS NOT NULL THEN
      -- Obtener la cantidad de piezas y el promedio de precio unitario en la compra actual
      SELECT SUM(cl.cantidad * COALESCE(v_factor, 1)), AVG(cl.precio_unitario)
        INTO v_piezas_compra, v_precio_unitario
        FROM compra_lineas cl
        WHERE cl.compra_id = p_compra_id AND cl.producto_id = p_producto_id;

      IF v_piezas_compra IS NOT NULL AND v_piezas_compra > 0 AND v_precio_unitario IS NOT NULL THEN
        v_costo_actual := COALESCE(v_costo_actual, 0);
        v_stock_actual := COALESCE(v_stock_actual, 0);
        
        -- ERROR CORREGIDO:
        -- El stock_actual en este punto (trigger disparado al marcar 'recibida')
        -- NO incluye aún las piezas compradas (se procesan después por el cliente).
        -- Por lo tanto, el stock previo es directamente v_stock_actual.
        v_stock_previo := v_stock_actual;
        
        IF (v_stock_previo + v_piezas_compra) > 0 THEN
          v_new_cost := ((v_costo_actual * v_stock_previo) + (v_precio_unitario * v_piezas_compra)) / (v_stock_previo + v_piezas_compra);
        ELSE
          v_new_cost := v_precio_unitario;
        END IF;
      END IF;
    ELSE
      -- Si no hay compra_id (ej. cambio de método en el dropdown),
      -- calculamos el promedio ponderado histórico como fallback
      SELECT SUM(cl.precio_unitario * cl.cantidad * COALESCE(v_factor, 1)) / NULLIF(SUM(cl.cantidad * COALESCE(v_factor, 1)), 0)
        INTO v_new_cost
      FROM compra_lineas cl
      JOIN compras c ON c.id = cl.compra_id
      WHERE cl.producto_id = p_producto_id
        AND c.empresa_id = v_empresa_id
        AND c.status IN ('recibida', 'pagada');
    END IF;

  ELSIF v_calculo = 'ultimo' THEN
    SELECT cl.precio_unitario INTO v_new_cost
    FROM compra_lineas cl
    JOIN compras c ON c.id = cl.compra_id
    WHERE cl.producto_id = p_producto_id
      AND c.empresa_id = v_empresa_id
      AND c.status IN ('recibida', 'pagada')
    ORDER BY c.fecha DESC, c.created_at DESC
    LIMIT 1;

  ELSIF v_calculo = 'ultimo_compra' THEN
    SELECT cl.precio_unitario INTO v_new_cost
    FROM compra_lineas cl
    JOIN compras c ON c.id = cl.compra_id
    WHERE cl.producto_id = p_producto_id
      AND c.empresa_id = v_empresa_id
      AND c.status IN ('recibida', 'pagada')
      AND c.condicion_pago = 'contado'
    ORDER BY c.fecha DESC, c.created_at DESC
    LIMIT 1;

  ELSIF v_calculo = 'ultimo_proveedor' THEN
    SELECT pp.proveedor_id INTO v_proveedor_id
    FROM producto_proveedores pp
    WHERE pp.producto_id = p_producto_id
      AND pp.es_principal = true
    LIMIT 1;

    IF v_proveedor_id IS NOT NULL THEN
      SELECT cl.precio_unitario INTO v_new_cost
      FROM compra_lineas cl
      JOIN compras c ON c.id = cl.compra_id
      WHERE cl.producto_id = p_producto_id
        AND c.empresa_id = v_empresa_id
        AND c.proveedor_id = v_proveedor_id
        AND c.status IN ('recibida', 'pagada')
      ORDER BY c.fecha DESC, c.created_at DESC
      LIMIT 1;
    END IF;
  END IF;

  IF v_new_cost IS NOT NULL THEN
    UPDATE productos SET costo = ROUND(v_new_cost, 4) WHERE id = p_producto_id;
  END IF;
END;
$$;

-- ERROR CORREGIDO:
-- El trigger original se ejecutaba tanto al pasar a 'recibida' como a 'pagada'.
-- Si se ejecutaba al pasar a 'pagada', volvía a promediar la compra duplicando el peso en el costo.
-- Ahora solo se ejecuta al pasar de 'confirmada' a 'recibida' (o de 'borrador' a 'recibida' en compras viejas o creadas por sistema).
CREATE OR REPLACE FUNCTION public.trg_compra_recalc_costos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status = 'recibida' AND OLD.status IS DISTINCT FROM 'recibida') THEN
    FOR r IN SELECT DISTINCT producto_id FROM compra_lineas WHERE compra_id = NEW.id
    LOOP
      PERFORM recalc_producto_costo(r.producto_id, NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
