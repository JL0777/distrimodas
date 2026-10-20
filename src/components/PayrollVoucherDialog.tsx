"use client";

import { useState } from "react";
import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Landmark,
  Loader2,
  ReceiptText,
  Users,
} from "lucide-react";
import { getLiquidacionDetalle, type LiquidacionDetalle } from "@/actions/payroll";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

function formatCOP(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatFecha(fecha: string) {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const METODOS = {
  efectivo: { label: "Efectivo", icon: Banknote },
  tarjeta: { label: "Tarjeta", icon: CreditCard },
  transferencia: { label: "Transferencia", icon: Landmark },
} as const;

interface PayrollVoucherDialogProps {
  liquidacionId: number;
}

export function PayrollVoucherDialog({ liquidacionId }: PayrollVoucherDialogProps) {
  const [open, setOpen] = useState(false);
  const [detalle, setDetalle] = useState<LiquidacionDetalle | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function abrirVoucher() {
    setOpen(true);
    setCargando(true);
    setError(null);
    try {
      const resultado = await getLiquidacionDetalle(liquidacionId);
      if (!resultado) {
        setDetalle(null);
        setError("No se encontró el detalle de esta liquidación.");
        return;
      }
      setDetalle(resultado);
    } catch (err) {
      setDetalle(null);
      setError(
        err instanceof Error
          ? `No fue posible cargar el voucher: ${err.message}`
          : "No fue posible cargar el voucher. Intenta nuevamente."
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" size="sm" variant="outline" className="gap-2" onClick={abrirVoucher}>
        <ReceiptText className="size-4" />
        Ver voucher
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="mb-1 grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ReceiptText className="size-5" />
          </div>
          <DialogTitle>Comprobante de liquidación</DialogTitle>
          <DialogDescription>Resumen de ventas y pagos del día liquidado.</DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando voucher...
          </div>
        )}

        {!cargando && error && (
          <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </p>
        )}

        {!cargando && detalle && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-[linear-gradient(110deg,#fff7f8,#ffffff_65%,#f4faf7)] p-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">
                  Distrimodas La Sexta
                </p>
                <p className="mt-1 text-lg font-bold">Liquidación #{detalle.id}</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white bg-white/80 px-3 py-2 text-sm text-muted-foreground shadow-sm">
                <CalendarDays className="size-4 text-primary" />
                <span className="capitalize">{formatFecha(detalle.fecha)}</span>
              </div>
            </div>

            <section aria-label="Resumen de ventas" className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 sm:col-span-2">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                  <CircleDollarSign className="size-4" />
                  Venta total del día
                </div>
                <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-900">
                  {formatCOP(detalle.totalVentas)}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Landmark className="size-4 text-primary" />
                  Ventas por sede
                </h3>
                {detalle.ventasPorSede.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No se registraron ventas este día.</p>
                ) : (
                  <ul className="space-y-3">
                    {detalle.ventasPorSede.map((sede) => (
                      <li key={sede.sede} className="flex items-start justify-between gap-3 text-sm">
                        <span className="min-w-0">
                          <span className="block font-medium">{sede.sede}</span>
                          <span className="text-xs text-muted-foreground">
                            {sede.cantidadVentas} {sede.cantidadVentas === 1 ? "venta" : "ventas"}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold">{formatCOP(sede.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <CreditCard className="size-4 text-primary" />
                  Ingresos por método
                </h3>
                <ul className="space-y-3">
                  {detalle.ventasPorMetodo.map(({ metodoPago, total }) => {
                    const MetodoIcon = METODOS[metodoPago].icon;
                    return (
                      <li key={metodoPago} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <MetodoIcon className="size-4" />
                          {METODOS[metodoPago].label}
                        </span>
                        <span className="font-semibold text-foreground">{formatCOP(total)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>

            <section className="rounded-2xl border border-rose-100 bg-rose-50/45 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Users className="size-4 text-primary" />
                    Nómina pagada
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {detalle.asistentesCount} {detalle.asistentesCount === 1 ? "empleado" : "empleados"}
                    {" · "}
                    {formatCOP(detalle.pagoPorEmpleado)} por empleado
                  </p>
                </div>
                <Badge className="bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary">
                  {formatCOP(detalle.totalNomina)}
                </Badge>
              </div>
              <Separator className="my-4" />
              {detalle.pagosEmpleados.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay pagos individuales asociados.</p>
              ) : (
                <ul className="space-y-2">
                  {detalle.pagosEmpleados.map((empleado) => (
                    <li
                      key={empleado.empleadoId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="font-medium">{empleado.empleado}</span>
                      <span className="font-semibold">{formatCOP(empleado.pagoTotal)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="flex flex-wrap justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
              <span>Total códigos: {formatCOP(detalle.totalTiemple)}</span>
              <span>Total ventas netas: {formatCOP(detalle.totalNetas)}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
