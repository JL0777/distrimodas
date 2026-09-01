"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getTodaySalesSummary, closeDayPayroll } from "@/actions/payroll";
import { calcularLiquidacion } from "@/lib/payroll";
import type { Empleado } from "@/lib/types";

function formatCOP(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

interface CloseDayModalProps {
  empleados: Empleado[];
  yaLiquidadoInicial?: boolean;
}

export function CloseDayModal({ empleados, yaLiquidadoInicial = false }: CloseDayModalProps) {
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [resumen, setResumen] = useState<{
    totalTiemple: number;
    totalNetas: number;
    yaLiquidado: boolean;
    empleadosLiquidados: number[];
  } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    async function cargarResumen() {
      setCargando(true);
      setMensaje(null);
      try {
        const data = await getTodaySalesSummary();
        if (!cancelado) {
          setResumen(data);
          setSeleccionados(new Set(data.empleadosLiquidados));
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    cargarResumen();
    return () => {
      cancelado = true;
    };
  }, [open]);

  function toggleEmpleado(id: number) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const preview = resumen
    ? calcularLiquidacion(resumen.totalTiemple, resumen.totalNetas, seleccionados.size)
    : null;

  async function confirmarLiquidacion() {
    setMensaje(null);
    if (seleccionados.size === 0) {
      setMensaje({ tipo: "error", texto: "Selecciona al menos un empleado asistente" });
      return;
    }
    setEnviando(true);
    try {
      const resultado = await closeDayPayroll(Array.from(seleccionados), resumen?.yaLiquidado ?? false);
      if (resultado.success) {
        setMensaje({ tipo: "ok", texto: "Liquidacion del dia guardada correctamente" });
        setResumen((prev) => (prev ? { ...prev, yaLiquidado: true, empleadosLiquidados: Array.from(seleccionados) } : prev));
      } else {
        setMensaje({ tipo: "error", texto: resultado.error ?? "No se pudo liquidar el dia" });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="secondary">{yaLiquidadoInicial ? "Recalcular Liquidacion" : "Cierre de Dia"}</Button>}
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cierre de Dia - Liquidacion de Nomina</DialogTitle>
          <DialogDescription>
            Selecciona los empleados que asistieron hoy en ambas sedes para calcular el pago.
          </DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Cargando ventas del dia...
          </div>
        )}

        {!cargando && resumen && (
          <>
            {resumen.yaLiquidado && (
              <p className="rounded-md bg-muted p-3 text-sm">
                El dia de hoy ya fue liquidado. Puedes ajustar los asistentes y recalcular; esto reemplazara la
                liquidacion existente.
              </p>
            )}

            <ScrollArea className="h-56 rounded-md border p-2">
              <ul className="space-y-1">
                {empleados.map((empleado) => (
                  <li key={empleado.id}>
                    <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                      <Checkbox
                        checked={seleccionados.has(empleado.id)}
                        onCheckedChange={() => toggleEmpleado(empleado.id)}
                      />
                      {empleado.nombre}
                    </label>
                  </li>
                ))}
              </ul>
            </ScrollArea>

            <Separator />

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Asistentes</span>
                <span>{preview?.asistentesCount ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Codigos (tiemple)</span>
                <span>{formatCOP(resumen.totalTiemple)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Ventas Netas</span>
                <span>{formatCOP(resumen.totalNetas)}</span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span>Pago por empleado</span>
                <span>{formatCOP(preview?.pagoTotalPorEmpleado ?? 0)}</span>
              </div>
            </div>

            {mensaje && (
              <p className={mensaje.tipo === "ok" ? "text-sm text-green-600" : "text-sm text-destructive"}>
                {mensaje.texto}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                className="w-full"
                disabled={enviando || seleccionados.size === 0}
                onClick={confirmarLiquidacion}
              >
                {enviando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : resumen.yaLiquidado ? (
                  "Recalcular Liquidacion"
                ) : (
                  "Confirmar Liquidacion"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
