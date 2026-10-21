"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, CircleDashed, CircleDollarSign, Eye, Radio, Shirt, Tags } from "lucide-react";
import { getJoseWeeklyReport, type JoseWeeklyReport } from "@/actions/jose-sales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const POLL_MS = 30000;

function formatCOP(value: number) {
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string) {
  const bogotaTime = new Date(new Date(value).getTime() - 5 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  const day = pad(bogotaTime.getUTCDate());
  const month = pad(bogotaTime.getUTCMonth() + 1);
  const year = String(bogotaTime.getUTCFullYear()).slice(-2);
  const hour = pad(bogotaTime.getUTCHours());
  const minute = pad(bogotaTime.getUTCMinutes());

  return `${day}/${month}/${year}, ${hour}:${minute}`;
}

function formatWeek(start: string, end: string) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function categoryLabel(category: string) {
  if (category === "gorra") return "Gorra / sombrero";
  if (category === "pava") return "Pava";
  return "Guante";
}

function getSummary(report: JoseWeeklyReport) {
  return report.weeks.find((week) => week.weekStart === report.weekStart) ?? {
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
    gorras: 0,
    pavas: 0,
    guantes: 0,
    totalUnidades: 0,
    totalVentas: 0,
    totalCodigos: 0,
    cantidadVentas: 0,
  };
}

interface JoseSalesReportProps {
  initialReport: JoseWeeklyReport;
  view: "current" | "history";
}

export function JoseSalesReport({ initialReport, view }: JoseSalesReportProps) {
  const [report, setReport] = useState(initialReport);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(initialReport.weekStart);
  const [tableLoading, setTableLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailReport, setDetailReport] = useState<JoseWeeklyReport | null>(null);
  const isCurrent = view === "current";
  const summary = getSummary(report);

  async function openWeekDetail(weekStart: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailReport(null);

    try {
      const result = await getJoseWeeklyReport(weekStart);
      setDetailReport(result);
    } catch (detailLoadError) {
      setDetailError(
        detailLoadError instanceof Error
          ? detailLoadError.message
          : "No fue posible cargar el detalle de esta semana."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const nextReport = await getJoseWeeklyReport(isCurrent ? undefined : selectedWeek);
        if (!cancelled) {
          setReport(nextReport);
          setError(null);
          setLastUpdated(new Date());
          setTableLoading(false);
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : "No fue posible actualizar el reporte."
          );
          setTableLoading(false);
        }
      }
    }

    void refresh();
    const intervalId = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [selectedWeek, isCurrent]);

  const cards = [
    { title: "Unidades vendidas", value: summary.totalUnidades.toLocaleString("es-CO"), icon: Shirt },
    { title: "Total en códigos", value: formatCOP(summary.totalCodigos), icon: Tags },
    { title: "Total vendido", value: formatCOP(summary.totalVentas), icon: CircleDollarSign },
    { title: "Ventas con artículos", value: summary.cantidadVentas.toLocaleString("es-CO"), icon: Radio },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-primary">Reporte de productos del socio</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {isCurrent ? "Semana actual" : "Historial semanal"}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            {formatWeek(report.weekStart, report.weekEnd)}
            <span>· lunes a domingo</span>
          </p>
        </div>
        <div aria-live="polite" className="text-xs text-muted-foreground">
          {lastUpdated ? (
            <>Actualizado {lastUpdated.toLocaleTimeString("es-CO", { timeZone: "America/Bogota" })}</>
          ) : (
            <>Actualización automática cada 30 segundos</>
          )}
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          No se pudo actualizar el reporte: {error}
        </p>
      )}

      {isCurrent ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ title, value, icon: Icon }) => (
            <Card key={title} className="border-border/70 shadow-sm">
              <CardContent className="flex items-center justify-between gap-3 p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{title}</p>
                  <p className="mt-2 text-xl font-bold tracking-tight">{value}</p>
                </div>
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Semanas registradas</CardTitle>
            <CardDescription>
              Resumen de gorra/sombrero, pava y guante por cada semana de lunes a domingo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.weeks.length === 0 ? (
              <div className="rounded-2xl border border-dashed py-12 text-center">
                <CalendarDays className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">Todavía no hay semanas con estos artículos.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Semana</TableHead>
                    <TableHead className="text-right">Gorras / sombreros</TableHead>
                    <TableHead className="text-right">Pavas</TableHead>
                    <TableHead className="text-right">Guantes</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Códigos</TableHead>
                    <TableHead className="text-right">Total vendido</TableHead>
                    <TableHead className="text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.weeks.map((week) => (
                    <TableRow key={week.weekStart}>
                      <TableCell className="font-medium">{formatWeek(week.weekStart, week.weekEnd)}</TableCell>
                      <TableCell className="text-right">{week.gorras}</TableCell>
                      <TableCell className="text-right">{week.pavas}</TableCell>
                      <TableCell className="text-right">{week.guantes}</TableCell>
                      <TableCell className="text-right font-semibold">{week.totalUnidades}</TableCell>
                      <TableCell className="text-right">{formatCOP(week.totalCodigos)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCOP(week.totalVentas)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          aria-label={`Ver todos los artículos de la semana ${formatWeek(week.weekStart, week.weekEnd)}`}
                          onClick={() => void openWeekDetail(week.weekStart)}
                        >
                          <Eye className="size-4" />
                          Ver artículos
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card id="detalle-semana" className="border-border/70 shadow-sm">
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <CardTitle>
                {isCurrent
                  ? "Artículos vendidos esta semana"
                  : `Artículos vendidos · ${formatWeek(report.weekStart, report.weekEnd)}`}
              </CardTitle>
              <CardDescription className="mt-2">
                Incluye registros de ambas sedes. Se excluyen guantes de cocina y gorras de cocina.
              </CardDescription>
            </div>
            {!isCurrent && (
              <div className="grid gap-1.5 sm:min-w-64">
                <label htmlFor="filtro-semana-articulos" className="text-xs font-semibold text-muted-foreground">
                  Filtrar artículos por semana
                </label>
                <select
                  id="filtro-semana-articulos"
                  value={selectedWeek}
                  onChange={(event) => {
                    setSelectedWeek(event.target.value);
                    setTableLoading(true);
                  }}
                  className="h-10 rounded-xl border border-input bg-white px-3 text-sm shadow-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                >
                  {!report.weeks.some((week) => week.weekStart === selectedWeek) && (
                    <option value={selectedWeek}>
                      {formatWeek(selectedWeek, report.weekEnd)}
                    </option>
                  )}
                  {report.weeks.map((week) => (
                    <option key={week.weekStart} value={week.weekStart}>
                      {formatWeek(week.weekStart, week.weekEnd)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {!isCurrent && (
            <Link
              href="/jose/historial"
              className="mt-2 inline-flex w-fit items-center rounded-lg px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              Volver a todas las semanas
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {tableLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <CircleDashed className="size-5 animate-spin" />
              Cargando artículos de la semana...
            </div>
          ) : report.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-12 text-center">
              <CircleDashed className="mx-auto size-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">Aún no hay artículos incluidos para esta semana.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Venta</TableHead>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Método de pago</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio unitario</TableHead>
                  <TableHead className="text-right">Códigos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.items.map((item) => (
                  <TableRow key={`${item.saleId}-${item.itemId}`}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(item.fecha)}</TableCell>
                    <TableCell>#{item.saleId}</TableCell>
                    <TableCell className="font-medium">{item.articulo}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{categoryLabel(item.categoria)}</Badge>
                    </TableCell>
                    <TableCell>{item.vendedor}</TableCell>
                    <TableCell>{item.sede}</TableCell>
                    <TableCell className="capitalize">{item.metodoPago}</TableCell>
                    <TableCell className="text-right">{item.cantidad}</TableCell>
                    <TableCell className="text-right">{formatCOP(item.precioUnitario)}</TableCell>
                    <TableCell className="text-right">{formatCOP(item.totalCodigo)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCOP(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-7xl">
          <DialogHeader>
            <DialogTitle>
              {detailReport
                ? `Artículos vendidos · ${formatWeek(detailReport.weekStart, detailReport.weekEnd)}`
                : "Detalle de artículos por semana"}
            </DialogTitle>
            <DialogDescription>
              Ventas de ambas sedes, con vendedor, fecha, hora, códigos y valor vendido.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <CircleDashed className="size-5 animate-spin" />
              Cargando artículos de la semana...
            </div>
          ) : detailError ? (
            <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              No fue posible abrir el detalle: {detailError}
            </p>
          ) : detailReport?.items.length ? (
            <div className="max-h-[65vh] overflow-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha y hora</TableHead>
                    <TableHead>Venta</TableHead>
                    <TableHead>Artículo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio unitario</TableHead>
                    <TableHead className="text-right">Códigos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailReport.items.map((item) => (
                    <TableRow key={`${item.saleId}-${item.itemId}`}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(item.fecha)}</TableCell>
                      <TableCell>#{item.saleId}</TableCell>
                      <TableCell className="font-medium">{item.articulo}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{categoryLabel(item.categoria)}</Badge>
                      </TableCell>
                      <TableCell>{item.vendedor}</TableCell>
                      <TableCell>{item.sede}</TableCell>
                      <TableCell className="capitalize">{item.metodoPago}</TableCell>
                      <TableCell className="text-right">{item.cantidad}</TableCell>
                      <TableCell className="text-right">{formatCOP(item.precioUnitario)}</TableCell>
                      <TableCell className="text-right">{formatCOP(item.totalCodigo)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCOP(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed py-12 text-center">
              <CircleDashed className="mx-auto size-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">No hay artículos incluidos en esta semana.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
