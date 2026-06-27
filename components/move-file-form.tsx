"use client";

import { FolderInput, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { StorageFolder } from "@/lib/folders";

type ApiResponse = {
  error?: string;
};

type MoveFileFormProps = {
  currentFolder: string;
  folders: StorageFolder[];
  path: string;
};

export default function MoveFileForm({ currentFolder, folders, path }: MoveFileFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const folder = String(formData.get("folder") || "");

    if (!folder || folder === currentFolder) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          folder,
          path
        })
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Falha ao mover arquivo.");
      }

      router.push(`/dashboard?folder=${folder}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao mover arquivo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="move-file-form" onSubmit={handleSubmit}>
      <select className="input compact-input" name="folder" defaultValue={currentFolder} disabled={busy}>
        {folders.map((folder) => (
          <option key={folder.slug} value={folder.slug}>
            {folder.label}
          </option>
        ))}
      </select>
      <button className="icon-button" type="submit" disabled={busy} title="Mover arquivo">
        {busy ? <Loader2 size={16} aria-hidden="true" /> : <FolderInput size={16} aria-hidden="true" />}
        <span className="sr-only">Mover arquivo</span>
      </button>
      {message ? <p className="form-note error-text">{message}</p> : null}
    </form>
  );
}
