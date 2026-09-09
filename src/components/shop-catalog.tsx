"use client";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { categories } from "@/lib/catalog";
import { ProductGrid } from "./product-card";
import { Arrow } from "./ui";

export function ShopCatalog({
  products,
  initialQuery = "",
  focusSearch = false,
  initialStatus = "all",
}: {
  products: Product[];
  initialQuery?: string;
  focusSearch?: boolean;
  initialStatus?: string;
}) {
  const [status, setStatus] = useState(
    ["all", "available", "sold"].includes(initialStatus)
      ? initialStatus
      : "all",
  );
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
  const [query, setQuery] = useState(initialQuery);
  const filtered = products
    .filter((product) => {
      const matchesStatus =
        status === "all" ||
        (status === "available"
          ? product.status === "available"
          : product.status !== "available");
      return (
        matchesStatus &&
        (category === "all" || product.category === category) &&
        `${product.name} ${product.category} ${product.color}`
          .toLowerCase()
          .includes(query.toLowerCase().trim())
      );
    })
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : Date.parse(b.created_at) - Date.parse(a.created_at),
    );
  const reset = () => {
    setStatus("all");
    setCategory("all");
    setQuery("");
    setSort("newest");
  };
  return (
    <>
      <div className="filter-bar">
        <div className="status-filters" role="group" aria-label="Availability">
          {[
            ["all", "All pieces"],
            ["available", "Available"],
            ["sold", "Sold / archive"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {label}
              {value === "all" && <sup>{products.length}</sup>}
            </button>
          ))}
        </div>
        <div className="filter-selects">
          <label>
            <span>Category</span>
            <select
              aria-label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Sort by</span>
            <select
              aria-label="Sort by"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="low">Price: low–high</option>
              <option value="high">Price: high–low</option>
            </select>
          </label>
        </div>
      </div>
      <div className="catalog-toolbar">
        <p className="eyebrow" aria-live="polite">
          {String(filtered.length).padStart(2, "0")} PIECES / EACH ONE UNIQUE
        </p>
        <label className="catalog-search">
          <span className="sr-only">Search pieces</span>
          <input
            type="search"
            placeholder="Find your piece…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus={focusSearch}
          />
          <Arrow />
        </label>
      </div>
      {filtered.length ? (
        <ProductGrid products={filtered} />
      ) : (
        <div className="empty-state">
          <span className="eyebrow">NOTHING ON THIS RACK. YET.</span>
          <h2 className="display">
            A DIFFERENT
            <br />
            DIRECTION?
          </h2>
          <p>
            No pieces match these filters. Try another search or explore the
            full collection.
          </p>
          <button className="button" onClick={reset}>
            Clear filters
            <Arrow />
          </button>
        </div>
      )}
    </>
  );
}
