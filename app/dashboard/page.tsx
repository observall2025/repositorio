import {
  Archive,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  FileText,
  Folder,
  FolderOpen,
  Image,
  LogOut,
  ReceiptText
} from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import CopyButton from "@/components/copy-button";
import DeleteButton from "@/components/delete-button";
import UploadForm from "@/components/upload-form";
import { getCurrentUser } from "@/lib/auth";
import { getStorageCategories, normalizeCategorySlug, type StorageCategory } from "@/lib/categories";
import { getMaxUploadBytes, getStorageCapacityBytes } from "@/lib/env";
import { toFriendlyError } from "@/lib/errors";
import { formatBytes, formatDate } from "@/lib/format";
import { toToken } from "@/lib/links";
import { type DocumentItem, listDocuments } from "@/lib/files";

type DashboardPageProps = {
  searchParams?: Promise<{
    category?: string;
  }>;
};

async function getBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  return `${protocol}://${host}`;
}

function getCategoryIcon(slug: string) {
  if (slug === "checklists") {
    return ClipboardCheck;
  }

  if (slug === "relatorios") {
    return FileText;
  }

  if (slug === "contratos") {
    return FileCheck2;
  }

  if (slug === "financeiro") {
    return ReceiptText;
  }

  if (slug === "imagens") {
    return Image;
  }

  if (slug === "outros") {
    return Archive;
  }

  return Folder;
}

function getCategoryStats(documents: DocumentItem[], categories: StorageCategory[]) {
  return categories.map((category) => {
    const categoryDocuments = documents.filter((document) => document.categorySlug === category.slug);

    return {
      ...category,
      count: categoryDocuments.length,
      size: categoryDocuments.reduce((sum, document) => sum + document.size, 0)
    };
  });
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const categories = getStorageCategories();
  const selectedCategory = params?.category ? normalizeCategorySlug(params.category) : "todos";
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
  const categoryStats = getCategoryStats(documents, categories);
  const visibleDocuments =
    selectedCategory === "todos"
      ? documents
      : documents.filter((document) => document.categorySlug === selectedCategory);
  const selectedCategoryLabel =
    selectedCategory === "todos"
      ? "Todos os arquivos"
      : categories.find((category) => category.slug === selectedCategory)?.label ?? "Geral";

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

        <section className="folder-panel" aria-label="Pastas de armazenamento">
          <div className="folder-head">
            <div>
              <h2>Pastas</h2>
              <p>Organize os arquivos por categoria no Storage.</p>
            </div>
            <a className={`folder-chip ${selectedCategory === "todos" ? "active" : ""}`} href="/dashboard">
              <FolderOpen size={17} aria-hidden="true" />
              Todos
            </a>
          </div>

          <div className="folder-grid">
            {categoryStats.map((category) => {
              const Icon = getCategoryIcon(category.slug);
              const active = selectedCategory === category.slug;

              return (
                <a
                  className={`folder-card ${active ? "active" : ""}`}
                  href={`/dashboard?category=${category.slug}`}
                  key={category.slug}
                >
                  <span className="folder-icon">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{category.label}</strong>
                    <small>{category.count} arquivo{category.count === 1 ? "" : "s"}</small>
                  </span>
                  <em>{formatBytes(category.size)}</em>
                </a>
              );
            })}
          </div>
        </section>

        <div className="grid">
          <section className="section">
            <div className="section-head">
              <h2>Novo arquivo</h2>
              <p>PDFs, documentos Office e imagens sao compactados antes do envio quando houver reducao segura.</p>
            </div>
            <div className="section-body">
              <UploadForm categories={categories} />
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>{selectedCategoryLabel}</h2>
              <p>Use o link de visualizacao para incorporar ou o link direto quando preferir abrir o arquivo bruto.</p>
            </div>

            {setupError ? (
              <p className="empty-state">{setupError}</p>
            ) : visibleDocuments.length === 0 ? (
              <p className="empty-state">Nenhum arquivo nesta pasta ainda.</p>
            ) : (
              <div className="table-wrap">
                <table className="files-table">
                  <thead>
                    <tr>
                      <th>Arquivo</th>
                      <th>Categoria</th>
                      <th>Tamanho</th>
                      <th>Enviado em</th>
                      <th aria-label="Acoes" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDocuments.map((document) => {
                      const viewUrl = `${baseUrl}/view/${toToken(document.path)}`;

                      return (
                        <tr key={document.path}>
                          <td>
                            <div className="file-name">
                              <span className="file-icon">
                                <FileText size={18} aria-hidden="true" />
                              </span>
                              <div>
                                <strong title={document.name}>{document.name}</strong>
                                <span>{document.mimeType}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="category-badge">{document.categoryLabel}</span>
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
