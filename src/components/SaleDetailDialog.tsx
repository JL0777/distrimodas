"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { getSaleDetail } from "@/actions/sales";
import type { VentaDetalle } from "@/actions/sales";

function formatCOP(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatFechaHora(fecha: string) {
  return new Date(fecha).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

interface SaleDetailDialogProps {
  ventaId: number | null;
  onOpenChange: (open: boolean) => void;
}

export function SaleDetailDialog({ ventaId, onOpenChange }: SaleDetailDialogProps) {
  const [detalle, setDetalle] = useState<VentaDetalle | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (ventaId === null) return;
    let cancelado = false;
    async function cargar() {
      setCargando(true);
      try {
        const data = await getSaleDetail(ventaId!);
        if (!cancelado) setDetalle(data);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [ventaId]);

  return (
    <Dialog open={ventaId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalle de la Venta #{ventaId}</DialogTitle>
          <DialogDescription>Productos, cantidades y codigos de esta venta</DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Cargando...
          </div>
        )}

        {!cargando && detalle && (
          <>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendedor</span>
                <span>{detalle.empleado}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sede</span>
                <span>{detalle.sede}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha</span>
                <span>{formatFechaHora(detalle.fecha)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Metodo de pago</span>
                <span className="capitalize">{detalle.metodoPago}</span>
              </div>
              {detalle.notasTransferencia && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Notas transferencia</span>
                  <span className="text-right">{detalle.notasTransferencia}</span>
                </div>
              )}
            </div>

            <Separator />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cant.</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Codigo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalle.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.productoNombre}</TableCell>
                    <TableCell>{item.cantidad}</TableCell>
                    <TableCell>{formatCOP(item.precioUnitario)}</TableCell>
                    <TableCell>
                      {item.valorCodigo > 0 ? (
                        <Badge variant="outline">{formatCOP(item.valorCodigo)}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Venta neta</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-between border-t pt-3 text-sm font-semibold">
              <span>Total</span>
              <span>{formatCOP(detalle.total)}</span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
