"use client";
import { useState } from "react";
import type { Product, Category } from "@/lib/types";
import { ProductGrid } from "./product-card";
import { Arrow } from "./ui";
import { BookmarkIcon } from "./product-actions";
import { useSavedProducts } from "@/lib/saved-products";

export function ShopCatalog({
  products,
  categories,
  initialQuery = "",
  focusSearch = false,
  initialStatus = "all",
}: {
  products: Product[];
  categories: Category[];
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
  const [savedOnly, setSavedOnly] = useState(false);
  const { savedIds } = useSavedProducts();
  const savedCount = products.filter((product) =>
    savedIds.includes(product.id),
  ).length;
  const filtered = products
    .filter((product) => {
      const matchesStatus =
        status === "all" ||
        (status === "available"
          ? product.status === "available"
          : product.status !== "available");
      return (
        matchesStatus &&
        (!savedOnly || savedIds.includes(product.id)) &&
        (category === "all" || product.category_id === category) &&
        [
          product.name,
          product.category?.name,
          product.color,
          product.size,
          product.material,
        ]
          .filter(Boolean)
          .join(" ")
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
    setSavedOnly(false);
  };
  const activeFilters = [
    ...(status !== "all"
      ? [
          {
            id: "status",
            label: status === "available" ? "Available" : "Sold / archive",
            clear: () => setStatus("all"),
          },
        ]
      : []),
    ...(category !== "all"
      ? [
          {
            id: "category",
            label:
              categories.find((item) => item.id === category)?.name ||
              "Category",
            clear: () => setCategory("all"),
          },
        ]
      : []),
    ...(query.trim()
      ? [
          {
            id: "query",
            label: `Search: ${query.trim()}`,
            clear: () => setQuery(""),
          },
        ]
      : []),
    ...(sort !== "newest"
      ? [
          {
            id: "sort",
            label: sort === "low" ? "Price: low–high" : "Price: high–low",
            clear: () => setSort("newest"),
          },
        ]
      : []),
    ...(savedOnly
      ? [
          {
            id: "saved",
            label: "Saved pieces",
            clear: () => setSavedOnly(false),
          },
        ]
      : []),
  ];
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
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
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
        <div className="catalog-results">
          <p className="eyebrow" aria-live="polite">
            {String(filtered.length).padStart(2, "0")} PIECES / EACH ONE UNIQUE
          </p>
          <button
            type="button"
            className="saved-filter"
            aria-pressed={savedOnly}
            onClick={() => setSavedOnly(!savedOnly)}
          >
            <BookmarkIcon /> Saved pieces <span>({savedCount})</span>
          </button>
        </div>
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
      {activeFilters.length > 0 && (
        <div
          className="active-filters"
          role="group"
          aria-label="Active filters"
        >
          {activeFilters.map((filter) => (
            <button
              type="button"
              key={filter.id}
              onClick={filter.clear}
              aria-label={`Remove ${filter.label} filter`}
            >
              <span>{filter.label}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="reset-filters" onClick={reset}>
            Reset all
          </button>
        </div>
      )}
      {savedOnly && (
        <p className="saved-note">
          Saved on this device. Saving a piece does not reserve it.
        </p>
      )}
      {!products.length ? (
        <div className="empty-state">
          <h2 className="display">THE RACK IS CURRENTLY EMPTY.</h2>
          <p>Check back for the next drop.</p>
        </div>
      ) : filtered.length ? (
        <ProductGrid products={filtered} eager />
      ) : (
        <div className="empty-state">
          <span className="eyebrow">NOTHING ON THIS RACK. YET.</span>
          <h2 className="display">
            A DIFFERENT
            <br />
            DIRECTION?
          </h2>
          <p>
            {savedOnly && savedCount === 0
              ? "Save a piece with the bookmark button to find it here. Your saved pieces stay on this device."
              : "No pieces match these filters. Try another search or explore the full collection."}
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
