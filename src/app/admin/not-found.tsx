import Link from "next/link";
export default function AdminNotFound() {
  return (
    <div className="admin-empty">
      <h1>Record not found.</h1>
      <p>This record may have been removed.</p>
      <Link href="/admin" className="admin-button">
        Back to dashboard
      </Link>
    </div>
  );
}
