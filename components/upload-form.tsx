"use client";

import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { optimizeFileForStorage, type FileOptimizationResult } from "@/lib/client-file-optimizer";
import { formatBytes } from "@/lib/format";
import { DEFAULT_FOLDER_SLUG, type StorageFolder } from "@/lib/folders";
import CopyButton from "./copy-button";

type UploadResponse = {
  error?: string;
  path?: string;
  signedUrl?: string;
  viewerUrl?: string;
  publicUrl?: string;
};

type StatusKind = "info" | "success" | "error";

type UploadFormProps = {
  folders: StorageFolder[];
};

function getSuccessMessage(optimization: FileOptimizationResult, folderLabel: string) {
  if (optimization.changed) {
    return `Arquivo enviado em ${folderLabel}. Reduzido de ${formatBytes(optimization.originalSize)} para ${formatBytes(optimization.optimizedSize)}.`;
  }

  if (optimization.kind === "unsupported") {
    return `Arquivo enviado em ${folderLabel}.`;
  }

  return `Arquivo enviado em ${folderLabel}. ${optimization.detail}`;
}

async function uploadToSignedUrl(signedUrl: string, file: File) {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);

  const response = await fetch(signedUrl, {
    method: "PUT",
    body
  });

  if (!response.ok) {
    let detail = `Falha no upload direto (${response.status}).`;

    try {
      const data = (await response.json()) as { error?: string; message?: string };
      detail = data.error || data.message || detail;
    } catch {
      // The Storage API may return plain text for some errors.
    }

    throw new Error(detail);
  }
}

export default function UploadForm({ folders }: UploadFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>("info");
  const [viewerUrl, setViewerUrl] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    const folder = String(formData.get("folder") || DEFAULT_FOLDER_SLUG);
    const folderLabel = folders.find((item) => item.slug === folder)?.label ?? "Geral";

    setBusy(true);
    setMessage("");
    setStatusKind("info");
    setViewerUrl("");

    try {
      if (!(file instanceof File)) {
        throw new Error("Arquivo nao enviado.");
      }

      setMessage("Otimizando arquivo...");
      const optimized = await optimizeFileForStorage(file);
      const uploadFile = optimized.file;

      setMessage("Gerando link de upload...");
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName: uploadFile.name,
          fileSize: uploadFile.size,
          folder
        })
      });
      const data = (await response.json()) as UploadResponse;

      if (!response.ok) {
        throw new Error(data.error || "Falha ao enviar arquivo.");
      }

      if (!data.signedUrl) {
        throw new Error("URL de upload nao gerada.");
      }

      setMessage("Enviando arquivo...");
      await uploadToSignedUrl(data.signedUrl, uploadFile);

      setStatusKind("success");
      setMessage(getSuccessMessage(optimized, folderLabel));
      setViewerUrl(data.viewerUrl || "");
      form.reset();
      router.refresh();
    } catch (error) {
      setStatusKind("error");
      setMessage(error instanceof Error ? error.message : "Falha ao enviar arquivo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Arquivo</span>
        <input
          className="file-input"
          type="file"
          name="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*"
          required
        />
      </label>

      <label className="field">
        <span>Pasta</span>
        <select className="input" name="folder" defaultValue={DEFAULT_FOLDER_SLUG}>
          {folders.map((folder) => (
            <option key={folder.slug} value={folder.slug}>
              {folder.label}
            </option>
          ))}
        </select>
      </label>

      <button className="button" type="submit" disabled={busy}>
        {busy ? <Loader2 size={18} aria-hidden="true" /> : <Upload size={18} aria-hidden="true" />}
        {busy ? "Enviando" : "Enviar arquivo"}
      </button>

      {message ? (
        <p className={`status ${statusKind}`}>
          {statusKind === "success" ? <CheckCircle2 size={16} aria-hidden="true" /> : null}
          {statusKind === "info" ? <Loader2 size={16} aria-hidden="true" /> : null}
          {message}
        </p>
      ) : null}

      {viewerUrl ? (
        <div className="link-result">
          <span className="muted">Link gerado</span>
          <code>{viewerUrl}</code>
          <CopyButton value={viewerUrl} label="Copiar link gerado" />
        </div>
      ) : null}
    </form>
  );
}
