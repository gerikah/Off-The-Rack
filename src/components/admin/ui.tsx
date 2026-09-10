import Link from "next/link";
export function ImagePlaceholder({
  large = false,
  label = "No image",
}: {
  large?: boolean;
  label?: string;
}) {
  return (
    <div
      className={"admin-image-placeholder" + (large ? " is-large" : "")}
      role="img"
      aria-label={label}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8" cy="8" r="1.5" />
        <path d="m3 17 5-5 4 4 4-6 5 7" />
      </svg>
      {large && <span>{label}</span>}
    </div>
  );
}
export function StatusBadge({ status }: { status: string }) {
  return <span className={"admin-badge status-" + status}>{status}</span>;
}
export function AdminHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="admin-page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function AdminEmpty({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="admin-empty">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {href && (
        <Link className="admin-button" href={href}>
          {label}
        </Link>
      )}
    </div>
  );
}
export function adminDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}
