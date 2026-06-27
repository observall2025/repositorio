"use client";

import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { StorageFolder } from "@/lib/folders";

type ApiResponse = {
  error?: string;
};

type FolderActionsProps = {
  folder: StorageFolder;
};

export default function FolderActions({ folder }: FolderActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (folder.isSystem) {
    return null;
  }

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const label = String(formData.get("label") || "").trim();

    if (!label) {
      setMessage("Informe o nome da pasta.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/folders/${folder.slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ label })
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Falha ao renomear pasta.");
      }

      setEditing(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao renomear pasta.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/folders/${folder.slug}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Falha ao excluir pasta.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao excluir pasta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="folder-actions">
      {editing ? (
        <form className="folder-edit" onSubmit={handleRename}>
          <input className="input" name="label" defaultValue={folder.label} maxLength={48} disabled={busy} />
          <button className="icon-button" type="submit" disabled={busy} title="Salvar nome">
            {busy ? <Loader2 size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            <span className="sr-only">Salvar nome</span>
          </button>
          <button className="icon-button" type="button" onClick={() => setEditing(false)} disabled={busy} title="Cancelar">
            <X size={16} aria-hidden="true" />
            <span className="sr-only">Cancelar</span>
          </button>
        </form>
      ) : (
        <div className="folder-action-row">
          <button className="icon-button" type="button" onClick={() => setEditing(true)} disabled={busy} title="Renomear pasta">
            <Pencil size={15} aria-hidden="true" />
            <span className="sr-only">Renomear pasta</span>
          </button>
          <button className="icon-button danger-icon" type="button" onClick={handleDelete} disabled={busy} title="Excluir pasta vazia">
            {busy ? <Loader2 size={15} aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}
            <span className="sr-only">Excluir pasta vazia</span>
          </button>
        </div>
      )}
      {message ? <p className="form-note error-text">{message}</p> : null}
    </div>
  );
}
