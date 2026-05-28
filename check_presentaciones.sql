select p.codigo, p.nombre, pp.nombre as presentacion, pp.factor_base
from producto_presentaciones pp
join productos p on p.id = pp.producto_id
where p.codigo = 'BEB-001';
