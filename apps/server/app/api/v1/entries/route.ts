import { apiEntries } from "@/backend";

// 404 unless API_TOKEN is set; then bearer-token auth (backend/http/api.ts).
export const dynamic = "force-dynamic";
export const GET = apiEntries;
export const POST = apiEntries;
