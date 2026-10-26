"use client";
import { usePathname } from "next/navigation";
export function SiteChrome({
  children,
  header,
  footer,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  // Presentation only. Admin authorization is enforced separately in the server data layer.
  if (pathname === "/admin" || pathname.startsWith("/admin/"))
    return <main id="main">{children}</main>;
  if (pathname.startsWith("/product/"))
    return (
      <div className="product-screen">
        {header}
        <main id="main">{children}</main>
      </div>
    );
  return (
    <>
      {header}
      <main id="main">{children}</main>
      {footer}
    </>
  );
}
