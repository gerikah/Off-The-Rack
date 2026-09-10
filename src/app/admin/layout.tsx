import type { Metadata } from "next";
import "./admin.css";
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
  description: "Off The Rack internal workspace.",
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="admin-root">{children}</div>;
}
