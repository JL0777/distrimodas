-- Role-specific access for the Jose partner report and a historical product-name snapshot.
ALTER TABLE usuarios
  MODIFY COLUMN rol ENUM('admin', 'vendedor', 'jose') NOT NULL;

ALTER TABLE detalle_ventas
  ADD COLUMN nombre_producto VARCHAR(200) NULL AFTER producto_id;

UPDATE detalle_ventas dv
INNER JOIN productos p ON p.id = dv.producto_id
SET dv.nombre_producto = p.nombre
WHERE dv.nombre_producto IS NULL;

ALTER TABLE detalle_ventas
  MODIFY COLUMN nombre_producto VARCHAR(200) NOT NULL;
