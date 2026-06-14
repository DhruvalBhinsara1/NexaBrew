"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePosStore } from "@/store/usePosStore";
import type { Category, ProductWithCategory } from "@/types/domain.types";

interface Props {
  products: ProductWithCategory[];
  categories: Category[];
}

function getCategoryImage(categoryName?: string) {
  if (!categoryName) return null;
  const normalized = categoryName.toLowerCase().replace(/\s+/g, "-");
  return `/images/categories/${normalized}.png`;
}

export function ProductsPanel({ products, categories }: Props): React.ReactElement {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const addItem = usePosStore((s) => s.addItem);

  const activeProducts = products.filter((p) => p.is_active);

  const filtered =
    activeCategory === null
      ? activeProducts
      : activeProducts.filter((p) => p.category_id === activeCategory);

  return (
    <div className="flex h-full flex-col">
      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-wise-border px-4 py-3 scrollbar-none">
        <button
          onClick={() => setActiveCategory(null)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            activeCategory === null
              ? "bg-wise-primary text-wise-ink"
              : "bg-wise-canvas-soft text-wise-body hover:bg-wise-primary-pale"
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              activeCategory === cat.id
                ? "bg-wise-primary text-wise-ink"
                : "bg-wise-canvas-soft text-wise-body hover:bg-wise-primary-pale"
            )}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: cat.color ?? "#aaa" }}
            />
            {cat.name}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-wise-mute">No products found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((product) => {
              const imageSrc = getCategoryImage(product.category?.name);
              return (
                <button
                  key={product.id}
                  onClick={() =>
                    addItem({
                      productId: product.id,
                      name: product.name,
                      unitPrice: Number(product.price),
                      taxRate: Number(product.tax_rate),
                    })
                  }
                  className="group relative flex flex-col overflow-hidden rounded-wise border border-wise-border bg-white text-left shadow-wiseCard transition-all duration-150 hover:-translate-y-0.5 hover:border-wise-primary active:scale-95"
                >
                  {/* Category Image Banner */}
                  <div className="relative h-28 w-full shrink-0 bg-wise-canvas-soft overflow-hidden">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={product.category?.name || "Product"}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    {/* Category color bar overlaid */}
                    <div
                      className="absolute inset-x-0 bottom-0 h-1.5 w-full z-10"
                      style={{ backgroundColor: product.category?.color ?? "#9fe870" }}
                    />
                  </div>
                  
                  <div className="flex flex-1 flex-col p-3 pb-12">
                    <p className="line-clamp-2 text-sm font-semibold text-wise-ink">
                      {product.name}
                    </p>
                    {product.category && (
                      <p className="mt-0.5 text-xs text-wise-mute">{product.category.name}</p>
                    )}
                  </div>
                  {/* Price + always-visible add affordance (POS is touch-first) */}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 pb-3">
                    <span className="text-base font-bold text-wise-ink-deep">
                      ₹{Number(product.price).toFixed(0)}
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-wise-primary text-wise-ink shadow-sm transition-transform group-hover:scale-110 group-active:scale-90">
                      <Plus className="h-4 w-4" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
