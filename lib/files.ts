import { randomBytes } from "node:crypto";
import { getCategoryFromStoragePath, normalizeCategorySlug } from "./categories";
import { getMaxUploadBytes } from "./env";
import { fromToken, isDocumentHashToken, matchesDocumentToken } from "./links";
import { ensureBucket, getSupabaseAdmin } from "./supabase";

const ROOT_PREFIX = "uploads";
const SHORT_NAME_MAX_LENGTH = 32;

type StorageObject = {
  id: string | null;
  name: string;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DocumentItem = {
  path: string;
  name: string;
  size: number;
  mimeType: string;
  categorySlug: string;
  categoryLabel: string;
  createdAt: string | null;
  updatedAt: string | null;
  publicUrl: string;
};

function isFolder(item: StorageObject) {
  return item.id === null || item.metadata === null;
}

async function listPrefix(prefix: string): Promise<StorageObject[]> {
  const supabase = getSupabaseAdmin();
  const bucket = await ensureBucket();
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: {
      column: "created_at",
      order: "desc"
    }
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as StorageObject[];
}

async function listRecursive(prefix: string): Promise<DocumentItem[]> {
  const supabase = getSupabaseAdmin();
  const bucket = await ensureBucket();
  const items = await listPrefix(prefix);
  const documents: DocumentItem[] = [];

  for (const item of items) {
    const path = `${prefix}/${item.name}`;

    if (isFolder(item)) {
      documents.push(...(await listRecursive(path)));
      continue;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const category = getCategoryFromStoragePath(path);

    documents.push({
      path,
      name: item.name,
      size: Number(item.metadata?.size ?? 0),
      mimeType: String(item.metadata?.mimetype ?? item.metadata?.mimeType ?? "application/octet-stream"),
      categorySlug: category.slug,
      categoryLabel: category.label,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      publicUrl: data.publicUrl
    });
  }

  return documents;
}

export async function listDocuments() {
  const documents = await listRecursive(ROOT_PREFIX);

  return documents.sort((left, right) => {
    const leftDate = new Date(left.createdAt ?? left.updatedAt ?? 0).getTime();
    const rightDate = new Date(right.createdAt ?? right.updatedAt ?? 0).getTime();

    return rightDate - leftDate;
  });
}

export async function resolveDocumentPathFromToken(token: string) {
  const decodedPath = fromToken(token);

  if (decodedPath?.startsWith(`${ROOT_PREFIX}/`)) {
    const storageName = decodedPath.slice(ROOT_PREFIX.length + 1);

    if (storageName.includes("/")) {
      return decodedPath;
    }

    const documents = await listDocuments();

    return (
      documents.find((document) => document.path === decodedPath)?.path ??
      documents.find((document) => document.name === storageName)?.path ??
      decodedPath
    );
  }

  if (!isDocumentHashToken(token)) {
    return null;
  }

  const documents = await listDocuments();

  return documents.find((document) => matchesDocumentToken(token, document.path))?.path ?? null;
}

export function sanitizeFileName(name: string) {
  const fallback = "documento";
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140);

  return cleaned || fallback;
}

function createShortId() {
  return randomBytes(8).toString("base64url");
}

function splitFileName(fileName: string) {
  const safeName = sanitizeFileName(fileName);
  const extensionStart = safeName.lastIndexOf(".");
  const hasExtension = extensionStart > 0 && extensionStart < safeName.length - 1;

  if (!hasExtension) {
    return {
      baseName: safeName.slice(0, SHORT_NAME_MAX_LENGTH).replace(/-$/g, "") || "documento",
      extension: ""
    };
  }

  const extension = safeName.slice(extensionStart).toLowerCase();
  const baseName = safeName.slice(0, extensionStart).slice(0, SHORT_NAME_MAX_LENGTH).replace(/-$/g, "");

  return {
    baseName: baseName || "documento",
    extension
  };
}

export function buildStoragePath(fileName: string, category?: string | null) {
  const unique = createShortId();
  const { baseName, extension } = splitFileName(fileName);
  const categorySlug = normalizeCategorySlug(category);

  return `${ROOT_PREFIX}/${categorySlug}/${unique}-${baseName}${extension}`;
}

export async function createSignedDocumentUpload(fileName: string, fileSize: number, category?: string | null) {
  const maxBytes = getMaxUploadBytes();

  if (fileSize <= 0) {
    throw new Error("Arquivo vazio.");
  }

  if (fileSize > maxBytes) {
    throw new Error(`Arquivo acima do limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }

  const supabase = getSupabaseAdmin();
  const bucket = await ensureBucket();
  const path = buildStoragePath(fileName, category);
  const { data: signedUpload, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path, {
    upsert: false
  });

  if (error) {
    throw error;
  }

  if (!signedUpload) {
    throw new Error("URL de upload nao gerada.");
  }

  const { data: publicFile } = supabase.storage.from(bucket).getPublicUrl(path);

  return {
    path,
    signedUrl: signedUpload.signedUrl,
    publicUrl: publicFile.publicUrl
  };
}

export async function deleteDocument(path: string) {
  const supabase = getSupabaseAdmin();
  const bucket = await ensureBucket();
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    throw error;
  }
}
