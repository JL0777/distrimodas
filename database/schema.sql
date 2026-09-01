-- =====================================================================
-- DISTRIMODAS LA SEXTA - Esquema de Base de Datos (MySQL / MariaDB)
-- Sistema POS + Liquidacion de Nomina Solidaria
-- =====================================================================

CREATE DATABASE IF NOT EXISTS distrimodas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE distrimodas;

-- ---------------------------------------------------------------------
-- Tabla: sedes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sedes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT INTO sedes (nombre) VALUES
  ('Distrimodas La Sexta'),
  ('Punto Intimo')
ON DUPLICATE KEY UPDATE nombre = nombre;

-- ---------------------------------------------------------------------
-- Tabla: empleados
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  sede_id INT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_empleados_sede
    FOREIGN KEY (sede_id) REFERENCES sedes(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_empleados_sede ON empleados(sede_id);
CREATE INDEX idx_empleados_activo ON empleados(activo);

-- ---------------------------------------------------------------------
-- Tabla: productos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  precio_base DECIMAL(12,2) NOT NULL,
  codigo_tiemple DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX idx_productos_nombre ON productos(nombre);
CREATE INDEX idx_productos_activo ON productos(activo);

-- ---------------------------------------------------------------------
-- Tabla: ventas (cabecera)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empleado_id INT NOT NULL,
  sede_id INT NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  metodo_pago ENUM('efectivo', 'tarjeta', 'transferencia') NOT NULL,
  notas_transferencia VARCHAR(255) NULL,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ventas_empleado
    FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_ventas_sede
    FOREIGN KEY (sede_id) REFERENCES sedes(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_ventas_fecha ON ventas(fecha);
CREATE INDEX idx_ventas_empleado ON ventas(empleado_id);
CREATE INDEX idx_ventas_sede ON ventas(sede_id);
CREATE INDEX idx_ventas_metodo_pago ON ventas(metodo_pago);

-- ---------------------------------------------------------------------
-- Tabla: detalle_ventas (items de cada venta)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_ventas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venta_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(12,2) NOT NULL,
  es_venta_neta BOOLEAN NOT NULL DEFAULT TRUE,
  valor_codigo DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  CONSTRAINT fk_detalle_venta
    FOREIGN KEY (venta_id) REFERENCES ventas(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_detalle_producto
    FOREIGN KEY (producto_id) REFERENCES productos(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_detalle_venta ON detalle_ventas(venta_id);
CREATE INDEX idx_detalle_producto ON detalle_ventas(producto_id);
CREATE INDEX idx_detalle_es_venta_neta ON detalle_ventas(es_venta_neta);

-- ---------------------------------------------------------------------
-- Tabla: liquidaciones (cierre de dia)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS liquidaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  asistentes_count INT NOT NULL,
  total_tiemple DECIMAL(12,2) NOT NULL,
  total_netas DECIMAL(12,2) NOT NULL,
  pago_por_empleado DECIMAL(12,2) NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tabla: liquidacion_empleados (detalle de a quien se le pago)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS liquidacion_empleados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  liquidacion_id INT NOT NULL,
  empleado_id INT NOT NULL,
  pago_total DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_liq_empleados_liquidacion
    FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_liq_empleados_empleado
    FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE KEY uq_liquidacion_empleado (liquidacion_id, empleado_id)
) ENGINE=InnoDB;

CREATE INDEX idx_liq_empleados_empleado ON liquidacion_empleados(empleado_id);

-- ---------------------------------------------------------------------
-- Tabla: usuarios (cuentas de acceso al sistema)
-- Nota: no es 1 a 1 con empleados. Hay un usuario "admin" y un usuario
-- "vendedor" compartido por el personal de venta (al vender, se elige el
-- empleado especifico desde el dropdown existente en el terminal).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('admin', 'vendedor') NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Usuarios por defecto (CAMBIAR LAS CONTRASEÑAS DESPUES DEL PRIMER INGRESO):
--   username: admin     password: admin123
--   username: vendedor  password: vendedor123
INSERT INTO usuarios (username, password_hash, rol) VALUES
  ('admin', '$2b$10$tmwrpA.wt/7FJ5PpdFPJsecEk8NHnh.rcL5Ii8UsIFrPoh6/2M1re', 'admin'),
  ('vendedor', '$2b$10$5mVxX4c2DgrsSnBwx6de..dtMVgf/yve93EP23dMzRkk8s9SyZjkO', 'vendedor')
ON DUPLICATE KEY UPDATE username = username;

-- ---------------------------------------------------------------------
-- Datos de ejemplo (opcional, comentar si no se desea)
-- ---------------------------------------------------------------------
-- INSERT INTO empleados (nombre, sede_id) VALUES
--   ('Ana Perez', 1),
--   ('Luis Gomez', 2);
