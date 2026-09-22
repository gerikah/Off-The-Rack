import { CatalogSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="section-wrap loading-page" role="status">
      <span className="eyebrow">OFF THE RACK</span>
      <p className="display">PULLING YOUR PIECES…</p>
      <CatalogSkeleton />
    </div>
  );
}
