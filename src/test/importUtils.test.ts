import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importProducts, importClients } from '../lib/importUtils';
import { supabase } from '../integrations/supabase/client';

// Helper to create a fluent mock query builder
const createMockBuilder = (mockData: any = null) => {
  const builder: any = {
    insertedPayload: null,
    updatedPayload: null,
  };
  
  builder.select = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.order = vi.fn().mockReturnValue(builder);
  builder.limit = vi.fn().mockReturnValue(builder);
  builder.ilike = vi.fn().mockReturnValue(builder);
  
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: mockData, error: null });
  builder.single = vi.fn().mockResolvedValue({ data: mockData, error: null });
  
  builder.insert = vi.fn().mockImplementation((payload) => {
    builder.insertedPayload = payload;
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data: mockData || { id: 'mock-inserted-id' }, error: null });
    chain.then = (onfulfilled: any) => Promise.resolve({ data: mockData || { id: 'mock-inserted-id' }, error: null }).then(onfulfilled);
    return chain;
  });

  builder.update = vi.fn().mockImplementation((payload) => {
    builder.updatedPayload = payload;
    const chain: any = {};
    chain.eq = vi.fn().mockResolvedValue({ data: mockData, error: null });
    return chain;
  });

  builder.upsert = vi.fn().mockResolvedValue({ data: mockData, error: null });

  return builder;
};

vi.mock('../integrations/supabase/client', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      },
      from: vi.fn(),
    },
  };
});

