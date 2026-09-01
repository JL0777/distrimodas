"use server";

import { z } from "zod";
import type { PoolConnection } from "mysql2/promise";
import { revalidatePath } from "next/cache";
import { getPool } from "@/lib/db";
import type { Producto } from "@/lib/types";

// Busca productos activos cuyo nombre coincida con el texto (usado por el
// combobox de voz/texto del terminal de ventas). Limitado a 10 resultados.
export async function searchProducts(query: string): Promise<Producto[]> {
  const texto = query.trim();
  if (!texto) return [];

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, nombre, precio_base, codigo_tiemple, activo
     FROM productos
     WHERE activo = TRUE AND nombre LIKE ?
     ORDER BY nombre ASC
     LIMIT 10`,
    [`%${texto}%`]
  );
  return rows as Producto[];
}

const nuevoProductoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  precioBase: z.number().positive("El precio debe ser mayor a 0"),
  codigoTiemple: z.number().min(0).default(0),
});

export type NuevoProductoInput = z.infer<typeof nuevoProductoSchema>;

// Crea un producto nuevo "por debajo" cuando el empleado dicta/escribe un
// nombre que no existe todavia en el catalogo. Acepta una conexion opcional
// para poder participar en la transaccion de registro de venta.
export async function createProduct(
  input: NuevoProductoInput,
  conn?: PoolConnection
): Promise<number> {
  const data = nuevoProductoSchema.parse(input);

  const runner = conn ?? getPool();
  const [result] = await runner.query(
    `INSERT INTO productos (nombre, precio_base, codigo_tiemple, activo)
     VALUES (?, ?, ?, TRUE)`,
    [data.nombre, data.precioBase, data.codigoTiemple]
  );
  if (!conn) revalidatePath("/admin/productos");
  return (result as { insertId: number }).insertId;
}

// Lista TODOS los productos (activos e inactivos) para la gestion admin.
export async function listAllProducts(): Promise<Producto[]> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, nombre, precio_base, codigo_tiemple, activo
     FROM productos
     ORDER BY nombre ASC`
  );
  return rows as Producto[];
}

export interface ProductActionResult {
  success: boolean;
  error?: string;
}

const actualizarProductoSchema = z.object({
  id: z.number().int().positive(),
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  precioBase: z.number().positive("El precio debe ser mayor a 0"),
  codigoTiemple: z.number().min(0),
});

export type ActualizarProductoInput = z.infer<typeof actualizarProductoSchema>;

// Actualiza el nombre, precio base y codigo por defecto de un producto.
export async function updateProduct(input: ActualizarProductoInput): Promise<ProductActionResult> {
  const parsed = actualizarProductoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const pool = getPool();
  await pool.query(
    `UPDATE productos SET nombre = ?, precio_base = ?, codigo_tiemple = ? WHERE id = ?`,
    [parsed.data.nombre, parsed.data.precioBase, parsed.data.codigoTiemple, parsed.data.id]
  );
  revalidatePath("/admin/productos");
  return { success: true };
}

// Activa/desactiva un producto (no se elimina por las FK de detalle_ventas).
export async function setProductActive(id: number, activo: boolean): Promise<ProductActionResult> {
  const pool = getPool();
  await pool.query(`UPDATE productos SET activo = ? WHERE id = ?`, [activo, id]);
  revalidatePath("/admin/productos");
  return { success: true };
}

