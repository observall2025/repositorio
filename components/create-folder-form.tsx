"use client";

import { FolderPlus, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ApiResponse = {
  error?: string;
  slug?: string;
};

export default function CreateFolderForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const label = String(formData.get("label") || "").trim();

    if (!label) {
      setMessage("Informe o nome da pasta.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ label })
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Falha ao criar pasta.");
      }

      form.reset();
      router.push(`/dashboard?folder=${data.slug || ""}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar pasta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="folder-create" onSubmit={handleSubmit}>
      <input className="input" name="label" placeholder="Nova pasta" type="text" maxLength={48} disabled={busy} />
      <button className="button" type="submit" disabled={busy}>
        {busy ? <Loader2 size={17} aria-hidden="true" /> : <FolderPlus size={17} aria-hidden="true" />}
        Criar
      </button>
      {message ? <p className="form-note error-text">{message}</p> : null}
    </form>
  );
}
