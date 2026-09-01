"use client";

import { useEffect, useRef, useState } from "react";
import { ListOrdered, Eye, Trash2, Loader2, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getTodaySalesList, deleteSale } from "@/actions/sales";
import type { VentaFeedItem } from "@/actions/sales";
import { SaleDetailDialog } from "@/components/SaleDetailDialog";

const POLL_MS = 4000;

function formatCOP(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatHora(fecha: string) {
  return new Date(fecha).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

interface SalesFeedProps {
  refreshSignal: number;
}

export function SalesFeed({ refreshSignal }: SalesFeedProps) {
  const [ventas, setVentas] = useState<VentaFeedItem[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [confirmarId, setConfirmarId] = useState<number | null>(null);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

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
  }, [refreshSignal]);

  async function confirmarEliminar(id: number) {
    setErrorEliminar(null);
    setEliminandoId(id);
    try {
      const resultado = await deleteSale(id);
      if (resultado.success) {
        setVentas((prev) => prev.filter((v) => v.id !== id));
      } else {
        setErrorEliminar(resultado.error ?? "No se pudo eliminar la venta");
      }
    } finally {
      setEliminandoId(null);
      setConfirmarId(null);
    }
  }

  const totalHoy = ventas.reduce((acc, venta) => acc + venta.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ListOrdered className="size-5" /> Ventas de Hoy
          </span>
          <Badge variant="secondary">{formatCOP(totalHoy)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {errorEliminar && <p className="mb-2 text-sm text-destructive">{errorEliminar}</p>}
        {ventas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no se han registrado ventas hoy</p>
        ) : (
          <ScrollArea className="h-[28rem]">
            <ul className="space-y-2 pr-2">
              {ventas.map((venta) => (
                <li key={venta.id} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{venta.empleado}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatHora(venta.fecha)} · {venta.sede} · {venta.metodoPago}
                      </p>
                      <p className="truncate text-xs text-muted-foreground" title={venta.articulos}>
                        {venta.articulos}
                      </p>
                      {venta.totalCodigo > 0 && (
                        <Badge variant="outline" className="mt-1">
                          Codigo {formatCOP(venta.totalCodigo)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="font-semibold">{formatCOP(venta.total)}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Ver detalle"
                        onClick={() => setDetalleId(venta.id)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      {confirmarId === venta.id ? (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            title="Confirmar eliminar"
                            disabled={eliminandoId === venta.id}
                            onClick={() => confirmarEliminar(venta.id)}
                          >
                            {eliminandoId === venta.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Check className="size-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Cancelar"
                            onClick={() => setConfirmarId(null)}
                          >
                            <X className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Eliminar venta"
                          onClick={() => setConfirmarId(venta.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>

      <SaleDetailDialog ventaId={detalleId} onOpenChange={(open) => !open && setDetalleId(null)} />
    </Card>
  );
}
