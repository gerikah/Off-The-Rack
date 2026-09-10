"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "./auth-form";
import { AdminNoticeProvider } from "./notice";
const navigation = [
  ["Dashboard", "/admin"],
  ["Products", "/admin/products"],
  ["Categories", "/admin/categories"],
  ["Inquiries", "/admin/inquiries"],
];
export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const panel = dialog.current;
    panel?.showModal();
    return () => panel?.close();
  }, [open]);
  function close() {
    setOpen(false);
    toggle.current?.focus();
  }
  const title =
    navigation.find(
      ([, href]) => href !== "/admin" && pathname.startsWith(href),
    )?.[0] || "Dashboard";
  function links(mobile = false) {
    return (
      <nav aria-label={mobile ? "Admin mobile navigation" : "Admin navigation"}>
        {navigation.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            onClick={mobile ? close : undefined}
            aria-current={
              (
                href === "/admin"
                  ? pathname === href
                  : pathname.startsWith(href)
              )
                ? "page"
                : undefined
            }
          >
            <span>{label}</span>
            <span aria-hidden="true">&#8599;</span>
          </Link>
        ))}
      </nav>
    );
  }
  const brand = (
    <Link href="/admin" className="admin-brand">
      <Image
        src="/images/star-off-the-rack-logo-favicon.webp"
        alt=""
        width={38}
        height={38}
      />
      <span>
        OFF THE RACK<small>STUDIO ADMIN</small>
      </span>
    </Link>
  );
  return (
    <AdminNoticeProvider>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          {brand}
          {links()}
          <div className="admin-sidebar-bottom">
            <Link href="/" className="admin-store-link">
              View storefront &#8599;
            </Link>
            <LogoutButton />
          </div>
        </aside>
        <div className="admin-workspace">
          <header className="admin-topbar">
            <div>
              <button
                ref={toggle}
                type="button"
                className="admin-menu-toggle"
                onClick={() => setOpen(true)}
                aria-label="Open admin navigation"
                aria-expanded={open}
                aria-controls="admin-drawer"
              >
                &#9776;
              </button>
              <span>
                Workspace <span aria-hidden="true">/</span>{" "}
                <strong>{title}</strong>
              </span>
            </div>
            <div className="admin-identity">
              <span>{email}</span>
              <span className="admin-avatar" aria-hidden="true">
                {email.charAt(0).toUpperCase()}
              </span>
            </div>
          </header>
          <div className="admin-content">{children}</div>
        </div>
        <dialog
          ref={dialog}
          id="admin-drawer"
          className="admin-drawer"
          aria-label="Admin navigation drawer"
          onCancel={close}
        >
          <div className="admin-drawer-top">
            {brand}
            <button
              type="button"
              onClick={close}
              aria-label="Close admin navigation"
            >
              &times;
            </button>
          </div>
          {links(true)}
          <div className="admin-sidebar-bottom">
            <Link href="/">View storefront &#8599;</Link>
            <LogoutButton />
          </div>
        </dialog>
      </div>
    </AdminNoticeProvider>
  );
}
