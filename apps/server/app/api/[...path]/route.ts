import { api } from "@/backend";

// Every endpoint of the API contract (packages/api-client); backend/http/router.ts finds the one asked for.
export const dynamic = "force-dynamic";
export const GET = api;
export const POST = api;
export const PATCH = api;
export const DELETE = api;
