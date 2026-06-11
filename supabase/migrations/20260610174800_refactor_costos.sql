-- 1) Eliminar columna costo_manual si existe
ALTER TABLE public.productos
  DROP COLUMN IF EXISTS costo_manual;

-- 2) Recrear función de recálculo de costo con soporte para promedio móvil
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
        
        -- Calcular el stock anterior a esta recepción
        v_stock_previo := v_stock_actual - v_piezas_compra;
        IF v_stock_previo < 0 THEN
          v_stock_previo := 0;
        END IF;
        
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
    -- Último costo de cualquier compra recibida o pagada
    SELECT cl.precio_unitario INTO v_new_cost
    FROM compra_lineas cl
    JOIN compras c ON c.id = cl.compra_id
    WHERE cl.producto_id = p_producto_id
      AND c.empresa_id = v_empresa_id
      AND c.status IN ('recibida', 'pagada')
    ORDER BY c.fecha DESC, c.created_at DESC
    LIMIT 1;

  ELSIF v_calculo = 'ultimo_compra' THEN
    -- Último costo de compra directa (contado)
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
    -- Último costo del proveedor principal del producto
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

  -- Solo actualizamos si se calculó un costo válido y no es nulo
  IF v_new_cost IS NOT NULL THEN
    UPDATE productos SET costo = ROUND(v_new_cost, 4) WHERE id = p_producto_id;
  END IF;
END;
$$;

-- 3) Actualizar trigger de compras para pasar el NEW.id
CREATE OR REPLACE FUNCTION public.trg_compra_recalc_costos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  -- Solo actúa cuando el estado cambia a recibida o pagada
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('recibida', 'pagada')
      AND (OLD.status IS DISTINCT FROM NEW.status)) THEN
    FOR r IN SELECT DISTINCT producto_id FROM compra_lineas WHERE compra_id = NEW.id
    LOOP
      PERFORM recalc_producto_costo(r.producto_id, NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Recrear el trigger en compras por seguridad
DROP TRIGGER IF EXISTS trg_compra_recalc_costos ON compras;
CREATE TRIGGER trg_compra_recalc_costos
  AFTER UPDATE ON compras
  FOR EACH ROW
  EXECUTE FUNCTION trg_compra_recalc_costos();

-- 4) Crear trigger en productos para recalcular costo al cambiar de método
CREATE OR REPLACE FUNCTION public.trg_producto_recalc_costo_on_method_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo actúa al actualizar y cuando el calculo_costo cambia a un método automático
  IF (TG_OP = 'UPDATE' AND NEW.calculo_costo IS DISTINCT FROM OLD.calculo_costo 
      AND NEW.calculo_costo IS DISTINCT FROM 'manual' AND NEW.calculo_costo IS DISTINCT FROM 'estandar') THEN
    -- Recalcular costo usando el historial
    PERFORM recalc_producto_costo(NEW.id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_producto_recalc_costo_on_method_change ON productos;
CREATE TRIGGER trg_producto_recalc_costo_on_method_change
  AFTER UPDATE OF calculo_costo ON productos
  FOR EACH ROW
  EXECUTE FUNCTION trg_producto_recalc_costo_on_method_change();
