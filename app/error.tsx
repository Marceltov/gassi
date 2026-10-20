"use client";

import { Notice, noticeButton } from "@/components/Notice";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Notice
      title="Etwas ist schiefgegangen"
      text="Gassi konnte die Seite gerade nicht laden. Versuch es noch einmal; wenn es so bleibt, sieh in die Server-Logs."
      action={
        <button type="button" onClick={reset} className={noticeButton}>
          Noch einmal versuchen
        </button>
      }
    />
  );
}
