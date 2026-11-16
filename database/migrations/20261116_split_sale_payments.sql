ALTER TABLE ventas
  ADD COLUMN pago_efectivo DECIMAL(12,2) NULL AFTER metodo_pago,
  ADD COLUMN pago_tarjeta DECIMAL(12,2) NULL AFTER pago_efectivo,
  ADD COLUMN pago_transferencia DECIMAL(12,2) NULL AFTER pago_tarjeta;

UPDATE ventas
SET pago_efectivo = IF(metodo_pago = 'efectivo', total, 0),
    pago_tarjeta = IF(metodo_pago = 'tarjeta', total, 0),
    pago_transferencia = IF(metodo_pago = 'transferencia', total, 0);
