import { HomeLink, Notice } from "@/components/Notice";

export default function NotFound() {
  return <Notice title="Nicht gefunden" text="Diese Seite gibt es in Gassi nicht." action={<HomeLink />} />;
}
