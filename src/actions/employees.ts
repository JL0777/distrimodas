"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getPool } from "@/lib/db";
import type { Empleado } from "@/lib/types";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.rol !== "admin") {
    throw new Error("No tienes permisos para administrar vendedores.");
  }
}

// Lista los empleados activos de ambas sedes (para el dropdown de vendedor
// del terminal de ventas y el checklist del cierre de dia).
export async function listActiveEmployees(): Promise<Empleado[]> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT e.id, e.nombre, e.sede_id, e.activo, s.nombre AS sede_nombre
     FROM empleados e
     INNER JOIN sedes s ON s.id = e.sede_id
     WHERE e.activo = TRUE
     ORDER BY e.nombre ASC`
  );
  return rows as Empleado[];
}

// Lista TODOS los empleados (activos e inactivos) para la gestion admin.
export async function listAllEmployees(): Promise<Empleado[]> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, nombre, sede_id, activo FROM empleados ORDER BY nombre ASC`
  );
  return rows as Empleado[];
}

const nuevoEmpleadoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  sedeId: z.number().int().positive(),
});

export type NuevoEmpleadoInput = z.infer<typeof nuevoEmpleadoSchema>;

export interface EmployeeActionResult {
  success: boolean;
  error?: string;
}

// Crea un nuevo empleado (vendedor) asignado a una sede.
export async function createEmployee(input: NuevoEmpleadoInput): Promise<EmployeeActionResult> {
  await requireAdmin();
  const parsed = nuevoEmpleadoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const pool = getPool();
  await pool.query(`INSERT INTO empleados (nombre, sede_id, activo) VALUES (?, ?, TRUE)`, [
    parsed.data.nombre,
    parsed.data.sedeId,
  ]);
  revalidatePath("/admin/vendedores");
  return { success: true };
}

// Activa/desactiva un empleado (no se eliminan por las FK de ventas/liquidaciones).
export async function setEmployeeActive(id: number, activo: boolean): Promise<EmployeeActionResult> {
  await requireAdmin();
  const parsedId = z.number().int().positive().safeParse(id);
  const parsedActivo = z.boolean().safeParse(activo);
  if (!parsedId.success || !parsedActivo.success) {
    return { success: false, error: "El vendedor seleccionado no es válido." };
  }
  const pool = getPool();
  const [result] = await pool.query(`UPDATE empleados SET activo = ? WHERE id = ?`, [
    parsedActivo.data,
    parsedId.data,
  ]);
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { success: false, error: "No se encontró el vendedor seleccionado." };
  }
  revalidatePath("/admin/vendedores");
  return { success: true };
}

const actualizarNombreEmpleadoSchema = z.object({
  id: z.number().int().positive(),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(150, "El nombre es demasiado largo."),
});

export async function updateEmployeeName(input: {
  id: number;
  nombre: string;
}): Promise<EmployeeActionResult> {
  await requireAdmin();
  const parsed = actualizarNombreEmpleadoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const pool = getPool();
  const [employeeRows] = await pool.query(`SELECT id FROM empleados WHERE id = ? LIMIT 1`, [
    parsed.data.id,
  ]);
  if ((employeeRows as { id: number }[]).length === 0) {
    return { success: false, error: "No se encontró el vendedor seleccionado." };
  }
  await pool.query(`UPDATE empleados SET nombre = ? WHERE id = ?`, [
    parsed.data.nombre,
    parsed.data.id,
  ]);

  revalidatePath("/admin/vendedores");
  revalidatePath("/vendedor");
  return { success: true };
}
