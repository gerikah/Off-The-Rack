import { redirect } from "next/navigation";

// Retired page: preserve existing bookmarks without exposing an Archive panel.
export default function RetiredArchivePage() {
  redirect("/shop?status=sold");
}
