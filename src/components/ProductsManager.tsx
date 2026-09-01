"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createProduct, updateProduct, setProductActive } from "@/actions/products";
import type { Producto } from "@/lib/types";

function formatCOP(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

interface ProductsManagerProps {
  productos: Producto[];
}

export function ProductsManager({ productos }: ProductsManagerProps) {
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [edicion, setEdicion] = useState({ nombre: "", precio: "", codigo: "" });

  function agregarProducto() {
    setMensaje(null);
    const precioNum = Number(precio);
    if (!nombre.trim() || !precioNum || precioNum <= 0) {
      setMensaje({ tipo: "error", texto: "Nombre y precio validos son obligatorios" });
      return;
    }
    startTransition(async () => {
      const resultado = await createProduct({
        nombre: nombre.trim(),
        precioBase: precioNum,
        codigoTiemple: Number(codigo || 0),
      });
      if (typeof resultado === "number") {
        setNombre("");
        setPrecio("");
        setCodigo("");
        setMensaje({ tipo: "ok", texto: "Producto agregado" });
      }
    });
  }

  function iniciarEdicion(producto: Producto) {
    setEditandoId(producto.id);
    setEdicion({
      nombre: producto.nombre,
      precio: String(producto.precio_base),
      codigo: String(producto.codigo_tiemple),
    });
  }

  function guardarEdicion(id: number) {
    startTransition(async () => {
      const resultado = await updateProduct({
        id,
        nombre: edicion.nombre.trim(),
        precioBase: Number(edicion.precio),
        codigoTiemple: Number(edicion.codigo || 0),
      });
      if (resultado.success) {
        setEditandoId(null);
      } else {
        setMensaje({ tipo: "error", texto: resultado.error ?? "No se pudo actualizar" });
      }
    });
  }

  function toggleActivo(id: number, activo: boolean) {
    startTransition(async () => {
      await setProductActive(id, !activo);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo Producto</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="nombre-producto">Nombre</Label>
            <Input id="nombre-producto" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="precio-producto">Precio</Label>
            <Input
              id="precio-producto"
              type="number"
              min={0}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="w-32"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="codigo-producto">Codigo (COP)</Label>
            <Input
              id="codigo-producto"
              type="number"
              min={0}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="w-32"
            />
          </div>
          <Button type="button" disabled={pending} onClick={agregarProducto} className="gap-1">
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
          <CardTitle>Catalogo de Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Codigo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos.map((producto) => {
                const enEdicion = editandoId === producto.id;
                return (
                  <TableRow key={producto.id}>
                    <TableCell>
                      {enEdicion ? (
                        <Input
                          value={edicion.nombre}
                          onChange={(e) => setEdicion((prev) => ({ ...prev, nombre: e.target.value }))}
                        />
                      ) : (
                        producto.nombre
                      )}
                    </TableCell>
                    <TableCell>
                      {enEdicion ? (
                        <Input
                          type="number"
                          value={edicion.precio}
                          onChange={(e) => setEdicion((prev) => ({ ...prev, precio: e.target.value }))}
                          className="w-28"
                        />
                      ) : (
                        formatCOP(producto.precio_base)
                      )}
                    </TableCell>
                    <TableCell>
                      {enEdicion ? (
                        <Input
                          type="number"
                          value={edicion.codigo}
                          onChange={(e) => setEdicion((prev) => ({ ...prev, codigo: e.target.value }))}
                          className="w-28"
                        />
                      ) : producto.codigo_tiemple > 0 ? (
                        formatCOP(producto.codigo_tiemple)
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={producto.activo ? "default" : "secondary"}>
                        {producto.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {enEdicion ? (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            disabled={pending}
                            onClick={() => guardarEdicion(producto.id)}
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" onClick={() => setEditandoId(null)}>
                            <X className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button type="button" size="icon" variant="outline" onClick={() => iniciarEdicion(producto)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => toggleActivo(producto.id, producto.activo)}
                          >
                            {producto.activo ? "Desactivar" : "Activar"}
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
