"use client";

import { ImageUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { renderPdfToStorage } from "@/lib/pdf-render-client";

type RenderButtonProps = {
  name: string;
  path: string;
  publicUrl: string;
};

export default function RenderButton({ name, path, publicUrl }: RenderButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("Renderizar visualizacao");

  async function handleClick() {
    setBusy(true);
    setLabel("Baixando original");

    try {
      const response = await fetch(publicUrl);

      if (!response.ok) {
        throw new Error("Nao foi possivel baixar o arquivo original.");
      }

      const blob = await response.blob();
      const file = new File([blob], name, {
        type: blob.type || "application/pdf"
      });

      await renderPdfToStorage(path, file, ({ page, total }) => {
        setLabel(`Pagina ${page}/${total}`);
      });

      setLabel("Renderizado");
      router.refresh();
    } catch (error) {
      setLabel(error instanceof Error ? error.message : "Falha ao renderizar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="icon-button" type="button" onClick={handleClick} disabled={busy} title={label}>
      {busy ? <Loader2 size={17} aria-hidden="true" /> : <ImageUp size={17} aria-hidden="true" />}
      <span className="sr-only">{label}</span>
    </button>
  );
}
