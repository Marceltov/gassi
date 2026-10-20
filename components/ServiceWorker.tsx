"use client";

import { useEffect } from "react";

// Registers public/sw.js, in production builds only (in development it would cache what is being changed).
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
