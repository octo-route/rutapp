-- Add costos_adicionales to productos table
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS costos_adicionales JSONB DEFAULT '[]'::jsonb;
