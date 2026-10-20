"use client";

import { IconCloudUpload } from "@tabler/icons-react";

// How many taps are still on this phone, waiting for reception. Nothing when all are sent.
export function PendingHint({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p className="mt-3 flex items-center justify-center gap-2 text-muted">
      <IconCloudUpload size={20} aria-hidden /> {count} noch nicht gesendet
    </p>
  );
}
