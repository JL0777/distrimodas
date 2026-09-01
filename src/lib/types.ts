export type MetodoPago = "efectivo" | "tarjeta" | "transferencia";

export interface Sede {
  id: number;
  nombre: string;
}

export interface Empleado {
  id: number;
  nombre: string;
  sede_id: number;
  activo: boolean;
}

export interface Producto {
  id: number;
  nombre: string;
  precio_base: number;
  codigo_tiemple: number;
  activo: boolean;
}

// Item del carrito en el terminal de ventas (estado del cliente).
export interface CartItem {
  clientId: string;
  productoId: number | null; // null = producto nuevo, se creara al confirmar
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  tieneCodigo: boolean;
  valorCodigo: number; // en COP, ej. codigo 5 => 5000
}
