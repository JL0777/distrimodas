"use server";

import { auth } from "@/auth";
import { getPool } from "@/lib/db";

export type JoseProductCategory = "gorra" | "pava" | "guante";

export interface JoseSaleItem {
  saleId: number;
  itemId: number;
  fecha: string;
  vendedor: string;
  sede: string;
  articulo: string;
  categoria: JoseProductCategory;
  cantidad: number;
  precioUnitario: number;
  total: number;
  totalCodigo: number;
  metodoPago: string;
}

export interface JoseWeekSummary {
  weekStart: string;
  weekEnd: string;
  gorras: number;
  pavas: number;
  guantes: number;
  totalUnidades: number;
  totalVentas: number;
  totalCodigos: number;
  cantidadVentas: number;
}

export interface JoseWeeklyReport {
  weekStart: string;
  weekEnd: string;
  items: JoseSaleItem[];
  weeks: JoseWeekSummary[];
}

const productFilter = `(
  LOWER(dv.nombre_producto) LIKE '%gorra%'
  OR LOWER(dv.nombre_producto) LIKE '%sombrero%'
  OR LOWER(dv.nombre_producto) LIKE '%pava%'
  OR LOWER(dv.nombre_producto) LIKE '%guante%'
)
AND LOWER(dv.nombre_producto) NOT LIKE '%guante cocina%'
AND LOWER(dv.nombre_producto) NOT LIKE '%guante de cocina%'
AND LOWER(dv.nombre_producto) NOT LIKE '%guantes cocina%'
AND LOWER(dv.nombre_producto) NOT LIKE '%guantes de cocina%'
AND LOWER(dv.nombre_producto) NOT LIKE '%gorra cocina%'
AND LOWER(dv.nombre_producto) NOT LIKE '%gorra de cocina%'
AND LOWER(dv.nombre_producto) NOT LIKE '%gorras cocina%'
AND LOWER(dv.nombre_producto) NOT LIKE '%gorras de cocina%'`;

function isMondayDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value
    && parsed.getUTCDay() === 1;
}

function toIsoDate(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toIsoTimestamp(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export async function getJoseWeeklyReport(weekStart?: string): Promise<JoseWeeklyReport> {
  const session = await auth();
  if (session?.user?.rol !== "jose") {
    throw new Error("No tienes permisos para consultar este reporte.");
  }
  if (weekStart !== undefined && !isMondayDate(weekStart)) {
    throw new Error("La semana seleccionada no es válida.");
  }

  const pool = getPool();
  const [currentWeekRows] = await pool.query(
    `SELECT DATE_FORMAT(
       DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY),
       '%Y-%m-%d'
     ) AS week_start`
  );
  const currentWeek = (currentWeekRows as { week_start: string }[])[0]?.week_start;
  if (!currentWeek) {
    throw new Error("No fue posible determinar la semana actual.");
  }
  const selectedWeek = weekStart ?? currentWeek;

  const [itemRows] = await pool.query(
    `SELECT v.id AS sale_id, dv.id AS item_id, v.fecha, e.nombre AS vendedor, s.nombre AS sede,
            dv.nombre_producto AS articulo, dv.cantidad, dv.precio_unitario,
            dv.valor_codigo, v.metodo_pago,
            CASE
              WHEN LOWER(dv.nombre_producto) LIKE '%gorra%'
                OR LOWER(dv.nombre_producto) LIKE '%sombrero%' THEN 'gorra'
              WHEN LOWER(dv.nombre_producto) LIKE '%pava%' THEN 'pava'
              ELSE 'guante'
            END AS categoria
     FROM ventas v
     INNER JOIN detalle_ventas dv ON dv.venta_id = v.id
     INNER JOIN empleados e ON e.id = v.empleado_id
     INNER JOIN sedes s ON s.id = v.sede_id
     WHERE v.fecha >= ?
       AND v.fecha < DATE_ADD(?, INTERVAL 7 DAY)
       AND ${productFilter}
     ORDER BY v.fecha DESC, v.id DESC, dv.id DESC`,
    [selectedWeek, selectedWeek]
  );

  const [summaryRows] = await pool.query(
    `SELECT DATE_FORMAT(
              DATE_SUB(DATE(v.fecha), INTERVAL WEEKDAY(v.fecha) DAY),
              '%Y-%m-%d'
            ) AS week_start,
            SUM(CASE
              WHEN LOWER(dv.nombre_producto) LIKE '%gorra%'
                OR LOWER(dv.nombre_producto) LIKE '%sombrero%' THEN dv.cantidad
              ELSE 0
            END) AS gorras,
            SUM(CASE
              WHEN LOWER(dv.nombre_producto) LIKE '%pava%' THEN dv.cantidad
              ELSE 0
            END) AS pavas,
            SUM(CASE
              WHEN LOWER(dv.nombre_producto) LIKE '%guante%' THEN dv.cantidad
              ELSE 0
            END) AS guantes,
            SUM(dv.cantidad) AS total_unidades,
            SUM(dv.precio_unitario * dv.cantidad) AS total_ventas,
            SUM(dv.valor_codigo * dv.cantidad) AS total_codigos,
            COUNT(DISTINCT v.id) AS cantidad_ventas
     FROM ventas v
     INNER JOIN detalle_ventas dv ON dv.venta_id = v.id
     WHERE ${productFilter}
     GROUP BY week_start
     ORDER BY week_start DESC`
  );

  const weeks = (
    summaryRows as {
      week_start: string | Date;
      gorras: number;
      pavas: number;
      guantes: number;
      total_unidades: number;
      total_ventas: number;
      total_codigos: number;
      cantidad_ventas: number;
    }[]
  ).map((row) => {
    const start = toIsoDate(row.week_start);
    const endDate = new Date(`${start}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    return {
      weekStart: start,
      weekEnd: endDate.toISOString().slice(0, 10),
      gorras: Number(row.gorras),
      pavas: Number(row.pavas),
      guantes: Number(row.guantes),
      totalUnidades: Number(row.total_unidades),
      totalVentas: Number(row.total_ventas),
      totalCodigos: Number(row.total_codigos),
      cantidadVentas: Number(row.cantidad_ventas),
    };
  });

  const endDate = new Date(`${selectedWeek}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 6);

  return {
    weekStart: selectedWeek,
    weekEnd: endDate.toISOString().slice(0, 10),
    items: (
      itemRows as {
        sale_id: number;
        item_id: number;
        fecha: string | Date;
        vendedor: string;
        sede: string;
        articulo: string;
        cantidad: number;
        precio_unitario: number;
        valor_codigo: number;
        metodo_pago: string;
        categoria: JoseProductCategory;
      }[]
    ).map((row) => ({
      saleId: row.sale_id,
      itemId: row.item_id,
      fecha: toIsoTimestamp(row.fecha),
      vendedor: row.vendedor,
      sede: row.sede,
      articulo: row.articulo,
      categoria: row.categoria,
      cantidad: Number(row.cantidad),
      precioUnitario: Number(row.precio_unitario),
      total: Number(row.precio_unitario) * Number(row.cantidad),
      totalCodigo: Number(row.valor_codigo) * Number(row.cantidad),
      metodoPago: row.metodo_pago,
    })),
    weeks,
  };
}
