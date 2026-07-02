import os
import xlsxwriter

os.makedirs('public/templates', exist_ok=True)

# ─── CLIENT TEMPLATE ─────────────────────────────────────────────
print("Generating Client Template...")
workbook_clients = xlsxwriter.Workbook('public/templates/Plantilla_Clientes.xlsx')
worksheet_clients = workbook_clients.add_worksheet('Plantilla')
catalog_sheet = workbook_clients.add_worksheet('Catalogo_Regimenes')

# Define lists
regimenes = [
    "601 - General de Ley Personas Morales",
    "603 - Personas Morales con Fines no Lucrativos",
    "605 - Sueldos y Salarios e Ingresos Asimilados a Salarios",
    "606 - Arrendamiento",
    "607 - Enajenación o Adquisición de Bienes",
    "608 - Demás Ingresos",
    "610 - Residentes en el Extranjero sin Establecimiento Permanente en México",
    "611 - Ingresos por Dividendos (socios y accionistas)",
    "612 - Personas Físicas con Actividades Empresariales y Profesionales",
    "614 - Ingresos por Intereses",
    "615 - Régimen de los ingresos por obtención de premios",
    "616 - Sin obligaciones fiscales",
    "620 - Sociedades Cooperativas de Producción que optan por diferir sus ingresos",
    "621 - Incorporación Fiscal",
    "622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras",
    "623 - Opcional para Grupos de Sociedades",
    "624 - Coordinados",
    "625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas",
    "626 - Régimen Simplificado de Confianza"
]

usos_cfdi = [
    "G01 - Adquisición de mercancías",
    "G02 - Devoluciones, descuentos o bonificaciones",
    "G03 - Gastos en general",
    "I01 - Construcciones",
    "I02 - Mobiliario y equipo de oficina por inversiones",
    "I03 - Equipo de transporte",
    "I04 - Equipo de cómputo y accesorios",
    "I05 - Dados, troqueles, moldes, matrices y herramental",
    "I06 - Comunicaciones telefónicas",
    "I07 - Comunicaciones satelitales",
    "I08 - Otra maquinaria y equipo",
    "D01 - Honorarios médicos, dentales y gastos hospitalarios",
    "D02 - Gastos médicos por incapacidad o discapacidad",
    "D03 - Gastos funerales",
    "D04 - Donativos",
    "D05 - Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)",
    "D06 - Aportaciones voluntarias al SAR",
    "D07 - Primas por seguros de gastos médicos",
    "D08 - Gastos de transportación escolar obligatoria",
    "D09 - Depósitos en cuentas especiales para el ahorro, primas que tengan como base planes de pensiones",
    "D10 - Pagos por servicios educativos (colegiaturas)",
    "S01 - Sin efectos fiscales",
    "CP01 - Pagos",
    "CN01 - Nómina"
]

frecuencias = ["diaria", "semanal", "quincenal", "mensual"]
estados = ["activo", "inactivo", "suspendido"]
si_no = ["Sí", "No"]

# Write catalog sheet
catalog_sheet.write(0, 0, 'Regímenes Fiscales')
for idx, val in enumerate(regimenes):
    catalog_sheet.write(idx + 1, 0, val)

catalog_sheet.write(0, 1, 'Usos CFDI')
for idx, val in enumerate(usos_cfdi):
    catalog_sheet.write(idx + 1, 1, val)

catalog_sheet.write(0, 2, 'Frecuencia')
for idx, val in enumerate(frecuencias):
    catalog_sheet.write(idx + 1, 2, val)

catalog_sheet.write(0, 3, 'Estado')
for idx, val in enumerate(estados):
    catalog_sheet.write(idx + 1, 3, val)

catalog_sheet.write(0, 4, 'Sí/No')
for idx, val in enumerate(si_no):
    catalog_sheet.write(idx + 1, 4, val)

# Hide catalog sheet
catalog_sheet.hide()

