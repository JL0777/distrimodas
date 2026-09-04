"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Loader2, Plus, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
const DEBOUNCE_MS = 300;

function formatCOP(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

interface SalesTerminalProps {
  empleados: Empleado[];
  onSaleRegistered?: () => void;
}

export function SalesTerminal({ empleados, onSaleRegistered }: SalesTerminalProps) {
  // --- Reconocimiento de voz -------------------------------------------------
  const [escuchando, setEscuchando] = useState(false);
  // Arranca en false (igual en servidor y cliente) para evitar un mismatch de
  // hidratacion; se activa en el effect solo si el navegador realmente lo soporta.
  const [soportaVoz, setSoportaVoz] = useState(false);
  const [transcripcion, setTranscripcion] = useState("");
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
    recognition.onerror = () => setEscuchando(false);
    recognition.onend = () => setEscuchando(false);
    recognitionRef.current = recognition;
  }, []);

  function toggleMicrofono() {
    if (!recognitionRef.current) return;
    if (escuchando) {
      recognitionRef.current.stop();
      setEscuchando(false);
    } else {
      setTranscripcion("");
      recognitionRef.current.start();
      setEscuchando(true);
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
    const valorCodigo = tieneCodigo ? Number(nuevoCodigoValor || 0) * 1000 : 0;

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

  function agregarAlCarrito(item: CartItem) {
    setCarrito((prev) => [...prev, item]);
  }

  function quitarDelCarrito(clientId: string) {
    setCarrito((prev) => prev.filter((item) => item.clientId !== clientId));
  }

  function actualizarCantidad(clientId: string, cantidad: number) {
    setCarrito((prev) =>
      prev.map((item) => (item.clientId === clientId ? { ...item, cantidad: Math.max(1, cantidad) } : item))
    );
  }

  const totalCarrito = useMemo(
    () => carrito.reduce((acc, item) => acc + item.precioUnitario * item.cantidad, 0),
    [carrito]
  );

  // --- Checkout ------------------------------------------------------------------
  const [empleadoId, setEmpleadoId] = useState<string>("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [notasTransferencia, setNotasTransferencia] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  async function confirmarVenta() {
    setMensaje(null);
    if (!empleadoId) {
      setMensaje({ tipo: "error", texto: "Selecciona el vendedor" });
      return;
    }
    if (carrito.length === 0) {
      setMensaje({ tipo: "error", texto: "Agrega al menos un producto al carrito" });
      return;
    }
    if (metodoPago === "transferencia" && !notasTransferencia.trim()) {
      setMensaje({ tipo: "error", texto: "Las notas de transferencia son obligatorias" });
      return;
    }

    setEnviando(true);
    try {
      const resultado = await registerSale({
        empleadoId: Number(empleadoId),
        metodoPago,
        notasTransferencia: metodoPago === "transferencia" ? notasTransferencia.trim() : undefined,
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
        setMensaje({ tipo: "ok", texto: `Venta #${resultado.ventaId} registrada correctamente` });
        setCarrito([]);
        setNotasTransferencia("");
        onSaleRegistered?.();
      } else {
        setMensaje({ tipo: "error", texto: resultado.error ?? "No se pudo registrar la venta" });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Columna izquierda: captura de productos */}
      <Card>
        <CardHeader>
          <CardTitle>Registrar Venta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {soportaVoz ? (
            <Button
              type="button"
              size="lg"
              variant={escuchando ? "destructive" : "default"}
              className="w-full gap-2"
              onClick={toggleMicrofono}
            >
              <Mic className={escuchando ? "animate-pulse" : ""} />
              {escuchando ? "Escuchando..." : "Registrar Venta (Microfono)"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu navegador no soporta reconocimiento de voz. Escribe el nombre del producto:
            </p>
          )}

          <Input
            placeholder="Nombre del producto (voz o texto)"
            value={transcripcion}
            onChange={(e) => setTranscripcion(e.target.value)}
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
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">
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
                />
              </div>

              <div className="space-y-1.5">
                <Label>¿Tiene Codigo?</Label>
                <RadioGroup
                  value={nuevoTieneCodigo}
                  onValueChange={(v) => setNuevoTieneCodigo((v as "si" | "no") ?? "")}
                  className="flex gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="si" /> Si
                  </label>
                  <label className="flex items-center gap-2 text-sm">
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
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  disabled={!nuevoPrecio || !nuevoTieneCodigo}
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5" /> Carrito
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {carrito.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay productos en el carrito</p>
          ) : (
            <ul className="space-y-2">
              {carrito.map((item) => (
                <li key={item.clientId} className="flex items-center gap-2 rounded-md border p-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCOP(item.precioUnitario)}{" "}
                      {item.tieneCodigo && item.valorCodigo > 0 ? (
                        <span>· Codigo {formatCOP(item.valorCodigo)}</span>
                      ) : (
                        <span>· Venta neta</span>
                      )}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    value={item.cantidad}
                    onChange={(e) => actualizarCantidad(item.clientId, Number(e.target.value))}
                    className="w-16"
                  />
                  <Button type="button" size="icon" variant="ghost" onClick={() => quitarDelCarrito(item.clientId)}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
            <span>Total</span>
            <span>{formatCOP(totalCarrito)}</span>
          </div>

          <div className="space-y-1.5">
            <Label>Vendedor</Label>
            <Select value={empleadoId} onValueChange={(value) => setEmpleadoId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona el vendedor" />
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

          <div className="space-y-1.5">
            <Label>Metodo de pago</Label>
            <RadioGroup
              value={metodoPago}
              onValueChange={(v) => setMetodoPago(v as MetodoPago)}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="efectivo" /> Efectivo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="tarjeta" /> Tarjeta
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="transferencia" /> Transferencia
              </label>
            </RadioGroup>
          </div>

          {metodoPago === "transferencia" && (
            <div className="space-y-1.5">
              <Label htmlFor="notas-transferencia">Notas de transferencia *</Label>
              <Textarea
                id="notas-transferencia"
                placeholder="Ej: Nequi a nombre de..., ultimos 4 digitos, referencia..."
                value={notasTransferencia}
                onChange={(e) => setNotasTransferencia(e.target.value)}
              />
            </div>
          )}

          {mensaje && (
            <p className={mensaje.tipo === "ok" ? "text-sm text-green-600" : "text-sm text-destructive"}>
              {mensaje.texto}
            </p>
          )}

          <Button type="button" className="w-full" disabled={enviando} onClick={confirmarVenta}>
            {enviando ? <Loader2 className="size-4 animate-spin" /> : "Confirmar Venta"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
