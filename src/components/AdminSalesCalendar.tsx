"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  ReceiptText,
} from "lucide-react";
import {
  getAdminSalesCalendar,
  type AdminSalesCalendar as AdminSalesCalendarData,
} from "@/actions/sales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SalesDayDetailDialog } from "@/components/SalesDayDetailDialog";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function formatCOP(value: number) {
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function formatShortDate(day: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00.000Z`));
}

interface AdminSalesCalendarProps {
  initialData: AdminSalesCalendarData;
}

export function AdminSalesCalendar({ initialData }: AdminSalesCalendarProps) {
  const [calendar, setCalendar] = useState(initialData);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null);

  const firstWeekday = useMemo(() => {
    const [year, month] = calendar.mes.split("-").map(Number);
    return (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  }, [calendar.mes]);
  const numberOfDays = useMemo(() => {
    const [year, month] = calendar.mes.split("-").map(Number);
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }, [calendar.mes]);

  const daysByDate = useMemo(
    () => new Map(calendar.dias.map((day) => [day.fecha, day])),
    [calendar.dias]
  );
  const monthlySales = calendar.dias.reduce((sum, day) => sum + day.totalVentas, 0);
  const monthlySaleCount = calendar.dias.reduce((sum, day) => sum + day.ventas, 0);
  const liquidatedDays = calendar.dias.filter((day) => day.liquidacionId !== null).length;
  const monthIsCurrent = calendar.mes === calendar.hoy.slice(0, 7);
  const todayData = daysByDate.get(calendar.hoy);
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: numberOfDays }, (_, i) => i + 1)];

  async function changeMonth(amount: number) {
    const targetMonth = shiftMonth(calendar.mes, amount);
    if (targetMonth > calendar.hoy.slice(0, 7)) return;
    setCargando(true);
    setError(null);
    try {
      const nextCalendar = await getAdminSalesCalendar(targetMonth);
      setCalendar(nextCalendar);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el calendario.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-rose-100 bg-[linear-gradient(130deg,#fff_15%,#fff5f8_100%)] p-6 shadow-[0_20px_55px_-42px_rgba(157,35,94,0.5)] sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 size-64 rounded-full bg-rose-100/45 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Badge className="mb-4 gap-1.5 border border-rose-200 bg-white/80 text-rose-700 hover:bg-white">
              <CalendarDays className="size-3.5" />
              Control diario
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Registros de ventas
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              Explora cada jornada, revisa las ventas y consulta el cierre de nómina junto a sus indicadores.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[26rem]">
            <div className="rounded-2xl border border-white bg-white/85 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ventas del mes</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{formatCOP(monthlySales)}</p>
            </div>
            <div className="rounded-2xl border border-white bg-white/85 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Días liquidados</p>
              <p className="mt-2 text-xl font-semibold text-emerald-700">{liquidatedDays}</p>
            </div>
            <div className="rounded-2xl border border-white bg-white/85 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ventas registradas</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{monthlySaleCount}</p>
            </div>
            <div className="rounded-2xl border border-white bg-white/85 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Jornada actual</p>
              <p className={`mt-2 text-xl font-semibold ${
                todayData?.liquidacionId ? "text-emerald-700" : "text-amber-700"
              }`}>
                {todayData?.liquidacionId ? "Liquidada" : "En seguimiento"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden border-slate-200/80 shadow-sm">
        <CardHeader className="gap-5 border-b border-slate-100 bg-white px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <CardTitle className="text-xl font-semibold capitalize text-slate-950">
              {formatMonth(calendar.mes)}
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Selecciona un día para consultar sus ventas y resultados.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="size-2.5 rounded-full bg-emerald-500" /> Liquidado
              <span className="ml-2 size-2.5 rounded-full bg-amber-400" /> Pendiente
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Mes anterior"
                disabled={cargando}
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Mes siguiente"
                disabled={cargando || monthIsCurrent}
                onClick={() => changeMonth(1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          {error && (
            <p role="alert" className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {cargando ? (
            <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" />
              Cargando calendario...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="mb-2 grid grid-cols-7">
                  {WEEKDAYS.map((weekday) => (
                    <div key={weekday} className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {weekday}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {cells.map((dayNumber, index) => {
                    if (dayNumber === null) {
                      return <div key={`empty-${index}`} className="min-h-28 rounded-2xl bg-slate-50/70 sm:min-h-32" />;
                    }

                    const date = `${calendar.mes}-${String(dayNumber).padStart(2, "0")}`;
                    const data = daysByDate.get(date);
                    const isToday = date === calendar.hoy;
                    const isFuture = date > calendar.hoy;
                    const isComplete = data?.liquidacionId !== null && data?.liquidacionId !== undefined;
                    const hasActivity = Boolean(data && (data.ventas > 0 || isComplete));
                    const clickable = !isFuture && (hasActivity || isToday);
                    const Icon = isComplete ? CheckCircle2 : Clock3;

                    return (
                      <button
                        key={date}
                        type="button"
                        disabled={!clickable}
                        onClick={() => clickable && setFechaSeleccionada(date)}
                        className={`group min-h-28 rounded-2xl border p-2 text-left transition-all sm:min-h-32 sm:p-3 ${
                          isComplete
                            ? "border-emerald-100 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50"
                            : hasActivity || isToday
                              ? "border-amber-100 bg-amber-50/60 hover:border-amber-300 hover:bg-amber-50"
                              : "border-slate-100 bg-white"
                        } ${isToday ? "ring-2 ring-rose-300 ring-offset-1" : ""} ${
                          clickable ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : "cursor-default"
                        } ${isFuture ? "opacity-45" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className={`flex size-7 items-center justify-center rounded-full text-sm font-semibold ${
                            isToday ? "bg-rose-600 text-white" : "text-slate-700"
                          }`}>
                            {dayNumber}
                          </span>
                          {isComplete ? (
                            <Icon className="size-4 shrink-0 text-emerald-600" />
                          ) : (hasActivity || isToday) ? (
                            <Icon className="size-4 shrink-0 text-amber-600" />
                          ) : null}
                        </div>
                        <div className="mt-3 space-y-1">
                          {data?.ventas ? (
                            <>
                              <p className="text-xs font-semibold text-slate-700">{data.ventas} ventas</p>
                              <p className="truncate text-xs text-slate-500">{formatCOP(data.totalVentas)}</p>
                            </>
                          ) : isToday ? (
                            <p className="text-xs text-slate-500">Hoy</p>
                          ) : (
                            <p className="text-xs text-slate-300">{clickable ? "Sin ventas" : ""}</p>
                          )}
                          {isComplete && (
                            <p className="truncate text-[11px] font-medium text-emerald-700">
                              Nómina {formatCOP(data.totalNomina)}
                            </p>
                          )}
                        </div>
                        {clickable && (
                          <span className="sr-only">
                            Ver registros del {formatShortDate(date)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-600" /> Día completado y liquidado</span>
            <span className="flex items-center gap-1.5"><Clock3 className="size-3.5 text-amber-600" /> Día pendiente de liquidación</span>
            <span className="flex items-center gap-1.5"><ReceiptText className="size-3.5 text-slate-400" /> Sin actividad registrada</span>
            <span className="ml-auto hidden items-center gap-1 text-slate-400 md:flex">
              {monthIsCurrent ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {monthIsCurrent ? "Mes actual" : "Historial"}
            </span>
          </div>
        </CardContent>
      </Card>

      <SalesDayDetailDialog
        fecha={fechaSeleccionada}
        onOpenChange={(open) => !open && setFechaSeleccionada(null)}
      />
    </div>
  );
}