# Columns definitions for clients
client_headers = [
    'Código', 'Nombre', 'Contacto', 'Teléfono', 'Email', 'Dirección', 'Colonia', 'RFC',
    'Régimen Fiscal', 'Código Postal', 'Uso CFDI', 'Zona', 'Vendedor', 'Cobrador', 'Lista',
    'Crédito (Sí/No)', 'Límite Crédito', 'Días Crédito', 'Frecuencia', 'Estado', 'Latitud', 'Longitud'
]
client_examples = [
    'CLI-0001', 'Tienda Don Pedro', 'Pedro García', '55 1234 5678', 'pedro@correo.com',
    'Av. Reforma 100', 'Centro', 'GAPE800101XXX', '601 - General de Ley Personas Morales',
    '01000', 'G03 - Gastos en general', 'Zona Norte', 'Juan Pérez', 'María López',
    'Lista General', 'No', '5000', '30', 'semanal', 'activo', '19.432608', '-99.133209'
]

# Write headers and examples
for col_idx, (header, example) in enumerate(zip(client_headers, client_examples)):
    worksheet_clients.write(0, col_idx, header)
    worksheet_clients.write(1, col_idx, example)
    worksheet_clients.set_column(col_idx, col_idx, max(len(header) + 4, len(example) + 2))

# Apply validations to columns (e.g. rows 2 to 1000)
# Régimen Fiscal: Column I (index 8) -> cell reference '$A$2:$A$20'
worksheet_clients.data_validation(1, 8, 1000, 8, {
    'validate': 'list',
    'source': '=Catalogo_Regimenes!$A$2:$A$20',
    'error_title': 'Opción no válida',
    'error_message': 'Por favor selecciona un Régimen Fiscal de la lista.'
})

# Uso CFDI: Column K (index 10) -> cell reference '$B$2:$B$25'
worksheet_clients.data_validation(1, 10, 1000, 10, {
    'validate': 'list',
    'source': '=Catalogo_Regimenes!$B$2:$B$25',
    'error_title': 'Opción no válida',
    'error_message': 'Por favor selecciona un Uso de CFDI de la lista.'
})

# Frecuencia: Column S (index 18) -> cell reference '$C$2:$C$5'
worksheet_clients.data_validation(1, 18, 1000, 18, {
    'validate': 'list',
    'source': '=Catalogo_Regimenes!$C$2:$C$5',
    'error_title': 'Opción no válida',
    'error_message': 'Por favor selecciona una frecuencia de la lista.'
})

# Estado: Column T (index 19) -> cell reference '$D$2:$D$4'
worksheet_clients.data_validation(1, 19, 1000, 19, {
    'validate': 'list',
    'source': '=Catalogo_Regimenes!$D$2:$D$4',
    'error_title': 'Opción no válida',
    'error_message': 'Por favor selecciona un estado de la lista.'
})

# Crédito (Sí/No): Column P (index 15) -> cell reference '$E$2:$E$3'
worksheet_clients.data_validation(1, 15, 1000, 15, {
    'validate': 'list',
    'source': '=Catalogo_Regimenes!$E$2:$E$3',
    'error_title': 'Opción no válida',
    'error_message': 'Por favor selecciona Sí o No.'
})

workbook_clients.close()
print("Client Template Generated Successfully.")

# ─── PRODUCT TEMPLATE ────────────────────────────────────────────
print("Generating Product Template...")
workbook_prods = xlsxwriter.Workbook('public/templates/Plantilla_Productos.xlsx')
worksheet_prods = workbook_prods.add_worksheet('Plantilla')
catalog_sheet_prods = workbook_prods.add_worksheet('Catalogo_Productos')

prod_estados = ["activo", "inactivo", "borrador"]
ieps_tipos = ["porcentaje", "cuota"]
unidades_granel = ["kg", "g", "litro", "ml", "pieza"]

catalog_sheet_prods.write(0, 0, 'Sí/No')
for idx, val in enumerate(si_no):
    catalog_sheet_prods.write(idx + 1, 0, val)

catalog_sheet_prods.write(0, 1, 'Estado')
for idx, val in enumerate(prod_estados):
    catalog_sheet_prods.write(idx + 1, 1, val)

catalog_sheet_prods.write(0, 2, 'Tipo IEPS')
for idx, val in enumerate(ieps_tipos):
    catalog_sheet_prods.write(idx + 1, 2, val)

