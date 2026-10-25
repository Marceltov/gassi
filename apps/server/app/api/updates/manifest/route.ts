import { appUpdate } from "@/backend";

// The Android app's update (expo-updates protocol, backend/updates.ts); outside the API contract, which is JSON.
export const dynamic = "force-dynamic";
export const GET = appUpdate;
