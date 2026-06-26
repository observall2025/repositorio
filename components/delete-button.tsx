"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteButtonProps = {
  path: string;
};

export default function DeleteButton({ path }: DeleteButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Excluir este arquivo?")) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ path })
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Falha ao excluir.");
      }

      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Falha ao excluir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="icon-button" type="button" onClick={handleDelete} disabled={busy} title="Excluir">
      <Trash2 size={17} aria-hidden="true" />
      <span className="sr-only">Excluir</span>
    </button>
  );
}
