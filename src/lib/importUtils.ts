/**
 * Mass import utilities for Products & Clients
 * - Parses Excel (.xlsx) and CSV files
 * - Auto-creates missing catalog entries (marcas, zonas, etc.)
 * - Upserts by codigo (updates if exists, inserts if not)
 * - Multi-tenant: all records scoped to empresa_id
 */
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { todayLocal } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────
export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export interface ImportColumn {
  key: string;
  header: string;
  required?: boolean;
  example?: string;
}

// ─── Product template columns ───────────────────────────────────
export const PRODUCT_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'codigo', header: 'Código', required: true, example: 'PROD-0001' },
  { key: 'nombre', header: 'Nombre', required: true, example: 'Refresco Cola 600ml' },
  { key: 'precio_principal', header: 'Precio', example: '18.50' },
  { key: 'costo', header: 'Costo', example: '12.00' },
  { key: 'cantidad', header: 'Stock', example: '100' },
  { key: 'marca', header: 'Marca', example: 'Coca-Cola' },
  { key: 'clasificacion', header: 'Clasificación', example: 'Bebidas' },
  { key: 'proveedor', header: 'Proveedor', example: 'Distribuidora ABC' },
  { key: 'lista', header: 'Lista', example: 'Lista General' },
  { key: 'unidad_venta', header: 'Unidad Venta', example: 'Pieza' },
  { key: 'unidad_compra', header: 'Unidad Compra', example: 'Caja' },
  { key: 'clave_alterna', header: 'Clave Alterna', example: 'RC600' },
  { key: 'tiene_iva', header: 'Tiene IVA (Sí/No)', example: 'Sí' },
  { key: 'iva_pct', header: 'IVA %', example: '16' },
  { key: 'ieps_pct', header: 'IEPS % o Cuota', example: '8' },
  { key: 'ieps_tipo', header: 'Tipo IEPS (Porcentaje/Cuota)', example: 'porcentaje' },
  { key: 'costo_incluye_impuestos', header: 'Costo Incluye Impuestos (Sí/No)', example: 'No' },
  { key: 'min', header: 'Stock Mínimo', example: '10' },
  { key: 'max', header: 'Stock Máximo', example: '500' },
  { key: 'es_granel', header: 'Es Granel (Sí/No)', example: 'No' },
  { key: 'unidad_granel', header: 'Unidad Granel', example: 'kg' },
  { key: 'nombre_compra', header: 'Nombre Compra', example: 'Refresco Cola 600ml Pack' },
  { key: 'nombre_venta', header: 'Nombre Venta', example: 'Refresco Cola 600ml Frío' },
  { key: 'nombre_ticket', header: 'Nombre Ticket', example: 'Refresco Cola' },
  { key: 'factor_conversion', header: 'Factor Conversión', example: '1' },
  { key: 'precio_sugerido_publico', header: 'Precio Sugerido Público', example: '20.00' },
  { key: 'codigo_sat', header: 'Código SAT', example: '50202306' },
  { key: 'unidad_sat', header: 'Unidad SAT', example: 'H87' },
  { key: 'status', header: 'Estado', example: 'activo' },
];

// ─── Client template columns ───────────────────────────────────
export const CLIENT_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'codigo', header: 'Código', example: 'CLI-0001' },
  { key: 'nombre', header: 'Nombre', required: true, example: 'Tienda Don Pedro' },
  { key: 'contacto', header: 'Contacto', example: 'Pedro García' },
  { key: 'telefono', header: 'Teléfono', example: '55 1234 5678' },
  { key: 'email', header: 'Email', example: 'pedro@correo.com' },
  { key: 'direccion', header: 'Dirección', example: 'Av. Reforma 100' },
  { key: 'colonia', header: 'Colonia', example: 'Centro' },
  { key: 'rfc', header: 'RFC', example: 'GAPE800101XXX' },
  { key: 'regimen_fiscal', header: 'Régimen Fiscal', example: '601 - General de Ley Personas Morales' },
  { key: 'cp', header: 'Código Postal', example: '01000' },
  { key: 'uso_cfdi', header: 'Uso CFDI', example: 'G03 - Gastos en general' },
  { key: 'zona', header: 'Zona', example: 'Zona Norte' },
  { key: 'vendedor', header: 'Vendedor', example: 'Juan Pérez' },
  { key: 'cobrador', header: 'Cobrador', example: 'María López' },
  { key: 'lista', header: 'Lista', example: 'Lista General' },
  { key: 'credito', header: 'Crédito (Sí/No)', example: 'No' },
  { key: 'limite_credito', header: 'Límite Crédito', example: '5000' },
  { key: 'dias_credito', header: 'Días Crédito', example: '30' },
  { key: 'frecuencia', header: 'Frecuencia', example: 'semanal' },
  { key: 'status', header: 'Estado', example: 'activo' },
  { key: 'gps_lat', header: 'Latitud', example: '19.432608' },
  { key: 'gps_lng', header: 'Longitud', example: '-99.133209' },
];

