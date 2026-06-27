import { Download } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getBucketName } from "@/lib/env";
import { resolveDocumentPathFromToken } from "@/lib/files";
import { getFileNameFromPath, isBrowserDocument, isImage, isOfficeDocument, isPdf, toToken } from "@/lib/links";
import { getSupabaseAdmin } from "@/lib/supabase";

type ViewPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function ViewPage({ params }: ViewPageProps) {
  const { token } = await params;
  const path = await resolveDocumentPathFromToken(token);

  if (!path || !path.startsWith("uploads/")) {
    notFound();
  }

  const canonicalToken = toToken(path);

  if (token !== canonicalToken) {
    redirect(`/view/${canonicalToken}`);
  }

  const supabase = getSupabaseAdmin();
  const { data } = supabase.storage.from(getBucketName()).getPublicUrl(path);
  const fileName = getFileNameFromPath(path);
  const publicUrl = data.publicUrl;
  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`;
  const browserDocumentUrl = isPdf(path) ? `${publicUrl}#toolbar=0&navpanes=0&view=FitH` : publicUrl;

  return (
    <main className="viewer-page">
      <header className="viewer-bar">
        <strong title={fileName}>{fileName}</strong>
        <a className="button secondary" href={publicUrl} target="_blank" rel="noreferrer">
          <Download size={18} aria-hidden="true" />
          Baixar
        </a>
      </header>

      {isImage(path) ? (
        <div className="viewer-image">
          <img src={publicUrl} alt={fileName} />
        </div>
      ) : isBrowserDocument(path) ? (
        <iframe className="viewer-frame" src={browserDocumentUrl} title={fileName} />
      ) : isOfficeDocument(path) ? (
        <iframe className="viewer-frame office-frame" src={officeViewerUrl} title={fileName} />
      ) : (
        <div className="viewer-fallback">
          <div className="viewer-fallback-box">
            <h1 className="panel-title">Visualizacao indisponivel</h1>
            <p className="panel-copy">Este formato ainda nao tem renderizacao no navegador.</p>
            <a className="button" href={publicUrl} target="_blank" rel="noreferrer">
              <Download size={18} aria-hidden="true" />
              Baixar
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