catalog_sheet_prods.write(0, 3, 'Unidad Granel')
for idx, val in enumerate(unidades_granel):
    catalog_sheet_prods.write(idx + 1, 3, val)

catalog_sheet_prods.hide()

product_headers = [
    'Código', 'Nombre', 'Precio', 'Costo', 'Stock', 'Marca', 'Clasificación', 'Proveedor',
    'Lista', 'Unidad Venta', 'Unidad Compra', 'Clave Alterna', 'Tiene IVA (Sí/No)',
    'IVA %', 'IEPS % o Cuota', 'Tipo IEPS (Porcentaje/Cuota)', 'Costo Incluye Impuestos (Sí/No)',
    'Stock Mínimo', 'Stock Máximo', 'Es Granel (Sí/No)', 'Unidad Granel',
    'Nombre Compra', 'Nombre Venta', 'Nombre Ticket', 'Factor Conversión',
    'Precio Sugerido Público', 'Código SAT', 'Unidad SAT', 'Estado'
]
product_examples = [
    'PROD-0001', 'Refresco Cola 600ml', '18.50', '12.00', '100', 'Coca-Cola', 'Bebidas',
    'Distribuidora ABC', 'Lista General', 'Pieza', 'Caja', 'RC600', 'Sí', '16', '0',
    'porcentaje', 'No', '10', '500', 'No', 'kg', 'Refresco Cola Pack', 'Refresco Cola Frío',
    'Refresco Cola', '1', '20.00', '50202306', 'H87', 'activo'
]

# Write headers and examples
for col_idx, (header, example) in enumerate(zip(product_headers, product_examples)):
    worksheet_prods.write(0, col_idx, header)
    worksheet_prods.write(1, col_idx, example)
    worksheet_prods.set_column(col_idx, col_idx, max(len(header) + 4, len(example) + 2))

# Apply validations to columns
# Tiene IVA: Column M (index 12) -> cell reference '$A$2:$A$3'
worksheet_prods.data_validation(1, 12, 1000, 12, {
    'validate': 'list',
    'source': '=Catalogo_Productos!$A$2:$A$3',
    'error_title': 'Opción no válida',
    'error_message': 'Por favor selecciona Sí o No.'
})

# Costo Incluye Impuestos: Column Q (index 16) -> cell reference '$A$2:$A$3'
worksheet_prods.data_validation(1, 16, 1000, 16, {
    'validate': 'list',
    'source': '=Catalogo_Productos!$A$2:$A$3',
    'error_title': 'Opción no válida',
    'error_message': 'Por favor selecciona Sí o No.'
})

# Es Granel: Column T (index 19) -> cell reference '$A$2:$A$3'
worksheet_prods.data_validation(1, 19, 1000, 19, {
    'validate': 'list',
    'source': '=Catalogo_Productos!$A$2:$A$3',
    'error_title': 'Opción no válida',
    'error_message': 'Por favor selecciona Sí o No.'
})

# Estado: Column AC (index 28) -> cell reference '$B$2:$B$4'
worksheet_prods.data_validation(1, 28, 1000, 28, {
    'validate': 'list',
    'source': '=Catalogo_Productos!$B$2:$B$4',
    'error_title': 'Opción no válida',
    'error_message': 'Por favor selecciona un estado de la lista.'
})

# Tipo IEPS: Column P (index 15) -> cell reference '$C$2:$C$3'
worksheet_prods.data_validation(1, 15, 1000, 15, {
    'validate': 'list',
    'source': '=Catalogo_Productos!$C$2:$C$3',
    'error_title': 'Opción no válida',
    'error_message': 'Por favor selecciona un tipo de la lista.'
})

# Unidad Granel: Column U (index 20) -> cell reference '$D$2:$D$6'
worksheet_prods.data_validation(1, 20, 1000, 20, {
    'validate': 'list',
    'source': '=Catalogo_Productos!$D$2:$D$6',
    'error_title': 'Opción no válida',
    'error_message': 'Por favor selecciona una unidad de la lista.'
})

workbook_prods.close()
print("Product Template Generated Successfully.")
