import { ExternalLink, FileText, FolderOpen, LogOut } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import CopyButton from "@/components/copy-button";
import CreateFolderForm from "@/components/create-folder-form";
import DeleteButton from "@/components/delete-button";
import FolderActions from "@/components/folder-actions";
import MoveFileForm from "@/components/move-file-form";
import UploadForm from "@/components/upload-form";
import { getCurrentUser } from "@/lib/auth";
import { getMaxUploadBytes, getStorageCapacityBytes } from "@/lib/env";
import { toFriendlyError } from "@/lib/errors";
import { formatBytes, formatDate } from "@/lib/format";
import { normalizeFolderSlug } from "@/lib/folders";
import { type DocumentItem, listDocuments, listFolders } from "@/lib/files";
import { toToken } from "@/lib/links";

type DashboardPageProps = {
  searchParams?: Promise<{
    folder?: string;
  }>;
};

async function getBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  return `${protocol}://${host}`;
}

function getVisibleDocuments(documents: DocumentItem[], selectedFolder?: string | null) {
  if (!selectedFolder) {
    return [];
  }

  return documents.filter((document) => document.folderSlug === selectedFolder);
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const selectedFolder = params?.folder ? normalizeFolderSlug(params.folder) : null;
  const baseUrl = await getBaseUrl();
  let documents: DocumentItem[] = [];
  let setupError = "";

  try {
    documents = await listDocuments();
  } catch (error) {
    setupError = toFriendlyError(error, "Nao foi possivel conectar ao Supabase.");
  }

  const folders = await listFolders(documents);
  const activeFolder = selectedFolder ? folders.find((folder) => folder.slug === selectedFolder) : null;
  const visibleDocuments = getVisibleDocuments(documents, activeFolder?.slug);
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
            <p>Organize arquivos em pastas, compacte uploads e compartilhe links curtos.</p>
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

        <div className="workspace-grid">
          <section className="section upload-section">
            <div className="section-head">
              <h2>Novo arquivo</h2>
              <p>Escolha a pasta antes de importar. O arquivo sera compactado quando houver reducao segura.</p>
            </div>
            <div className="section-body">
              <UploadForm folders={folders} />
            </div>
          </section>

          <section className="section folder-panel explorer-panel" aria-label="Pastas de armazenamento">
            <div className="section-head explorer-head">
              <div>
                <h2>Pastas</h2>
                <p>Clique em uma pasta para abrir os arquivos.</p>
              </div>
              <CreateFolderForm />
            </div>

            {setupError ? (
              <p className="empty-state">{setupError}</p>
            ) : (
              <>
                <div className="vista-folder-grid">
                  {folders.map((folder) => {
                    const active = activeFolder?.slug === folder.slug;

                    return (
                      <article className={`vista-folder-card ${active ? "open" : ""}`} key={folder.slug}>
                        <a className="vista-folder-open" href={`/dashboard?folder=${folder.slug}`}>
                          <span className="vista-folder-icon" aria-hidden="true">
                            <span />
                          </span>
                          <span className="vista-folder-text">
                            <strong>{folder.label}</strong>
                            <small>
                              {folder.count} arquivo{folder.count === 1 ? "" : "s"} - {formatBytes(folder.size)}
                            </small>
                          </span>
                        </a>
                        <FolderActions folder={folder} />
                      </article>
                    );
                  })}
                </div>

                {activeFolder ? (
                  <section className="file-browser" aria-label={`Arquivos da pasta ${activeFolder.label}`}>
                    <div className="file-browser-head">
                      <div>
                        <h2>
                          <FolderOpen size={20} aria-hidden="true" />
                          {activeFolder.label}
                        </h2>
                        <p>
                          {visibleDocuments.length} arquivo{visibleDocuments.length === 1 ? "" : "s"} nesta pasta.
                        </p>
                      </div>
                    </div>

                    {visibleDocuments.length === 0 ? (
                      <p className="empty-state inline-empty">Nenhum arquivo nesta pasta ainda.</p>
                    ) : (
                      <div className="file-grid">
                        {visibleDocuments.map((document) => {
                          const viewUrl = `${baseUrl}/view/${toToken(document.path)}`;

                          return (
                            <article className="file-card" key={document.path}>
                              <div className="file-card-main">
                                <span className="file-card-icon">
                                  <FileText size={22} aria-hidden="true" />
                                </span>
                                <div>
                                  <strong title={document.name}>{document.name}</strong>
                                  <span>{document.mimeType}</span>
                                </div>
                              </div>
                              <dl className="file-meta">
                                <div>
                                  <dt>Tamanho</dt>
                                  <dd>{formatBytes(document.size)}</dd>
                                </div>
                                <div>
                                  <dt>Enviado em</dt>
                                  <dd>{formatDate(document.createdAt)}</dd>
                                </div>
                              </dl>
                              <div className="file-card-actions">
                                <CopyButton value={viewUrl} label="Copiar link de visualizacao" />
                                <CopyButton value={document.publicUrl} label="Copiar link direto" variant="direct" />
                                <a className="icon-button" href={viewUrl} target="_blank" rel="noreferrer" title="Abrir">
                                  <ExternalLink size={17} aria-hidden="true" />
                                  <span className="sr-only">Abrir</span>
                                </a>
                                <DeleteButton path={document.path} />
                              </div>
                              <MoveFileForm currentFolder={document.folderSlug} folders={folders} path={document.path} />
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                ) : (
                  <div className="closed-folder-state">
                    <span className="vista-folder-icon large" aria-hidden="true">
                      <span />
                    </span>
                    <strong>Abra uma pasta</strong>
                    <p>Os arquivos aparecem aqui somente depois que uma pasta for selecionada.</p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
