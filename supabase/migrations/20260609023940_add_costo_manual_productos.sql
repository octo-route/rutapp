-- Agrega columna costo_manual a productos
-- false = el costo se actualiza automáticamente al recibir compras (promedio ponderado)
-- true  = el usuario sobreescribió el costo manualmente; no se actualiza automáticamente

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS costo_manual boolean NOT NULL DEFAULT false;
