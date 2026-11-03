import { getPool } from "@/lib/db";
import { calcularLiquidacion, type PayrollCalculo } from "@/lib/payroll";

export interface PayrollCloseResult {
  success: boolean;
  error?: string;
  calculo?: PayrollCalculo;
}

export async function closePayrollForDate(
  fecha: string,
  empleadoIds: number[],
  forzarRecalculo = false
): Promise<PayrollCloseResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { success: false, error: "La fecha de liquidación no es válida." };
  }
  if (empleadoIds.length === 0) {
    return { success: false, error: "Selecciona al menos un empleado." };
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existente] = await conn.query(
      `SELECT id FROM liquidaciones WHERE fecha = ? LIMIT 1 FOR UPDATE`,
      [fecha]
    );
    const liquidacionExistente = (existente as { id: number }[])[0];
    if (liquidacionExistente && !forzarRecalculo) {
      throw new Error("El dia de hoy ya fue liquidado. Usa 'Recalcular' si necesitas actualizarla.");
    }

    const [totales] = await conn.query(
      `SELECT
         COALESCE(SUM(CASE WHEN dv.es_venta_neta = FALSE THEN dv.valor_codigo * dv.cantidad ELSE 0 END), 0) AS total_tiemple,
         COALESCE(SUM(CASE WHEN dv.es_venta_neta = TRUE THEN dv.precio_unitario * dv.cantidad ELSE 0 END), 0) AS total_netas
       FROM detalle_ventas dv
       INNER JOIN ventas v ON v.id = dv.venta_id
       INNER JOIN sedes s ON s.id = v.sede_id
       WHERE DATE(v.fecha) = ?
         AND (dv.es_venta_neta = FALSE OR s.nombre = 'Distrimodas La Sexta')`,
      [fecha]
    );
    const fila = (totales as { total_tiemple: number; total_netas: number }[])[0];
    const calculo = calcularLiquidacion(
      Number(fila?.total_tiemple ?? 0),
      Number(fila?.total_netas ?? 0),
      empleadoIds.length
    );

    let liquidacionId: number;
    if (liquidacionExistente) {
      liquidacionId = liquidacionExistente.id;
      await conn.query(
        `UPDATE liquidaciones
           SET asistentes_count = ?, total_tiemple = ?, total_netas = ?, pago_por_empleado = ?
         WHERE id = ?`,
        [
          calculo.asistentesCount,
          calculo.totalTiemple,
          calculo.totalNetas,
          calculo.pagoTotalPorEmpleado,
          liquidacionId,
        ]
      );
      await conn.query(`DELETE FROM liquidacion_empleados WHERE liquidacion_id = ?`, [liquidacionId]);
    } else {
      const [liquidacionResult] = await conn.query(
        `INSERT INTO liquidaciones
           (fecha, asistentes_count, total_tiemple, total_netas, pago_por_empleado)
         VALUES (?, ?, ?, ?, ?)`,
        [
          fecha,
          calculo.asistentesCount,
          calculo.totalTiemple,
          calculo.totalNetas,
          calculo.pagoTotalPorEmpleado,
        ]
      );
      liquidacionId = (liquidacionResult as { insertId: number }).insertId;
    }

    for (const empleadoId of empleadoIds) {
      await conn.query(
        `INSERT INTO liquidacion_empleados (liquidacion_id, empleado_id, pago_total)
         VALUES (?, ?, ?)`,
        [liquidacionId, empleadoId, calculo.pagoTotalPorEmpleado]
      );
    }

    await conn.commit();
    return { success: true, calculo };
  } catch (err) {
    await conn.rollback();
    const message = err instanceof Error ? err.message : "Error liquidando el dia";
    return { success: false, error: message };
  } finally {
    conn.release();
  }
}

export async function closePendingPayrollDays(): Promise<string[]> {
  const pool = getPool();
  const [pendingRows] = await pool.query(
    `SELECT DATE_FORMAT(DATE(v.fecha), '%Y-%m-%d') AS fecha
     FROM ventas v
     LEFT JOIN liquidaciones l ON l.fecha = DATE(v.fecha)
     WHERE DATE(v.fecha) < CURDATE()
       AND l.id IS NULL
     GROUP BY DATE(v.fecha)
     ORDER BY DATE(v.fecha) ASC`
  );
  const pendingDays = (pendingRows as { fecha: string }[]).map((row) => row.fecha);
  const closedDays: string[] = [];

  for (const fecha of pendingDays) {
    const [employeeRows] = await pool.query(
      `SELECT DISTINCT empleado_id FROM ventas WHERE DATE(fecha) = ?`,
      [fecha]
    );
    const empleadoIds = (employeeRows as { empleado_id: number }[]).map(
      (row) => row.empleado_id
    );
    if (empleadoIds.length === 0) continue;

    const result = await closePayrollForDate(fecha, empleadoIds);
    if (!result.success) {
      throw new Error(`No se pudo liquidar el ${fecha}: ${result.error ?? "error desconocido"}`);
    }
    closedDays.push(fecha);
  }

  return closedDays;
}