// ─── Template generation ────────────────────────────────────────
export function downloadTemplate(columns: ImportColumn[], fileName: string) {
  const wb = XLSX.utils.book_new();
  // Header row + example row
  const headers = columns.map(c => c.header);
  const example = columns.map(c => c.example ?? '');
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = columns.map(c => ({ wch: Math.max((c.header?.length ?? 10) + 4, (c.example?.length ?? 8) + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

// ─── File parsing ───────────────────────────────────────────────
export async function parseFile(file: File): Promise<Record<string, any>[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (ext === 'csv') {
    const text = new TextDecoder('utf-8').decode(buffer);
    const wb = XLSX.read(text, { type: 'string' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws);
  }

  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws);
}

// ─── Catalog resolver (find or create) ──────────────────────────
type CatalogTable = 'marcas' | 'clasificaciones' | 'proveedores' | 'listas' | 'unidades' | 'zonas' | 'vendedores' | 'cobradores';

async function resolveOrCreate(
  table: CatalogTable,
  nombre: string | number | undefined | null,
  empresaId: string,
  cache: Map<string, Map<string, string>>,
): Promise<string | null> {
  if (nombre == null) return null;
  const nombreStr = String(nombre).trim();
  if (!nombreStr) return null;
  const key = nombreStr.toLowerCase();

  // Check cache
  if (!cache.has(table)) cache.set(table, new Map());
  const tableCache = cache.get(table)!;
  if (tableCache.has(key)) return tableCache.get(key)!;

  // Check DB
  const { data: existing } = await (supabase.from(table) as any)
    .select('id, nombre')
    .eq('empresa_id', empresaId)
    .ilike('nombre', nombreStr);

  if (existing && existing.length > 0) {
    tableCache.set(key, existing[0].id);
    return existing[0].id;
  }

  // Create
  const { data: created, error } = await (supabase.from(table) as any)
    .insert({ nombre: nombreStr, empresa_id: empresaId })
    .select('id')
    .single();

  if (error) throw new Error(`No se pudo crear ${table}: ${nombreStr} - ${error.message}`);
  tableCache.set(key, created.id);
  return created.id;
}

// ─── Resolve SAT Unit ───────────────────────────────────────────
async function resolveUnidadSat(
  value: string | number | undefined | null,
  cache: Map<string, string>
): Promise<string | null> {
  if (value == null) return null;
  const valStr = String(value).trim();
  if (!valStr) return null;
  const key = valStr.toLowerCase();

  if (cache.has(key)) return cache.get(key)!;

  // Try parsing "H87 - Pieza" or similar, extract the first token
  const firstToken = valStr.split('-')[0].trim();

  // Try searching by clave (e.g. H87)
  const { data: byClave } = await supabase
    .from('unidades_sat')
    .select('id')
    .eq('clave', firstToken)
    .maybeSingle();

  if (byClave) {
    cache.set(key, byClave.id);
    return byClave.id;
  }

  const { data: byClaveFull } = await supabase
    .from('unidades_sat')
    .select('id')
    .eq('clave', valStr)
    .maybeSingle();

  if (byClaveFull) {
    cache.set(key, byClaveFull.id);
    return byClaveFull.id;
  }

  const { data: byNombre } = await supabase
    .from('unidades_sat')
    .select('id')
    .ilike('nombre', valStr)
    .limit(1);

  if (byNombre && byNombre.length > 0) {
    cache.set(key, byNombre[0].id);
    return byNombre[0].id;
  }

  return null;
}

// ─── Map header names to keys ───────────────────────────────────
function mapHeaders(row: Record<string, any>, columns: ImportColumn[]): Record<string, any> {
  const mapped: Record<string, any> = {};
  for (const col of columns) {
    // Try by header name first, then by key
    const val = row[col.header] ?? row[col.key] ?? undefined;
    if (val !== undefined) mapped[col.key] = val;
  }
  return mapped;
}

function toBool(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const v = val.trim().toLowerCase();
    return v === 'sí' || v === 'si' || v === 'yes' || v === '1' || v === 'true';
  }
  return !!val;
}

// Helper to apply product insert defaults
function applyInsertDefaults(data: any) {
  if (data.precio_principal === undefined) data.precio_principal = 0;
  if (data.costo === undefined) data.costo = 0;
  if (data.status === undefined) data.status = 'activo';
  if (data.tiene_iva === undefined) {
    data.tiene_iva = false;
    data.iva_pct = 16;
  }
  if (data.tiene_ieps === undefined) {
    data.tiene_ieps = false;
    data.ieps_pct = 0;
    data.ieps_tipo = 'porcentaje';
  }
  if (data.es_granel === undefined) {
    data.es_granel = false;
    data.unidad_granel = 'kg';
  }
  if (data.min === undefined) data.min = 0;
  if (data.max === undefined) data.max = 0;
  if (data.factor_conversion === undefined) data.factor_conversion = 1;
  if (data.precio_sugerido_publico === undefined) data.precio_sugerido_publico = 0;
  if (data.costo_incluye_impuestos === undefined) data.costo_incluye_impuestos = false;
}

// Helper to apply client insert defaults
function applyClientInsertDefaults(data: any) {
  if (data.codigo === undefined) data.codigo = null;
  if (data.contacto === undefined) data.contacto = null;
  if (data.telefono === undefined) data.telefono = null;
  if (data.email === undefined) data.email = null;
  if (data.direccion === undefined) data.direccion = null;
  if (data.colonia === undefined) data.colonia = null;
  if (data.rfc === undefined) data.rfc = null;
  if (data.regimen_fiscal === undefined) data.regimen_fiscal = null;
  if (data.cp === undefined) data.cp = null;
  if (data.uso_cfdi === undefined) data.uso_cfdi = null;
  if (data.credito === undefined) data.credito = false;
  if (data.limite_credito === undefined) data.limite_credito = 0;
  if (data.dias_credito === undefined) data.dias_credito = 0;
  if (data.frecuencia === undefined) data.frecuencia = 'semanal';
  if (data.status === undefined) data.status = 'activo';
  if (data.gps_lat === undefined) data.gps_lat = null;
  if (data.gps_lng === undefined) data.gps_lng = null;
}

// ─── Import Products ───────────────────────────────────────────
export async function importProducts(rows: Record<string, any>[], empresaId: string): Promise<ImportResult> {
  const result: ImportResult = { total: rows.length, created: 0, updated: 0, errors: [] };
  const cache = new Map<string, Map<string, string>>();
  const satCache = new Map<string, string>();

  // Get current user for audit trail
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  // Get default almacén for adjustments
  const { data: defaultAlmacen } = await supabase
    .from('almacenes')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  for (let i = 0; i < rows.length; i++) {
    const raw = mapHeaders(rows[i], PRODUCT_IMPORT_COLUMNS);
    const rowNum = i + 2; // +2 for header + 0-index

    try {
      if (!raw.codigo && !raw.nombre) {
        result.errors.push({ row: rowNum, message: 'Código y Nombre vacíos, fila omitida' });
        continue;
      }
      if (!raw.nombre) {
        result.errors.push({ row: rowNum, message: 'Nombre es requerido' });
        continue;
      }

      // Resolve catalogs (only if present in the spreadsheet)
      const has = (key: string) => raw[key] !== undefined;

      let marca_id: string | null | undefined = undefined;
      let clasificacion_id: string | null | undefined = undefined;
      let proveedor_id: string | null | undefined = undefined;
      let lista_id: string | null | undefined = undefined;
      let unidad_venta_id: string | null | undefined = undefined;
      let unidad_compra_id: string | null | undefined = undefined;

      if (has('marca')) marca_id = await resolveOrCreate('marcas', raw.marca, empresaId, cache);
      if (has('clasificacion')) clasificacion_id = await resolveOrCreate('clasificaciones', raw.clasificacion, empresaId, cache);
      if (has('proveedor')) proveedor_id = await resolveOrCreate('proveedores', raw.proveedor, empresaId, cache);
      if (has('lista')) lista_id = await resolveOrCreate('listas', raw.lista, empresaId, cache);
      if (has('unidad_venta')) unidad_venta_id = await resolveOrCreate('unidades', raw.unidad_venta, empresaId, cache);
      if (has('unidad_compra')) unidad_compra_id = await resolveOrCreate('unidades', raw.unidad_compra, empresaId, cache);

      const importedStock = raw.cantidad ? Number(raw.cantidad) : 0;

      const productData: any = {
        empresa_id: empresaId,
        codigo: raw.codigo?.toString().trim() || '',
        nombre: raw.nombre?.toString().trim(),
      };

      if (has('precio_principal')) productData.precio_principal = raw.precio_principal ? Number(raw.precio_principal) : 0;
      if (has('costo')) productData.costo = raw.costo ? Number(raw.costo) : 0;
      
      // Stock/Cantidad is always processed because importedStock is determined
      productData.cantidad = importedStock;

      if (has('clave_alterna')) productData.clave_alterna = raw.clave_alterna?.toString().trim() || null;
      if (has('status')) {
        productData.status = ['activo', 'inactivo', 'borrador'].includes(raw.status?.toLowerCase?.()) ? raw.status.toLowerCase() : 'activo';
      }

      if (marca_id !== undefined) productData.marca_id = marca_id;
      if (clasificacion_id !== undefined) productData.clasificacion_id = clasificacion_id;
      if (proveedor_id !== undefined) productData.proveedor_id = proveedor_id;
      if (lista_id !== undefined) productData.lista_id = lista_id;
      if (unidad_venta_id !== undefined) productData.unidad_venta_id = unidad_venta_id;
      if (unidad_compra_id !== undefined) productData.unidad_compra_id = unidad_compra_id;

      // Fiscal tax fields
      const rawIvaPct = raw.iva_pct !== undefined ? Number(raw.iva_pct) : undefined;
      const rawTieneIva = raw.tiene_iva !== undefined ? toBool(raw.tiene_iva) : undefined;

      if (rawIvaPct !== undefined) {
        productData.iva_pct = rawIvaPct;
        productData.tiene_iva = rawIvaPct > 0;
      } else if (rawTieneIva !== undefined) {
        productData.tiene_iva = rawTieneIva;
        productData.iva_pct = rawTieneIva ? 16 : 0;
      }

      const rawIepsPct = raw.ieps_pct !== undefined ? Number(raw.ieps_pct) : undefined;
      const rawTieneIeps = raw.tiene_ieps !== undefined ? toBool(raw.tiene_ieps) : undefined;

      if (rawIepsPct !== undefined) {
        productData.ieps_pct = rawIepsPct;
        productData.tiene_ieps = rawIepsPct > 0;
      } else if (rawTieneIeps !== undefined) {
        productData.tiene_ieps = rawTieneIeps;
        productData.ieps_pct = rawTieneIeps ? 8 : 0;
      }

      if (has('ieps_tipo')) {
        productData.ieps_tipo = ['cuota', 'porcentaje'].includes(raw.ieps_tipo?.toLowerCase?.())
          ? raw.ieps_tipo.toLowerCase()
          : 'porcentaje';
      }

      if (has('costo_incluye_impuestos')) {
        productData.costo_incluye_impuestos = toBool(raw.costo_incluye_impuestos);
      }

      // Stock bounds & granel
      if (has('min')) productData.min = raw.min != null && raw.min !== '' ? Number(raw.min) : 0;
      if (has('max')) productData.max = raw.max != null && raw.max !== '' ? Number(raw.max) : 0;
      
      if (has('es_granel')) {
        productData.es_granel = toBool(raw.es_granel);
      }
      if (has('unidad_granel')) {
        productData.unidad_granel = ['kg', 'g', 'litro', 'ml', 'pieza'].includes(raw.unidad_granel?.toLowerCase?.())
          ? raw.unidad_granel.toLowerCase()
          : 'kg';
      }

      // Alternate names
      if (has('nombre_compra')) productData.nombre_compra = raw.nombre_compra?.toString().trim() || null;
      if (has('nombre_venta')) productData.nombre_venta = raw.nombre_venta?.toString().trim() || null;
      if (has('nombre_ticket')) productData.nombre_ticket = raw.nombre_ticket?.toString().trim() || null;

      // Conversion & public price
      if (has('factor_conversion')) {
        productData.factor_conversion = raw.factor_conversion != null && raw.factor_conversion !== '' ? Number(raw.factor_conversion) : 1;
      }
      if (has('precio_sugerido_publico')) {
        productData.precio_sugerido_publico = raw.precio_sugerido_publico != null && raw.precio_sugerido_publico !== '' ? Number(raw.precio_sugerido_publico) : 0;
      }

      // SAT codes
      if (has('codigo_sat')) {
        productData.codigo_sat = raw.codigo_sat?.toString().trim() || null;
      }
      if (has('unidad_sat')) {
        const udem_sat_id = await resolveUnidadSat(raw.unidad_sat, satCache);
        productData.udem_sat_id = udem_sat_id;
      }

      let productId: string | null = null;
      let previousStock = 0;

      // Check if exists by codigo
      if (productData.codigo) {
        const { data: existing } = await supabase
          .from('productos')
          .select('id, cantidad')
          .eq('empresa_id', empresaId)
          .eq('codigo', productData.codigo)
          .maybeSingle();

        if (existing) {
          productId = existing.id;
          previousStock = existing.cantidad ?? 0;
          const { empresa_id: _, ...updateData } = productData;
          const { error } = await supabase.from('productos').update(updateData).eq('id', existing.id);
          if (error) throw error;
          result.updated++;
        } else {
          applyInsertDefaults(productData);
          const { data: inserted, error } = await supabase.from('productos').insert(productData).select('id').single();
          if (error) throw error;
          productId = inserted.id;
          result.created++;
        }
      } else {
        applyInsertDefaults(productData);
        const { data: inserted, error } = await supabase.from('productos').insert(productData).select('id').single();
        if (error) throw error;
        productId = inserted.id;
        result.created++;
      }

      // Create inventory adjustment & movement when stock differs
      const stockDiff = importedStock - previousStock;
      if (productId && userId && stockDiff !== 0) {
        // Ajuste de inventario
        await supabase.from('ajustes_inventario').insert({
          empresa_id: empresaId,
          producto_id: productId,
          user_id: userId,
          cantidad_anterior: previousStock,
          cantidad_nueva: importedStock,
          diferencia: stockDiff,
          motivo: 'Importación masiva de productos',
          almacen_id: defaultAlmacen?.id ?? null,
        });

        // Movimiento de inventario
        await supabase.from('movimientos_inventario').insert({
          empresa_id: empresaId,
          producto_id: productId,
          tipo: stockDiff > 0 ? 'entrada' : 'salida',
          cantidad: Math.abs(stockDiff),
          fecha: todayLocal(),
          referencia_tipo: 'ajuste',
          notas: 'Importación masiva de productos',
          user_id: userId,
          almacen_destino_id: stockDiff > 0 ? (defaultAlmacen?.id ?? null) : null,
          almacen_origen_id: stockDiff < 0 ? (defaultAlmacen?.id ?? null) : null,
        });
      }

      // Sync stock to the default warehouse in stock_almacen
      if (productId && defaultAlmacen?.id) {
        await supabase.from('stock_almacen').upsert(
          {
            empresa_id: empresaId,
            almacen_id: defaultAlmacen.id,
            producto_id: productId,
            cantidad: importedStock,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'almacen_id,producto_id' }
        );
      }
    } catch (err: any) {
      result.errors.push({ row: rowNum, message: err.message || 'Error desconocido' });
    }
  }

  return result;
}

// ─── Import Clients ────────────────────────────────────────────
export async function importClients(rows: Record<string, any>[], empresaId: string): Promise<ImportResult> {
  const result: ImportResult = { total: rows.length, created: 0, updated: 0, errors: [] };
  const cache = new Map<string, Map<string, string>>();

  for (let i = 0; i < rows.length; i++) {
    const raw = mapHeaders(rows[i], CLIENT_IMPORT_COLUMNS);
    const rowNum = i + 2;

    try {
      if (!raw.nombre) {
        result.errors.push({ row: rowNum, message: 'Nombre es requerido' });
        continue;
      }

      // Resolve catalogs (only if present in the spreadsheet)
      const has = (key: string) => raw[key] !== undefined;

      let zona_id: string | null | undefined = undefined;
      let vendedor_id: string | null | undefined = undefined;
      let cobrador_id: string | null | undefined = undefined;
      let lista_id: string | null | undefined = undefined;

      if (has('zona')) zona_id = await resolveOrCreate('zonas', raw.zona, empresaId, cache);
      if (has('vendedor')) vendedor_id = await resolveOrCreate('vendedores', raw.vendedor, empresaId, cache);
      if (has('cobrador')) cobrador_id = await resolveOrCreate('cobradores', raw.cobrador, empresaId, cache);
      if (has('lista')) lista_id = await resolveOrCreate('listas', raw.lista, empresaId, cache);

      const clientData: any = {
        empresa_id: empresaId,
        nombre: raw.nombre?.toString().trim(),
      };

      if (has('codigo')) clientData.codigo = raw.codigo?.toString().trim() || null;
      if (has('contacto')) clientData.contacto = raw.contacto?.toString().trim() || null;
      if (has('telefono')) clientData.telefono = raw.telefono?.toString().trim() || null;
      if (has('email')) clientData.email = raw.email?.toString().trim() || null;
      if (has('direccion')) clientData.direccion = raw.direccion?.toString().trim() || null;
      if (has('colonia')) clientData.colonia = raw.colonia?.toString().trim() || null;
      if (has('rfc')) clientData.rfc = raw.rfc?.toString().trim() || null;
      if (has('regimen_fiscal')) clientData.regimen_fiscal = raw.regimen_fiscal?.toString().trim() || null;
      if (has('cp')) clientData.cp = raw.cp?.toString().trim() || null;
      if (has('uso_cfdi')) clientData.uso_cfdi = raw.uso_cfdi?.toString().trim() || null;

      if (has('credito')) clientData.credito = raw.credito ? toBool(raw.credito) : false;
      if (has('limite_credito')) clientData.limite_credito = raw.limite_credito ? Number(raw.limite_credito) : 0;
      if (has('dias_credito')) clientData.dias_credito = raw.dias_credito ? Number(raw.dias_credito) : 0;
      if (has('frecuencia')) {
        clientData.frecuencia = ['diaria', 'semanal', 'quincenal', 'mensual'].includes(raw.frecuencia?.toLowerCase?.()) ? raw.frecuencia.toLowerCase() : 'semanal';
      }
      if (has('status')) {
        clientData.status = ['activo', 'inactivo', 'suspendido'].includes(raw.status?.toLowerCase?.()) ? raw.status.toLowerCase() : 'activo';
      }
      if (has('gps_lat')) clientData.gps_lat = raw.gps_lat != null && raw.gps_lat !== '' && !isNaN(Number(raw.gps_lat)) ? Number(raw.gps_lat) : null;
      if (has('gps_lng')) clientData.gps_lng = raw.gps_lng != null && raw.gps_lng !== '' && !isNaN(Number(raw.gps_lng)) ? Number(raw.gps_lng) : null;

      if (zona_id !== undefined) clientData.zona_id = zona_id;
      if (vendedor_id !== undefined) clientData.vendedor_id = vendedor_id;
      if (cobrador_id !== undefined) clientData.cobrador_id = cobrador_id;
      if (lista_id !== undefined) clientData.lista_id = lista_id;

      // Check if exists by codigo
      if (clientData.codigo) {
        const { data: existing } = await supabase
          .from('clientes')
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('codigo', clientData.codigo)
          .maybeSingle();

        if (existing) {
          const { empresa_id: _, ...updateData } = clientData;
          const { error } = await supabase.from('clientes').update(updateData).eq('id', existing.id);
          if (error) throw error;
          result.updated++;
        } else {
          applyClientInsertDefaults(clientData);
          const { error } = await supabase.from('clientes').insert(clientData);
          if (error) throw error;
          result.created++;
        }
      } else {
        applyClientInsertDefaults(clientData);
        const { error } = await supabase.from('clientes').insert(clientData);
        if (error) throw error;
        result.created++;
      }
    } catch (err: any) {
      result.errors.push({ row: rowNum, message: err.message || 'Error desconocido' });
    }
  }

  return result;
}
