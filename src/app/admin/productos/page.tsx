import { listAllProducts } from "@/actions/products";
import { ProductsManager } from "@/components/ProductsManager";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const productos = await listAllProducts();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-heading">Gestión de productos</h2>
        <p className="page-subtitle">Administra el catálogo, los precios y los códigos de tiemple.</p>
      </div>
      <ProductsManager productos={productos} />
    </div>
  );
}
