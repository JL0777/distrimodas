"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createEmployee, setEmployeeActive } from "@/actions/employees";
import type { Empleado, Sede } from "@/lib/types";

interface EmployeesManagerProps {
  empleados: Empleado[];
  sedes: Sede[];
}

export function EmployeesManager({ empleados, sedes }: EmployeesManagerProps) {
  const [nombre, setNombre] = useState("");
  const [sedeId, setSedeId] = useState<string>(sedes[0] ? String(sedes[0].id) : "");
  const [pending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  function sedeNombre(id: number) {
    return sedes.find((s) => s.id === id)?.nombre ?? "-";
  }

  function agregarEmpleado() {
    setMensaje(null);
    if (!nombre.trim() || !sedeId) {
      setMensaje({ tipo: "error", texto: "Nombre y sede son obligatorios" });
      return;
    }
    startTransition(async () => {
      const resultado = await createEmployee({ nombre: nombre.trim(), sedeId: Number(sedeId) });
      if (resultado.success) {
        setNombre("");
        setMensaje({ tipo: "ok", texto: "Empleado agregado" });
      } else {
        setMensaje({ tipo: "error", texto: resultado.error ?? "No se pudo agregar" });
      }
    });
  }

  function toggleActivo(id: number, activo: boolean) {
    startTransition(async () => {
      await setEmployeeActive(id, !activo);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo Vendedor</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="nombre-empleado">Nombre</Label>
            <Input
              id="nombre-empleado"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Maria Torres"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sede</Label>
            <Select value={sedeId} onValueChange={(v) => setSedeId(v ?? "")}>
              <SelectTrigger className="w-full sm:w-56">
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
        {mensaje && (
          <CardContent className="pt-0">
            <p className={mensaje.tipo === "ok" ? "text-sm text-green-600" : "text-sm text-destructive"}>
              {mensaje.texto}
            </p>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendedores</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Accion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empleados.map((empleado) => (
                <TableRow key={empleado.id}>
                  <TableCell>{empleado.nombre}</TableCell>
                  <TableCell>{sedeNombre(empleado.sede_id)}</TableCell>
                  <TableCell>
                    <Badge variant={empleado.activo ? "default" : "secondary"}>
                      {empleado.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => toggleActivo(empleado.id, empleado.activo)}
                    >
                      {empleado.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
