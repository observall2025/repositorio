import { Download } from "lucide-react";
import { notFound } from "next/navigation";
import { getBucketName } from "@/lib/env";
import { getFileNameFromPath, fromToken, isBrowserDocument, isImage } from "@/lib/links";
import { getSupabaseAdmin } from "@/lib/supabase";

type ViewPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function ViewPage({ params }: ViewPageProps) {
  const { token } = await params;
  const path = fromToken(token);

  if (!path || !path.startsWith("uploads/")) {
    notFound();
  }

  const supabase = getSupabaseAdmin();
  const { data } = supabase.storage.from(getBucketName()).getPublicUrl(path);
  const fileName = getFileNameFromPath(path);

  return (
    <main className="viewer-page">
      <header className="viewer-bar">
        <strong title={fileName}>{fileName}</strong>
        <a className="button secondary" href={data.publicUrl} target="_blank" rel="noreferrer">
          <Download size={18} aria-hidden="true" />
          Baixar
        </a>
      </header>

      {isImage(path) ? (
        <div className="viewer-image">
          <img src={data.publicUrl} alt={fileName} />
        </div>
      ) : isBrowserDocument(path) ? (
        <iframe className="viewer-frame" src={data.publicUrl} title={fileName} />
      ) : (
        <div className="viewer-fallback">
          <div className="viewer-fallback-box">
            <h1 className="panel-title">Arquivo disponivel</h1>
            <p className="panel-copy">Este formato pode abrir melhor como download direto.</p>
            <a className="button" href={data.publicUrl} target="_blank" rel="noreferrer">
              <Download size={18} aria-hidden="true" />
              Abrir arquivo
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
