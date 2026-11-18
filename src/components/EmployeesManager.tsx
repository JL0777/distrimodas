"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createEmployee, setEmployeeActive, updateEmployeeName } from "@/actions/employees";
import type { Empleado, Sede } from "@/lib/types";

interface EmployeesManagerProps {
  empleados: Empleado[];
  sedes: Sede[];
}

export function EmployeesManager({ empleados, sedes }: EmployeesManagerProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [sedeId, setSedeId] = useState<string>(sedes[0] ? String(sedes[0].id) : "");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [pending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  function agregarEmpleado() {
    setMensaje(null);
    if (!nombre.trim() || !sedeId) {
      setMensaje({ tipo: "error", texto: "Nombre y sede son obligatorios." });
      return;
    }
    startTransition(async () => {
      const resultado = await createEmployee({ nombre: nombre.trim(), sedeId: Number(sedeId) });
      if (resultado.success) {
        setNombre("");
        setMensaje({ tipo: "ok", texto: "Vendedor agregado correctamente." });
        router.refresh();
      } else {
        setMensaje({ tipo: "error", texto: resultado.error ?? "No se pudo agregar el vendedor." });
      }
    });
  }

  function iniciarEdicion(empleado: Empleado) {
    setMensaje(null);
    setEditandoId(empleado.id);
    setNombreEditado(empleado.nombre);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setNombreEditado("");
  }

  function guardarNombre(id: number) {
    setMensaje(null);
    if (!nombreEditado.trim()) {
      setMensaje({ tipo: "error", texto: "El nombre es obligatorio." });
      return;
    }
    startTransition(async () => {
      const resultado = await updateEmployeeName({ id, nombre: nombreEditado.trim() });
      if (resultado.success) {
        cancelarEdicion();
        setMensaje({ tipo: "ok", texto: "Nombre actualizado correctamente." });
        router.refresh();
      } else {
        setMensaje({ tipo: "error", texto: resultado.error ?? "No se pudo actualizar el nombre." });
      }
    });
  }

  function toggleActivo(id: number, activo: boolean) {
    setMensaje(null);
    startTransition(async () => {
      const resultado = await setEmployeeActive(id, !activo);
      if (resultado.success) {
        setMensaje({ tipo: "ok", texto: `Vendedor ${activo ? "desactivado" : "activado"} correctamente.` });
        router.refresh();
      } else {
        setMensaje({ tipo: "error", texto: resultado.error ?? "No se pudo cambiar el estado." });
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-5 text-primary" />
            Nuevo vendedor
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="nombre-empleado">Nombre</Label>
            <Input
              id="nombre-empleado"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ej: MARIA TORRES"
              maxLength={150}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sede-empleado">Sede</Label>
            <Select value={sedeId} onValueChange={(value) => setSedeId(value ?? "")}>
              <SelectTrigger id="sede-empleado" className="w-full sm:w-56">
                <SelectValue placeholder="Selecciona la sede" />
              </SelectTrigger>
              <SelectContent>
                {sedes.map((sede) => (
                  <SelectItem key={sede.id} value={String(sede.id)}>
                    {sede.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" disabled={pending} onClick={agregarEmpleado} className="gap-1">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Agregar
          </Button>
        </CardContent>
      </Card>

      {mensaje && (
        <p
          role={mensaje.tipo === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            mensaje.tipo === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-destructive/20 bg-destructive/5 text-destructive"
          }`}
        >
          {mensaje.texto}
        </p>
      )}

      <div className="grid items-start gap-5 md:grid-cols-2">
        {sedes.map((sede) => {
          const vendedoresSede = empleados.filter((empleado) => empleado.sede_id === sede.id);
          return (
            <Card key={sede.id} className="min-w-0">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2 className="size-5 shrink-0 text-primary" />
                    <span className="truncate">{sede.nombre}</span>
                  </span>
                  <Badge variant="secondary">{vendedoresSede.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {vendedoresSede.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                    <p className="text-sm font-medium text-slate-700">Aún no hay vendedores</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Los vendedores nuevos de esta sede aparecerán aquí.
                    </p>
                  </div>
                ) : (
                  vendedoresSede.map((empleado) => {
                    const editando = editandoId === empleado.id;
                    return (
                      <div
                        key={empleado.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          {editando ? (
                            <Input
                              autoFocus
                              aria-label={`Editar nombre de ${empleado.nombre}`}
                              value={nombreEditado}
                              onChange={(event) => setNombreEditado(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") guardarNombre(empleado.id);
                                if (event.key === "Escape") cancelarEdicion();
                              }}
                              maxLength={150}
                              className="h-10"
                            />
                          ) : (
                            <p className="truncate font-semibold text-slate-900">{empleado.nombre}</p>
                          )}
                          <div className="mt-1.5">
                            <Badge
                              variant={empleado.activo ? "default" : "secondary"}
                              className={empleado.activo ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : ""}
                            >
                              {empleado.activo ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center justify-end gap-2">
                          {editando ? (
                            <>
                              <Button
                                type="button"
                                size="icon"
                                aria-label="Guardar nombre"
                                title="Guardar nombre"
                                disabled={pending}
                                onClick={() => guardarNombre(empleado.id)}
                                className="bg-emerald-700 hover:bg-emerald-800"
                              >
                                {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                aria-label="Cancelar edición"
                                title="Cancelar edición"
                                disabled={pending}
                                onClick={cancelarEdicion}
                              >
                                <X className="size-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                aria-label={`Editar nombre de ${empleado.nombre}`}
                                title="Editar nombre"
                                disabled={pending}
                                onClick={() => iniciarEdicion(empleado)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() => toggleActivo(empleado.id, empleado.activo)}
                              >
                                {empleado.activo ? "Desactivar" : "Activar"}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
