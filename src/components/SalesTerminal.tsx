"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleCheck,
  Mic,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchProducts } from "@/actions/products";
import { registerSale } from "@/actions/sales";
import type { CartItem, Empleado, MetodoPago, Producto } from "@/lib/types";

const CODIGOS_RAPIDOS = [2, 3, 5, 8, 10];
const NOTAS_TRANSFERENCIA_RAPIDAS = ["SONO QR", "NEQUI ALEXANDRA", "QR ALEXANDRA"];
const METODOS_PAGO: { value: MetodoPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
];
const DEBOUNCE_MS = 300;

function formatCOP(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatThousandsInput(value: string) {
  const cleaned = value.replace(/\./g, "").replace(/[^\d,]/g, "");
  const [integerPart = "", ...decimalParts] = cleaned.split(",");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimalParts.length > 0
    ? `${groupedInteger},${decimalParts.join("")}`
    : groupedInteger;
}

function parseThousandsInput(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function caretAfterDigitCount(value: string, digitCount: number) {
  if (digitCount === 0) return 0;
  let digitsSeen = 0;
  for (let index = 0; index < value.length; index++) {
    if (/\d/.test(value[index])) digitsSeen++;
    if (digitsSeen === digitCount) return index + 1;
  }
  return value.length;
}

interface SalesTerminalProps {
  empleados: Empleado[];
  onSaleRegistered?: () => void;
}

interface PagoCarrito {
  id: string;
  metodoPago: MetodoPago;
  monto: string;
}

export function SalesTerminal({ empleados, onSaleRegistered }: SalesTerminalProps) {
  // --- Reconocimiento de voz -------------------------------------------------
  const [escuchando, setEscuchando] = useState(false);
  // Arranca en false (igual en servidor y cliente) para evitar un mismatch de
  // hidratacion; se activa en el effect solo si el navegador realmente lo soporta.
  const [soportaVoz, setSoportaVoz] = useState(false);
  const [transcripcion, setTranscripcion] = useState("");
  const [errorVoz, setErrorVoz] = useState<string | null>(null);
  const [mostrarDictadoTeclado, setMostrarDictadoTeclado] = useState(false);
  const campoProductoRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<InstanceType<NonNullable<Window["SpeechRecognition"]>> | null>(
    null
  );

  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    // Deteccion de feature solo se puede confirmar en el cliente tras el mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSoportaVoz(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "es-CO";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let texto = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        texto += event.results[i][0].transcript;
      }
      setTranscripcion(texto);
    };
    recognition.onerror = (event) => {
      setEscuchando(false);
      setMostrarDictadoTeclado(true);
      setErrorVoz(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "El navegador no permitió usar el micrófono. Prueba el dictado del teclado."
          : "El reconocimiento de voz no está disponible en este navegador. Prueba el dictado del teclado."
      );
    };
    recognition.onend = () => setEscuchando(false);
    recognitionRef.current = recognition;
  }, []);

  function activarDictadoTeclado() {
    setErrorVoz(null);
    setTranscripcion("");
    setMostrarDictadoTeclado(true);
    campoProductoRef.current?.focus();
  }

  function toggleMicrofono() {
    if (!recognitionRef.current) {
      activarDictadoTeclado();
      return;
    }
    if (escuchando) {
      recognitionRef.current.stop();
      setEscuchando(false);
    } else {
      setTranscripcion("");
      setErrorVoz(null);
      try {
        recognitionRef.current.start();
        setEscuchando(true);
      } catch {
        setMostrarDictadoTeclado(true);
        setErrorVoz("No se pudo iniciar el micrófono. Prueba el dictado del teclado.");
      }
    }
  }

  // --- Busqueda de productos (voz o texto, con debounce) ----------------------
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const texto = transcripcion.trim();
    if (!texto) return;
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const productos = await searchProducts(texto);
        setResultados(productos);
      } finally {
        setBuscando(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [transcripcion]);

  // --- Flujo de producto nuevo -------------------------------------------------
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [nuevoPrecio, setNuevoPrecio] = useState("");
  const [nuevoTieneCodigo, setNuevoTieneCodigo] = useState<"si" | "no" | "">("");
  const [nuevoCodigoValor, setNuevoCodigoValor] = useState<number | "">("");

  function iniciarProductoNuevo() {
    setCreandoNuevo(true);
    setNuevoPrecio("");
    setNuevoTieneCodigo("");
    setNuevoCodigoValor("");
  }

  function cancelarProductoNuevo() {
    setCreandoNuevo(false);
    setTranscripcion("");
    setResultados([]);
  }

  function confirmarProductoNuevo() {
    const precio = Number(nuevoPrecio);
    if (!precio || precio <= 0) return;
    const tieneCodigo = nuevoTieneCodigo === "si";
    const valorCodigo = tieneCodigo ? Number(nuevoCodigoValor) * 1000 : 0;

    agregarAlCarrito({
      clientId: crypto.randomUUID(),
      productoId: null,
      nombre: transcripcion.trim(),
      precioUnitario: precio,
      cantidad: 1,
      tieneCodigo,
      valorCodigo,
    });

    setCreandoNuevo(false);
    setTranscripcion("");
    setResultados([]);
  }

  function seleccionarProductoExistente(producto: Producto) {
    agregarAlCarrito({
      clientId: crypto.randomUUID(),
      productoId: producto.id,
      nombre: producto.nombre,
      precioUnitario: producto.precio_base,
      cantidad: 1,
      tieneCodigo: producto.codigo_tiemple > 0,
      valorCodigo: producto.codigo_tiemple,
    });
    setTranscripcion("");
    setResultados([]);
  }

  // --- Carrito -----------------------------------------------------------------
  const [carrito, setCarrito] = useState<CartItem[]>([]);
  const [valoresCarrito, setValoresCarrito] = useState<
    Record<string, { precio: string; codigo: string }>
  >({});

  function agregarAlCarrito(item: CartItem) {
    setCarrito((prev) => [...prev, item]);
    setValoresCarrito((prev) => ({
      ...prev,
      [item.clientId]: {
        precio: String(item.precioUnitario),
        codigo: String(item.valorCodigo / 1000),
      },
    }));
  }

  function quitarDelCarrito(clientId: string) {
    setCarrito((prev) => prev.filter((item) => item.clientId !== clientId));
    setValoresCarrito((prev) => {
      const siguiente = { ...prev };
      delete siguiente[clientId];
      return siguiente;
    });
  }

  function actualizarCantidad(clientId: string, cantidad: number) {
    setCarrito((prev) =>
      prev.map((item) => (item.clientId === clientId ? { ...item, cantidad: Math.max(1, cantidad) } : item))
    );
  }

  function aplicarPrecioMinimo(clientId: string) {
    const item = carrito.find((cartItem) => cartItem.clientId === clientId);
    if (!item || !item.tieneCodigo || item.valorCodigo <= 0 || item.precioUnitario <= item.valorCodigo) {
      return;
    }

    const precioMinimo = item.precioUnitario - item.valorCodigo;
    const precioFormateado = formatThousandsInput(String(precioMinimo));
    setValoresCarrito((prev) => ({
      ...prev,
      [clientId]: { precio: precioFormateado, codigo: "0" },
    }));
    setCarrito((prev) =>
      prev.map((cartItem) =>
        cartItem.clientId === clientId
          ? { ...cartItem, precioUnitario: precioMinimo, valorCodigo: 0, tieneCodigo: false }
          : cartItem
      )
    );
  }

  function actualizarPrecio(clientId: string, valor: string, cursor: number) {
    const formattedValue = formatThousandsInput(valor);
    const digitsBeforeCursor = (valor.slice(0, cursor).match(/\d/g) ?? []).length;
    setValoresCarrito((prev) => ({
      ...prev,
      [clientId]: { ...prev[clientId], precio: formattedValue },
    }));
    requestAnimationFrame(() => {
      const input = document.getElementById(`precio-${clientId}`);
      if (input instanceof HTMLInputElement) {
        const nextCursor = caretAfterDigitCount(formattedValue, digitsBeforeCursor);
        input.setSelectionRange(nextCursor, nextCursor);
      }
    });
    const precioUnitario = parseThousandsInput(formattedValue);
    setCarrito((prev) =>
      prev.map((item) =>
        item.clientId === clientId
          ? { ...item, precioUnitario: Number.isFinite(precioUnitario) && precioUnitario > 0 ? precioUnitario : 0 }
          : item
      )
    );
  }

  function actualizarCodigo(clientId: string, valor: string, cursor: number) {
    const formattedValue = formatThousandsInput(valor);
    const digitsBeforeCursor = (valor.slice(0, cursor).match(/\d/g) ?? []).length;
    setValoresCarrito((prev) => ({
      ...prev,
      [clientId]: { ...prev[clientId], codigo: formattedValue },
    }));
    requestAnimationFrame(() => {
      const input = document.getElementById(`codigo-${clientId}`);
      if (input instanceof HTMLInputElement) {
        const nextCursor = caretAfterDigitCount(formattedValue, digitsBeforeCursor);
        input.setSelectionRange(nextCursor, nextCursor);
      }
    });
    const codigoEnMiles = parseThousandsInput(formattedValue);
    const valorCodigo =
      formattedValue.trim() === "" ? 0 : codigoEnMiles >= 0 ? codigoEnMiles * 1000 : 0;
    setCarrito((prev) =>
      prev.map((item) =>
        item.clientId === clientId
          ? { ...item, valorCodigo, tieneCodigo: valorCodigo > 0 }
          : item
      )
    );
  }

  const totalCarrito = useMemo(
    () => carrito.reduce((acc, item) => acc + item.precioUnitario * item.cantidad, 0),
    [carrito]
  );
  const totalCodigoCarrito = useMemo(
    () => carrito.reduce((acc, item) => acc + item.valorCodigo * item.cantidad, 0),
    [carrito]
  );

  // --- Checkout ------------------------------------------------------------------
  const [empleadoId, setEmpleadoId] = useState<string>("");
  const [selectorVendedorAbierto, setSelectorVendedorAbierto] = useState(false);
  const [pagos, setPagos] = useState<PagoCarrito[]>([
    { id: "pago-inicial", metodoPago: "efectivo", monto: "" },
  ]);
  const [notasTransferencia, setNotasTransferencia] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [confirmacionAbierta, setConfirmacionAbierta] = useState(false);
  const [ventaRegistrada, setVentaRegistrada] = useState(false);
  const vendedorSeleccionado = empleados.find((empleado) => String(empleado.id) === empleadoId);
  const pagosConMonto = pagos.map((pago) => ({
    ...pago,
    montoTexto: pagos.length === 1 && !pago.monto ? String(totalCarrito) : pago.monto,
  }));
  const totalPagado = pagosConMonto.reduce(
    (total, pago) => total + parseThousandsInput(pago.montoTexto),
    0
  );
  const saldoPorDistribuir = totalCarrito - totalPagado;
  const transferenciaSeleccionada = pagos.some((pago) => pago.metodoPago === "transferencia");

  useEffect(() => {
    if (!ventaRegistrada) return;
    const timeoutId = setTimeout(() => {
      setConfirmacionAbierta(false);
      setVentaRegistrada(false);
    }, 1700);
    return () => clearTimeout(timeoutId);
  }, [ventaRegistrada]);

  function agregarMetodoPago() {
    const metodoDisponible = METODOS_PAGO.find(
      (metodo) => !pagos.some((pago) => pago.metodoPago === metodo.value)
    );
    if (!metodoDisponible) return;
    setPagos((actuales) => [
      ...actuales.map((pago) => ({
        ...pago,
        monto: actuales.length === 1 && !pago.monto ? String(totalCarrito) : pago.monto,
      })),
      { id: crypto.randomUUID(), metodoPago: metodoDisponible.value, monto: "" },
    ]);
  }

  function actualizarMetodoPago(id: string, metodoPago: MetodoPago) {
    setPagos((actuales) =>
      actuales.map((pago) => (pago.id === id ? { ...pago, metodoPago } : pago))
    );
  }

  function actualizarMontoPago(id: string, value: string) {
    const formattedValue = formatThousandsInput(value);
    setPagos((actuales) =>
      actuales.map((pago) => (pago.id === id ? { ...pago, monto: formattedValue } : pago))
    );
  }

  function quitarMetodoPago(id: string) {
    setPagos((actuales) => {
      const restantes = actuales.filter((pago) => pago.id !== id);
      return restantes.length === 1
        ? [{ ...restantes[0], monto: String(totalCarrito) }]
        : restantes;
    });
  }

  function agregarNotaRapida(nota: string) {
    setNotasTransferencia((actual) => {
      const notaActual = actual.trim();
      if (notaActual.includes(nota)) return actual;
      return notaActual ? `${notaActual} · ${nota}` : nota;
    });
  }

  function validarVenta() {
    setMensaje(null);
    if (!empleadoId) {
      setMensaje({ tipo: "error", texto: "Selecciona el vendedor" });
      return false;
    }
    if (carrito.length === 0) {
      setMensaje({ tipo: "error", texto: "Agrega al menos un producto al carrito" });
      return false;
    }
    if (carrito.some((item) => !Number.isFinite(item.precioUnitario) || item.precioUnitario <= 0)) {
      setMensaje({ tipo: "error", texto: "El precio unitario debe ser mayor a 0" });
      return false;
    }
    if (carrito.some((item) => !Number.isFinite(item.valorCodigo) || item.valorCodigo < 0)) {
      setMensaje({ tipo: "error", texto: "El codigo debe ser igual o mayor a 0" });
      return false;
    }
    if (pagos.some((pago) => parseThousandsInput(
      pagos.length === 1 && !pago.monto ? String(totalCarrito) : pago.monto
    ) <= 0)) {
      setMensaje({ tipo: "error", texto: "Cada método de pago debe tener un valor mayor a 0" });
      return false;
    }
    if (Math.abs(totalCarrito - totalPagado) > 0.01) {
      setMensaje({
        tipo: "error",
        texto: `Distribuye el total exacto de la venta. Falta asignar ${formatCOP(Math.abs(saldoPorDistribuir))}.`,
      });
      return false;
    }
    if (transferenciaSeleccionada && !notasTransferencia.trim()) {
      setMensaje({ tipo: "error", texto: "Las notas de transferencia son obligatorias" });
      return false;
    }
    return true;
  }

  function solicitarConfirmacionVenta() {
    if (!validarVenta()) return;
    if (window.matchMedia("(max-width: 1279px), (pointer: coarse)").matches) {
      setConfirmacionAbierta(true);
    } else {
      void registrarVenta();
    }
  }

  async function registrarVenta() {
    if (!validarVenta()) return;
    setEnviando(true);
    try {
      const resultado = await registerSale({
        empleadoId: Number(empleadoId),
        pagos: pagosConMonto.map((pago) => ({
          metodoPago: pago.metodoPago,
          monto: parseThousandsInput(pago.montoTexto),
        })),
        notasTransferencia: transferenciaSeleccionada ? notasTransferencia.trim() : undefined,
        items: carrito.map((item) => ({
          productoId: item.productoId,
          nombre: item.nombre,
          precioUnitario: item.precioUnitario,
          cantidad: item.cantidad,
          tieneCodigo: item.tieneCodigo,
          valorCodigo: item.valorCodigo,
        })),
      });

      if (resultado.success) {
        setMensaje({ tipo: "ok", texto: `Venta registrada correctamente` });
        setVentaRegistrada(true);
        setCarrito([]);
        setValoresCarrito({});
        setNotasTransferencia("");
        setPagos([{ id: crypto.randomUUID(), metodoPago: "efectivo", monto: "" }]);
        onSaleRegistered?.();
      } else {
        setMensaje({ tipo: "error", texto: resultado.error ?? "No se pudo registrar la venta" });
      }
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: error instanceof Error ? error.message : "No se pudo completar el registro de la venta.",
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Columna izquierda: captura de productos */}
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Registrar producto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {soportaVoz ? (
            <Button
              type="button"
              size="lg"
              variant={escuchando ? "destructive" : "default"}
              className="min-h-14 w-full gap-2 text-base"
              onClick={toggleMicrofono}
            >
              <Mic className={escuchando ? "animate-pulse" : ""} />
              {escuchando ? "Escuchando..." : "Registrar Venta (Microfono)"}
            </Button>
          ) : null}

          {(!soportaVoz || mostrarDictadoTeclado) && (
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="min-h-14 w-full gap-2 text-base"
              onClick={activarDictadoTeclado}
            >
              <Mic />
              Dictar producto con el teclado
            </Button>
          )}

          {errorVoz && (
            <p role="status" className="text-sm text-amber-700">
              {errorVoz}
            </p>
          )}

          {mostrarDictadoTeclado && (
            <p className="text-sm text-muted-foreground">
              En iPad, toca el micrófono del teclado para dictar el nombre. El texto se buscará
              automáticamente.
            </p>
          )}

          <Input
            ref={campoProductoRef}
            placeholder="Nombre del producto (voz o texto)"
            value={transcripcion}
            onChange={(e) => setTranscripcion(e.target.value)}
            className="h-12 text-base"
          />

          {transcripcion.trim() && !creandoNuevo && (
            <Command className="rounded-lg border">
              <CommandList>
                {buscando && (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Buscando...
                  </div>
                )}
                {!buscando && (
                  <CommandEmpty>
                    <div className="flex flex-col items-center gap-2 py-2">
                      <span className="text-sm">Sin coincidencias para &quot;{transcripcion}&quot;</span>
                      <Button type="button" size="sm" variant="outline" onClick={iniciarProductoNuevo} className="gap-1">
                        <Plus className="size-4" /> Anadir Nuevo
                      </Button>
                    </div>
                  </CommandEmpty>
                )}
                {!buscando && resultados.length > 0 && (
                  <CommandGroup heading="Productos encontrados">
                    {resultados.map((producto) => (
                      <CommandItem
                        key={producto.id}
                        value={producto.nombre}
                        onSelect={() => seleccionarProductoExistente(producto)}
                      >
                        <span className="flex-1">{producto.nombre}</span>
                        <Badge variant="secondary">{formatCOP(producto.precio_base)}</Badge>
                        {producto.codigo_tiemple > 0 && (
                          <Badge variant="outline">Cod {formatCOP(producto.codigo_tiemple)}</Badge>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          )}

          {creandoNuevo && (
            <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-5">
              <p className="text-base font-medium">
                Producto nuevo: <span className="text-muted-foreground">{transcripcion}</span>
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="nuevo-precio">Precio de venta</Label>
                <Input
                  id="nuevo-precio"
                  type="number"
                  min={0}
                  placeholder="Ej: 45000"
                  value={nuevoPrecio}
                  onChange={(e) => setNuevoPrecio(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label>¿Tiene Codigo?</Label>
                <RadioGroup
                  value={nuevoTieneCodigo}
                  onValueChange={(v) => setNuevoTieneCodigo((v as "si" | "no") ?? "")}
                  className="flex gap-6"
                >
                  <label className="flex items-center gap-2 text-base">
                    <RadioGroupItem value="si" /> Sí
                  </label>
                  <label className="flex items-center gap-2 text-base">
                    <RadioGroupItem value="no" /> No
                  </label>
                </RadioGroup>
              </div>

              {nuevoTieneCodigo === "si" && (
                <div className="space-y-1.5">
                  <Label>Valor del codigo (miles de COP)</Label>
                  <div className="flex flex-wrap gap-2">
                    {CODIGOS_RAPIDOS.map((codigo) => (
                      <Button
                        key={codigo}
                        type="button"
                        size="sm"
                        variant={nuevoCodigoValor === codigo ? "default" : "outline"}
                        onClick={() => setNuevoCodigoValor(codigo)}
                      >
                        {codigo}
                      </Button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Valor manual (ej: 7)"
                    value={nuevoCodigoValor}
                    onChange={(e) => setNuevoCodigoValor(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-11"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  className="min-h-11 flex-1"
                  disabled={
                    !nuevoPrecio ||
                    !nuevoTieneCodigo ||
                    (nuevoTieneCodigo === "si" && (!nuevoCodigoValor || Number(nuevoCodigoValor) <= 0))
                  }
                  onClick={confirmarProductoNuevo}
                >
                  Agregar al carrito
                </Button>
                <Button type="button" variant="ghost" onClick={cancelarProductoNuevo}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Columna derecha: carrito y checkout */}
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <ShoppingCart className="size-5" /> Carrito
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {carrito.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay productos en el carrito</p>
          ) : (
            <ul className="max-h-[28rem] space-y-3 overflow-y-auto pr-2">
              {carrito.map((item) => (
                <li
                  key={item.clientId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-border/70 bg-white p-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{item.nombre}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Total del articulo: {formatCOP(item.precioUnitario * item.cantidad)}
                      {item.valorCodigo > 0 && (
                        <> · Codigo total: {formatCOP(item.valorCodigo * item.cantidad)}</>
                      )}
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor={`precio-${item.clientId}`} className="text-sm">
                          Precio unitario
                        </Label>
                        <Input
                          id={`precio-${item.clientId}`}
                          type="text"
                          inputMode="decimal"
                          value={valoresCarrito[item.clientId]?.precio ?? String(item.precioUnitario)}
                          onChange={(e) =>
                            actualizarPrecio(item.clientId, e.target.value, e.target.selectionStart ?? e.target.value.length)
                          }
                          className="h-14 text-lg sm:h-11 sm:text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`codigo-${item.clientId}`} className="text-sm">
                          Codigo por unidad (miles COP)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id={`codigo-${item.clientId}`}
                            type="text"
                            inputMode="decimal"
                            value={valoresCarrito[item.clientId]?.codigo ?? String(item.valorCodigo / 1000)}
                            onChange={(e) =>
                              actualizarCodigo(item.clientId, e.target.value, e.target.selectionStart ?? e.target.value.length)
                            }
                            className="h-14 min-w-0 flex-1 text-lg sm:h-11 sm:text-sm"
                          />
                          {item.tieneCodigo && item.valorCodigo > 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-14 shrink-0 px-3 text-sm sm:h-11"
                              disabled={item.precioUnitario <= item.valorCodigo}
                              aria-label={`Aplicar precio mínimo a ${item.nombre}`}
                              onClick={() => aplicarPrecioMinimo(item.clientId)}
                            >
                              Mínimo
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 sm:hidden">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`Disminuir cantidad de ${item.nombre}`}
                        disabled={item.cantidad <= 1}
                        onClick={() => actualizarCantidad(item.clientId, item.cantidad - 1)}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="min-w-7 text-center text-sm font-semibold" aria-live="polite">
                        {item.cantidad}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`Aumentar cantidad de ${item.nombre}`}
                        onClick={() => actualizarCantidad(item.clientId, item.cantidad + 1)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      aria-label={`Cantidad de ${item.nombre}`}
                      value={item.cantidad}
                      onChange={(e) => actualizarCantidad(item.clientId, Number(e.target.value))}
                      className="hidden h-11 w-20 sm:block"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Quitar ${item.nombre} del carrito`}
                      onClick={() => quitarDelCarrito(item.clientId)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t pt-4 text-base font-semibold">
            <span>Total</span>
            <span>{formatCOP(totalCarrito)}</span>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Vendedor</Label>
            <div className="xl:hidden">
              <Dialog open={selectorVendedorAbierto} onOpenChange={setSelectorVendedorAbierto}>
                <DialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="h-14 w-full justify-between rounded-xl px-4 text-left"
                    />
                  }
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <UserRound className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-normal text-muted-foreground">
                        {vendedorSeleccionado ? "Vendedor seleccionado" : "Toca para escoger"}
                      </span>
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {vendedorSeleccionado?.nombre ?? "Selecciona el vendedor"}
                      </span>
                    </span>
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </DialogTrigger>
                <DialogContent className="max-h-[82dvh] w-[calc(100vw-2rem)] overflow-hidden p-4 sm:max-w-md">
                  <DialogHeader className="pr-8">
                    <DialogTitle>Seleccionar vendedor</DialogTitle>
                    <DialogDescription>
                      Elige el vendedor que registrará esta venta.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[58dvh] space-y-2 overflow-y-auto overscroll-contain">
                    {empleados.length === 0 ? (
                      <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                        No hay vendedores disponibles.
                      </p>
                    ) : (
                      empleados.map((empleado) => {
                        const seleccionado = String(empleado.id) === empleadoId;
                        return (
                          <Button
                            key={empleado.id}
                            type="button"
                            variant="outline"
                            aria-pressed={seleccionado}
                            onClick={() => {
                              setEmpleadoId(String(empleado.id));
                              setSelectorVendedorAbierto(false);
                            }}
                            className={`h-14 w-full justify-between rounded-xl px-4 text-left ${
                              seleccionado
                                ? "border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-50"
                                : "bg-white"
                            }`}
                          >
                            <span className="truncate pr-3 text-sm font-medium">{empleado.nombre}</span>
                            {seleccionado && <Check className="size-4 shrink-0 text-emerald-700" />}
                          </Button>
                        );
                      })
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="hidden xl:block">
              <Select value={empleadoId} onValueChange={(value) => setEmpleadoId(value ?? "")}>
                <SelectTrigger className="h-12 w-full text-base">
                  <SelectValue placeholder="Selecciona el vendedor">
                    {vendedorSeleccionado?.nombre}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {empleados.map((empleado) => (
                    <SelectItem key={empleado.id} value={String(empleado.id)}>
                      {empleado.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label className="text-sm">Métodos de pago</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Distribuye el total sin registrar ventas separadas.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={agregarMetodoPago}
                disabled={pagos.length >= METODOS_PAGO.length}
              >
                <Plus className="size-4" />
                Agregar método
              </Button>
            </div>
            <div className="space-y-2">
              {pagosConMonto.map((pago) => (
                <div
                  key={pago.id}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-2 rounded-xl border border-slate-200 bg-white p-2"
                >
                  <select
                    aria-label="Método de pago"
                    value={pago.metodoPago}
                    onChange={(event) =>
                      actualizarMetodoPago(pago.id, event.target.value as MetodoPago)
                    }
                    className="h-11 min-w-0 rounded-lg border border-input bg-white px-2 text-sm font-medium outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                  >
                    {METODOS_PAGO.map((metodo) => (
                      <option
                        key={metodo.value}
                        value={metodo.value}
                        disabled={pagos.some(
                          (seleccionado) =>
                            seleccionado.id !== pago.id && seleccionado.metodoPago === metodo.value
                        )}
                      >
                        {metodo.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    inputMode="decimal"
                    aria-label={`Monto por ${METODOS_PAGO.find((metodo) => metodo.value === pago.metodoPago)?.label}`}
                    value={pago.montoTexto}
                    onChange={(event) => actualizarMontoPago(pago.id, event.target.value)}
                    placeholder="$ 0"
                    className="h-11 min-w-0 text-right font-semibold"
                  />
                  {pagos.length > 1 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Quitar método ${pago.metodoPago}`}
                      onClick={() => quitarMetodoPago(pago.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
            <div
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${
                Math.abs(saldoPorDistribuir) <= 0.01
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-900"
              }`}
              aria-live="polite"
            >
              <span>Asignado {formatCOP(totalPagado)} de {formatCOP(totalCarrito)}</span>
              {Math.abs(saldoPorDistribuir) <= 0.01 ? (
                <span className="font-semibold">Completo</span>
              ) : (
                <span className="font-semibold">
                  {saldoPorDistribuir > 0 ? "Falta" : "Excede"} {formatCOP(Math.abs(saldoPorDistribuir))}
                </span>
              )}
            </div>
          </div>

          {transferenciaSeleccionada && (
            <div className="space-y-1.5">
              <Label>Opciones rápidas</Label>
              <div className="flex flex-wrap gap-2">
                {NOTAS_TRANSFERENCIA_RAPIDAS.map((nota) => (
                  <Button
                    key={nota}
                    type="button"
                    size="default"
                    variant="outline"
                    onClick={() => agregarNotaRapida(nota)}
                  >
                    {nota}
                  </Button>
                ))}
              </div>
              <Label htmlFor="notas-transferencia">Notas de transferencia *</Label>
              <Textarea
                id="notas-transferencia"
                placeholder="Ej: Nequi a nombre de..., ultimos 4 digitos, referencia..."
                value={notasTransferencia}
                onChange={(e) => setNotasTransferencia(e.target.value)}
                className="min-h-24 text-base"
              />
            </div>
          )}

          {mensaje && (
            <p className={mensaje.tipo === "ok" ? "text-sm text-green-600" : "text-sm text-destructive"}>
              {mensaje.texto}
            </p>
          )}

          <Button
            type="button"
            size="lg"
            className="min-h-12 w-full text-base"
            disabled={enviando}
            onClick={solicitarConfirmacionVenta}
          >
            {enviando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <span className="xl:hidden">Revisar venta</span>
                <span className="hidden xl:inline">Confirmar Venta</span>
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      <Dialog
        open={confirmacionAbierta}
        onOpenChange={(open) => {
          if (enviando) return;
          setConfirmacionAbierta(open);
          if (!open) setVentaRegistrada(false);
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl p-4 sm:max-w-lg sm:p-6">
          {ventaRegistrada ? (
            <div className="flex flex-col items-center py-7 text-center">
              <span className="relative mb-5 flex size-28 items-center justify-center">
                <span className="absolute inset-0 rounded-full border-4 border-emerald-300 motion-safe:animate-[ping_1.4s_ease-out_1]" />
                <span className="flex size-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-inner motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500">
                  <CircleCheck className="size-16" strokeWidth={2.2} />
                </span>
              </span>
              <DialogTitle className="text-2xl font-bold text-emerald-800">
                ¡Venta registrada!
              </DialogTitle>
              <DialogDescription className="mt-2">
                La venta quedó guardada correctamente.
              </DialogDescription>
              <Button
                type="button"
                variant="outline"
                className="mt-6 min-h-11 rounded-xl"
                onClick={() => {
                  setConfirmacionAbierta(false);
                  setVentaRegistrada(false);
                }}
              >
                Listo
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle className="text-xl">Revisa la venta</DialogTitle>
                <DialogDescription>
                  Confirma los productos, el código y cómo se recibió el pago.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-950 p-4 text-white">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
                    Total de la venta
                  </p>
                  <p className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                    {formatCOP(totalCarrito)}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/15 pt-3 text-sm">
                    <span className="text-slate-300">Código total</span>
                    <span className="font-semibold">{formatCOP(totalCodigoCarrito)}</span>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-900">
                    Productos ({carrito.length})
                  </p>
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border p-3">
                    {carrito.map((item) => (
                      <div key={item.clientId} className="flex justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{item.nombre}</p>
                          <p className="text-xs text-slate-500">
                            {item.cantidad} × {formatCOP(item.precioUnitario)}
                            {item.valorCodigo > 0
                              ? ` · Código ${formatCOP(item.valorCodigo * item.cantidad)}`
                              : " · Venta neta"}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-slate-900">
                          {formatCOP(item.precioUnitario * item.cantidad)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Distribución del pago</p>
                    <span className="text-sm font-bold text-slate-900">{formatCOP(totalPagado)}</span>
                  </div>
                  <div className="space-y-1.5">
                    {pagosConMonto.map((pago) => (
                      <div key={pago.id} className="flex justify-between gap-3 text-sm">
                        <span className="capitalize text-slate-600">{pago.metodoPago}</span>
                        <span className="font-medium text-slate-900">
                          {formatCOP(parseThousandsInput(pago.montoTexto))}
                        </span>
                      </div>
                    ))}
                  </div>
                  {transferenciaSeleccionada && (
                    <p className="mt-2 border-t pt-2 text-xs text-slate-500">
                      Nota: {notasTransferencia || "Sin nota"}
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Vendedor: <span className="font-semibold text-slate-900">
                    {vendedorSeleccionado?.nombre ?? "Sin seleccionar"}
                  </span>
                </div>
                {mensaje?.tipo === "error" && (
                  <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {mensaje.texto}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12 rounded-xl"
                    disabled={enviando}
                    onClick={() => setConfirmacionAbierta(false)}
                  >
                    Volver a editar
                  </Button>
                  <Button
                    type="button"
                    className="min-h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800"
                    disabled={enviando || Math.abs(totalCarrito - totalPagado) > 0.01}
                    onClick={() => void registrarVenta()}
                  >
                    {enviando ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Confirmar venta"
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
