"use client";

import { useState } from "react";
import { CalendarDays, CircleDollarSign, Loader2, ReceiptText, Users, Wallet } from "lucide-react";
import {
  getMoreLiquidaciones,
  type PayrollDashboardData,
  type LiquidacionRow,
} from "@/actions/payroll";
import { PayrollVoucherDialog } from "@/components/PayrollVoucherDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatCOP(value: number) {
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

interface PayrollDashboardProps {
  initialData: PayrollDashboardData;
}

export function PayrollDashboard({ initialData }: PayrollDashboardProps) {
  const [liquidaciones, setLiquidaciones] = useState(initialData.liquidaciones);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const nextPage: LiquidacionRow[] = await getMoreLiquidaciones(liquidaciones.length);
      setLiquidaciones((current) => [...current, ...nextPage]);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el resto del historial de nómina."
      );
    } finally {
      setLoading(false);
    }
  }

  const hasMore = liquidaciones.length < initialData.diasLiquidados;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Administración</p>
        <h1 className="page-heading mt-1">Nómina</h1>
        <p className="page-subtitle">Resumen de pagos diarios y detalle del cálculo de cada liquidación.</p>
      </header>

      <section aria-label="Resumen de nómina" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-emerald-100 bg-[linear-gradient(145deg,#ffffff,#f0faf5)]">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total pagado</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-800">
                {formatCOP(initialData.totalPagado)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Suma de los pagos a empleados registrados</p>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
              <CircleDollarSign className="size-6" />
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Días liquidados</p>
              <p className="mt-2 text-2xl font-bold tracking-tight">{initialData.diasLiquidados}</p>
              <p className="mt-1 text-xs text-muted-foreground">Días con cierre de nómina</p>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <CalendarDays className="size-6" />
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Promedio pagado por día</p>
              <p className="mt-2 text-2xl font-bold tracking-tight">{formatCOP(initialData.promedioDiario)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Promedio sobre los días liquidados</p>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-700">
              <Wallet className="size-6" />
            </span>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="size-5 text-primary" />
            Historial de pagos por día
          </CardTitle>
          <CardDescription>
            Se muestran primero las 10 liquidaciones más recientes. Puedes cargar las anteriores cuando las necesites.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Empleados</TableHead>
                <TableHead className="text-right">Códigos</TableHead>
                <TableHead className="text-right">Ventas netas</TableHead>
                <TableHead className="text-right">Pago por empleado</TableHead>
                <TableHead>Pagados</TableHead>
                <TableHead className="text-right">Total del día</TableHead>
                <TableHead className="text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liquidaciones.map((liquidacion) => (
                <TableRow key={liquidacion.id}>
                  <TableCell className="whitespace-nowrap font-medium">{formatDate(liquidacion.fecha)}</TableCell>
                  <TableCell className="text-right">{liquidacion.asistentesCount}</TableCell>
                  <TableCell className="text-right">{formatCOP(liquidacion.totalTiemple)}</TableCell>
                  <TableCell className="text-right">{formatCOP(liquidacion.totalNetas)}</TableCell>
                  <TableCell className="text-right">{formatCOP(liquidacion.pagoPorEmpleado)}</TableCell>
                  <TableCell>
                    <div className="flex max-w-sm flex-wrap gap-1">
                      {liquidacion.empleados.map((nombre) => (
                        <Badge key={nombre} variant="outline">{nombre}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCOP(liquidacion.totalNomina)}</TableCell>
                  <TableCell className="text-right">
                    <PayrollVoucherDialog liquidacionId={liquidacion.id} />
                  </TableCell>
                </TableRow>
              ))}
              {liquidaciones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Users className="mx-auto mb-2 size-6 opacity-50" />
                    Todavía no hay liquidaciones registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {hasMore && (
            <div className="flex flex-col items-center gap-2 border-t pt-4">
              <Button type="button" variant="outline" className="min-w-48 gap-2" disabled={loading} onClick={loadMore}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {loading ? "Cargando..." : "Cargar más liquidaciones"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Mostrando {liquidaciones.length} de {initialData.diasLiquidados} días
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
