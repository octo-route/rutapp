-- Enum for cotizacion status
CREATE TYPE public.status_cotizacion AS ENUM ('borrador', 'enviada', 'aceptada', 'rechazada', 'vencida');

-- Main cotizaciones table
CREATE TABLE public.cotizaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  folio TEXT,
  status status_cotizacion NOT NULL DEFAULT 'borrador',
  cliente_id UUID REFERENCES public.clientes(id),
  vendedor_id UUID REFERENCES public.profiles(id),
  condicion_pago condicion_pago NOT NULL DEFAULT 'contado',
  tarifa_id UUID REFERENCES public.tarifas(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  notas TEXT,
  subtotal NUMERIC DEFAULT 0,
  descuento_total NUMERIC DEFAULT 0,
  iva_total NUMERIC DEFAULT 0,
  ieps_total NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  venta_id UUID REFERENCES public.ventas(id), -- Link to the converted sale
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Line items
CREATE TABLE public.cotizacion_lineas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotizacion_id UUID NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id),
  descripcion TEXT,
  cantidad NUMERIC NOT NULL DEFAULT 1,
  unidad_id UUID REFERENCES public.unidades(id),
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  descuento_pct NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  iva_pct NUMERIC DEFAULT 0,
  ieps_pct NUMERIC DEFAULT 0,
  iva_monto NUMERIC DEFAULT 0,
  ieps_monto NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.cotizaciones
  FOR ALL USING (empresa_id = get_my_empresa_id())
  WITH CHECK (empresa_id = get_my_empresa_id());

CREATE POLICY "Tenant isolation" ON public.cotizacion_lineas
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.cotizaciones c WHERE c.id = cotizacion_lineas.cotizacion_id AND c.empresa_id = get_my_empresa_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cotizaciones c WHERE c.id = cotizacion_lineas.cotizacion_id AND c.empresa_id = get_my_empresa_id()
  ));

-- Update next_folio to fix 'PED' and support 'COT'
CREATE OR REPLACE FUNCTION public.next_folio(prefix TEXT, p_empresa_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INT;
BEGIN
  -- Get the max numeric suffix for this prefix+empresa
  IF prefix = 'VTA' OR prefix = 'PED' THEN
    SELECT COALESCE(MAX(
      CASE WHEN folio ~ ('^' || prefix || '-[0-9]+$')
        THEN CAST(SUBSTRING(folio FROM LENGTH(prefix) + 2) AS INT)
        ELSE 0
      END
    ), 0) + 1 INTO next_num
    FROM public.ventas
    WHERE empresa_id = p_empresa_id;
  ELSIF prefix = 'COT' THEN
    SELECT COALESCE(MAX(
      CASE WHEN folio ~ ('^' || prefix || '-[0-9]+$')
        THEN CAST(SUBSTRING(folio FROM LENGTH(prefix) + 2) AS INT)
        ELSE 0
      END
    ), 0) + 1 INTO next_num
    FROM public.cotizaciones
    WHERE empresa_id = p_empresa_id;
  ELSIF prefix = 'CLI' THEN
    SELECT COALESCE(MAX(
      CASE WHEN codigo ~ ('^' || prefix || '-[0-9]+$')
        THEN CAST(SUBSTRING(codigo FROM LENGTH(prefix) + 2) AS INT)
        ELSE 0
      END
    ), 0) + 1 INTO next_num
    FROM public.clientes
    WHERE empresa_id = p_empresa_id;
  ELSIF prefix = 'PROD' THEN
    SELECT COALESCE(MAX(
      CASE WHEN codigo ~ ('^' || prefix || '-[0-9]+$')
        THEN CAST(SUBSTRING(codigo FROM LENGTH(prefix) + 2) AS INT)
        ELSE 0
      END
    ), 0) + 1 INTO next_num
    FROM public.productos
    WHERE empresa_id = p_empresa_id;
  ELSE
    next_num := 1;
  END IF;

  RETURN prefix || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

-- Auto-assign folio on cotizaciones insert
CREATE OR REPLACE FUNCTION public.auto_folio_cotizacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.folio IS NULL OR NEW.folio = '' THEN
    NEW.folio := next_folio('COT', NEW.empresa_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_folio_cotizacion
  BEFORE INSERT ON public.cotizaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_folio_cotizacion();
