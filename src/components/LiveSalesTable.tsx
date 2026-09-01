"use client";

import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTodaySalesList } from "@/actions/sales";
import type { VentaFeedItem } from "@/actions/sales";

const POLL_MS = 4000;

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

export function LiveSalesTable() {
  const [ventas, setVentas] = useState<VentaFeedItem[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const data = await getTodaySalesList();
      if (!cancelado) setVentas(data);
    }
    cargar();
    intervalRef.current = setInterval(cargar, POLL_MS);
    return () => {
      cancelado = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="size-5" /> Ventas en Vivo (hoy)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ventas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no se han registrado ventas hoy</p>
        ) : (
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Articulo</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Codigo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.map((venta) => (
                  <TableRow key={venta.id}>
                    <TableCell>{formatFechaHora(venta.fecha)}</TableCell>
                    <TableCell>{venta.empleado}</TableCell>
                    <TableCell>{venta.sede}</TableCell>
                    <TableCell className="max-w-48 truncate" title={venta.articulos}>
                      {venta.articulos}
                    </TableCell>
                    <TableCell className="capitalize">{venta.metodoPago}</TableCell>
                    <TableCell className="max-w-40 truncate" title={venta.notasTransferencia ?? undefined}>
                      {venta.notasTransferencia ?? "-"}
                    </TableCell>
                    <TableCell>
                      {venta.totalCodigo > 0 ? (
                        <Badge variant="outline">{formatCOP(venta.totalCodigo)}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCOP(venta.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
