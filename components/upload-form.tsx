"use client";

import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { canRenderPdf, renderPdfToStorage } from "@/lib/pdf-render-client";
import CopyButton from "./copy-button";

type UploadResponse = {
  error?: string;
  path?: string;
  signedUrl?: string;
  viewerUrl?: string;
  publicUrl?: string;
};

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

export default function UploadForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [viewerUrl, setViewerUrl] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");

    setBusy(true);
    setMessage("");
    setViewerUrl("");

    try {
      if (!(file instanceof File)) {
        throw new Error("Arquivo nao enviado.");
      }

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size
        })
      });
      const data = (await response.json()) as UploadResponse;

      if (!response.ok) {
        throw new Error(data.error || "Falha ao enviar arquivo.");
      }

      if (!data.signedUrl) {
        throw new Error("URL de upload nao gerada.");
      }

      await uploadToSignedUrl(data.signedUrl, file);

      setMessage("Arquivo enviado.");

      if (data.path && canRenderPdf(file)) {
        setMessage("Arquivo enviado. Renderizando paginas...");
        const pages = await renderPdfToStorage(data.path, file, ({ page, total }) => {
          setMessage(`Renderizando pagina ${page} de ${total}...`);
        });
        setMessage(`Arquivo enviado e renderizado (${pages} paginas).`);
      }

      setViewerUrl(data.viewerUrl || "");
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao enviar arquivo.");
    } finally {
      setBusy(false);
    }
  }

  const success = Boolean(viewerUrl);

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

      <button className="button" type="submit" disabled={busy}>
        {busy ? <Loader2 size={18} aria-hidden="true" /> : <Upload size={18} aria-hidden="true" />}
        {busy ? "Enviando" : "Enviar arquivo"}
      </button>

      {message ? (
        <p className={`status ${success ? "success" : "error"}`}>
          {success ? <CheckCircle2 size={16} aria-hidden="true" /> : null}
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
