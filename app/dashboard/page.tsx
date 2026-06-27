import { ExternalLink, FileArchive, LogOut } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import CopyButton from "@/components/copy-button";
import DeleteButton from "@/components/delete-button";
import UploadForm from "@/components/upload-form";
import { getCurrentUser } from "@/lib/auth";
import { getMaxUploadBytes, getStorageCapacityBytes } from "@/lib/env";
import { toFriendlyError } from "@/lib/errors";
import { formatBytes, formatDate } from "@/lib/format";
import { toToken } from "@/lib/links";
import { type DocumentItem, listDocuments } from "@/lib/files";

async function getBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  return `${protocol}://${host}`;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const baseUrl = await getBaseUrl();
  let documents: DocumentItem[] = [];
  let setupError = "";

  try {
    documents = await listDocuments();
  } catch (error) {
    setupError = toFriendlyError(error, "Nao foi possivel conectar ao Supabase.");
  }

  const totalBytes = documents.reduce((sum, item) => sum + item.size, 0);
  const storageCapacityBytes = getStorageCapacityBytes();
  const maxUploadBytes = getMaxUploadBytes();
  const storagePercent = Math.min((totalBytes / storageCapacityBytes) * 100, 100);
  const remainingBytes = Math.max(storageCapacityBytes - totalBytes, 0);

  return (
    <main className="page">
      <div className="shell">
        <header className="header">
          <div>
            <h1>Repositorio de documentos</h1>
            <p>Envie arquivos, copie o link e use na plataforma principal.</p>
          </div>
          <form action="/api/logout" method="post">
            <button className="button secondary" type="submit">
              <LogOut size={18} aria-hidden="true" />
              Sair
            </button>
          </form>
        </header>

        <section className="metrics" aria-label="Resumo">
          <div className="metric">
            <span>Arquivos</span>
            <strong>{documents.length}</strong>
          </div>
          <div className="metric">
            <span>Em uso</span>
            <strong>{formatBytes(totalBytes)}</strong>
          </div>
          <div className="metric">
            <span>Capacidade total</span>
            <strong>{formatBytes(storageCapacityBytes)}</strong>
          </div>
          <div className="metric">
            <span>Limite por arquivo</span>
            <strong>{formatBytes(maxUploadBytes)}</strong>
          </div>
        </section>

        <section className="storage-panel" aria-label="Uso do armazenamento">
          <div>
            <span className="storage-label">Armazenamento do bucket</span>
            <strong>
              {formatBytes(totalBytes)} de {formatBytes(storageCapacityBytes)}
            </strong>
          </div>
          <div className="storage-progress" aria-hidden="true">
            <span style={{ width: `${storagePercent}%` }} />
          </div>
          <div className="storage-foot">
            <span>{storagePercent.toFixed(storagePercent >= 10 ? 0 : 1)}% usado</span>
            <span>{formatBytes(remainingBytes)} disponivel</span>
          </div>
        </section>

        <div className="grid">
          <section className="section">
            <div className="section-head">
              <h2>Novo arquivo</h2>
              <p>PDFs, documentos Office e imagens sao compactados antes do envio quando houver reducao segura.</p>
            </div>
            <div className="section-body">
              <UploadForm />
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Arquivos enviados</h2>
              <p>Use o link de visualizacao para incorporar ou o link direto quando preferir abrir o arquivo bruto.</p>
            </div>

            {setupError ? (
              <p className="empty-state">{setupError}</p>
            ) : documents.length === 0 ? (
              <p className="empty-state">Nenhum arquivo enviado ainda.</p>
            ) : (
              <div className="table-wrap">
                <table className="files-table">
                  <thead>
                    <tr>
                      <th>Arquivo</th>
                      <th>Tamanho</th>
                      <th>Enviado em</th>
                      <th aria-label="Acoes" />
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((document) => {
                      const viewUrl = `${baseUrl}/view/${toToken(document.path)}`;

                      return (
                        <tr key={document.path}>
                          <td>
                            <div className="file-name">
                              <span className="file-icon">
                                <FileArchive size={18} aria-hidden="true" />
                              </span>
                              <div>
                                <strong title={document.name}>{document.name}</strong>
                                <span>{document.mimeType}</span>
                              </div>
                            </div>
                          </td>
                          <td>{formatBytes(document.size)}</td>
                          <td>{formatDate(document.createdAt)}</td>
                          <td>
                            <div className="actions">
                              <CopyButton value={viewUrl} label="Copiar link de visualizacao" />
                              <CopyButton value={document.publicUrl} label="Copiar link direto" variant="direct" />
                              <a className="icon-button" href={viewUrl} target="_blank" rel="noreferrer" title="Abrir">
                                <ExternalLink size={17} aria-hidden="true" />
                                <span className="sr-only">Abrir</span>
                              </a>
                              <DeleteButton path={document.path} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
