import { listAllProducts } from "@/actions/products";
import { ProductsManager } from "@/components/ProductsManager";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const productos = await listAllProducts();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Gestion de Productos</h2>
        <p className="text-sm text-muted-foreground">Catalogo, precios y codigos de tiemple por defecto</p>
      </div>
      <ProductsManager productos={productos} />
    </div>
  );
}