describe('importUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('importProducts', () => {
    it('should map new product columns correctly and apply insert defaults', async () => {
      const prodBuilder = createMockBuilder(null); // null so that existing check returns null -> triggers INSERT
      const satBuilder = createMockBuilder({ id: 'sat-unit-uuid', clave: 'H87', nombre: 'Pieza' });
      const genericBuilder = createMockBuilder();

      const mockFrom = vi.fn((table) => {
        if (table === 'productos') return prodBuilder;
        if (table === 'unidades_sat') return satBuilder;
        return genericBuilder;
      });

      vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any);

      const rows = [
        {
          'Código': 'PROD-T1',
          'Nombre': 'Producto Test 1',
          'Precio': '10.50',
          'Costo': '5.00',
          'Stock': '50',
          'Stock Mínimo': '5',
          'Stock Máximo': '100',
          'IVA %': '8',
          'IEPS % o Cuota': '0.5',
          'Tipo IEPS (Porcentaje/Cuota)': 'cuota',
          'Costo Incluye Impuestos (Sí/No)': 'Sí',
          'Es Granel (Sí/No)': 'Sí',
          'Unidad Granel': 'litro',
          'Nombre Compra': 'Nombre de Compra Test',
          'Nombre Venta': 'Nombre de Venta Test',
          'Nombre Ticket': 'Nombre de Ticket Test',
          'Factor Conversión': '2',
          'Precio Sugerido Público': '15.00',
          'Código SAT': '12345678',
          'Unidad SAT': 'H87',
        }
      ];

      const res = await importProducts(rows, 'empresa-uuid');

      expect(res.errors).toEqual([]);
      expect(res.created).toBe(1);

      const insertedData = prodBuilder.insertedPayload;
      expect(insertedData.codigo).toBe('PROD-T1');
      expect(insertedData.nombre).toBe('Producto Test 1');
      expect(insertedData.precio_principal).toBe(10.5);
      expect(insertedData.costo).toBe(5);
      expect(insertedData.min).toBe(5);
      expect(insertedData.max).toBe(100);
      expect(insertedData.iva_pct).toBe(8);
      expect(insertedData.tiene_iva).toBe(true);
      expect(insertedData.ieps_pct).toBe(0.5);
      expect(insertedData.tiene_ieps).toBe(true);
      expect(insertedData.ieps_tipo).toBe('cuota');
      expect(insertedData.costo_incluye_impuestos).toBe(true);
      expect(insertedData.es_granel).toBe(true);
      expect(insertedData.unidad_granel).toBe('litro');
      expect(insertedData.nombre_compra).toBe('Nombre de Compra Test');
      expect(insertedData.nombre_venta).toBe('Nombre de Venta Test');
      expect(insertedData.nombre_ticket).toBe('Nombre de Ticket Test');
      expect(insertedData.factor_conversion).toBe(2);
      expect(insertedData.precio_sugerido_publico).toBe(15);
      expect(insertedData.codigo_sat).toBe('12345678');
      expect(insertedData.udem_sat_id).toBe('sat-unit-uuid');
    });

    it('should omit properties from updates if they are not in the spreadsheet', async () => {
      // Return existing product on check
      const prodBuilder = createMockBuilder({ id: 'existing-prod-uuid', cantidad: 50 });
      const genericBuilder = createMockBuilder();

      const mockFrom = vi.fn((table) => {
        if (table === 'productos') return prodBuilder;
        return genericBuilder;
      });

      vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any);

      // Only basic fields are in the spreadsheet. Optional fields like min, max, SAT codes, etc. are NOT in the sheet.
      const rows = [
        {
          'Código': 'PROD-T2',
          'Nombre': 'Producto Test 2',
          'Precio': '12.00',
          'Stock': '50', // Same stock, so no stock diff adjustment triggers
        }
      ];

      const res = await importProducts(rows, 'empresa-uuid');

      expect(res.errors).toEqual([]);
      expect(res.updated).toBe(1);

      const updatedData = prodBuilder.updatedPayload;

      // Verifying mapped fields
      expect(updatedData.codigo).toBe('PROD-T2');
      expect(updatedData.nombre).toBe('Producto Test 2');
      expect(updatedData.precio_principal).toBe(12);

      // Optional fields not present in row should be undefined (omitted) in updatedData
      expect(updatedData.min).toBeUndefined();
      expect(updatedData.max).toBeUndefined();
      expect(updatedData.es_granel).toBeUndefined();
      expect(updatedData.codigo_sat).toBeUndefined();
      expect(updatedData.udem_sat_id).toBeUndefined();
    });
  });

  describe('importClients', () => {
    it('should map client fiscal columns correctly', async () => {
      const clientBuilder = createMockBuilder(null); // null so that existing check returns null -> triggers INSERT
      const genericBuilder = createMockBuilder();

      const mockFrom = vi.fn((table) => {
        if (table === 'clientes') return clientBuilder;
        return genericBuilder;
      });

      vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any);

      const rows = [
        {
          'Nombre': 'Cliente Test 1',
          'Código': 'CLI-T1',
          'RFC': 'RFC123456789',
          'Régimen Fiscal': '601',
          'Código Postal': '54321',
          'Uso CFDI': 'G03',
        }
      ];

      const res = await importClients(rows, 'empresa-uuid');

      expect(res.errors).toEqual([]);
      expect(res.created).toBe(1);

      const insertedData = clientBuilder.insertedPayload;
      expect(insertedData.nombre).toBe('Cliente Test 1');
      expect(insertedData.codigo).toBe('CLI-T1');
      expect(insertedData.rfc).toBe('RFC123456789');
      expect(insertedData.facturama_rfc).toBe('RFC123456789');
      expect(insertedData.regimen_fiscal).toBe('601');
      expect(insertedData.facturama_regimen_fiscal).toBe('601');
      expect(insertedData.cp).toBe('54321');
      expect(insertedData.facturama_cp).toBe('54321');
      expect(insertedData.uso_cfdi).toBe('G03');
      expect(insertedData.facturama_uso_cfdi).toBe('G03');
    });

    it('should omit client properties from updates if they are not in the spreadsheet', async () => {
      const clientBuilder = createMockBuilder({ id: 'existing-client-uuid' });
      const genericBuilder = createMockBuilder();

      const mockFrom = vi.fn((table) => {
        if (table === 'clientes') return clientBuilder;
        return genericBuilder;
      });

      vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any);

      const rows = [
        {
          'Nombre': 'Cliente Test 2',
          'Código': 'CLI-T2',
        }
      ];

      const res = await importClients(rows, 'empresa-uuid');

      expect(res.errors).toEqual([]);
      expect(res.updated).toBe(1);

      const updatedData = clientBuilder.updatedPayload;
      expect(updatedData.nombre).toBe('Cliente Test 2');
      expect(updatedData.codigo).toBe('CLI-T2');

      // Unprovided fields in spreadsheet should be undefined (omitted) in clientData update payload
      expect(updatedData.rfc).toBeUndefined();
      expect(updatedData.facturama_rfc).toBeUndefined();
      expect(updatedData.regimen_fiscal).toBeUndefined();
      expect(updatedData.facturama_regimen_fiscal).toBeUndefined();
      expect(updatedData.cp).toBeUndefined();
      expect(updatedData.facturama_cp).toBeUndefined();
      expect(updatedData.uso_cfdi).toBeUndefined();
      expect(updatedData.facturama_uso_cfdi).toBeUndefined();
    });
  });
});
