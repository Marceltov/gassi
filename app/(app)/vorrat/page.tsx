import type { Metadata } from "next";
import { diary } from "@/backend";
import { StockScreen } from "@/components/StockScreen";

export const metadata: Metadata = { title: "Vorrat" };
export const dynamic = "force-dynamic";

export default async function Pantry() {
  const stock = await (await diary()).stock();
  return <StockScreen stock={stock} />;
}
