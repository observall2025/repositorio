import { randomUUID } from "node:crypto";
import { getMaxUploadBytes } from "./env";
import { ensureBucket, getSupabaseAdmin } from "./supabase";

const ROOT_PREFIX = "uploads";

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
  createdAt: string | null;
  updatedAt: string | null;
  publicUrl: string;
};

export type RenderedPage = {
  path: string;
  name: string;
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

    documents.push({
      path,
      name: item.name,
      size: Number(item.metadata?.size ?? 0),
      mimeType: String(item.metadata?.mimetype ?? item.metadata?.mimeType ?? "application/octet-stream"),
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

export function buildStoragePath(fileName: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const unique = randomUUID().slice(0, 8);

  return `${ROOT_PREFIX}/${year}-${month}/${year}-${month}-${day}-${unique}-${sanitizeFileName(fileName)}`;
}

export function getRenderedPrefix(path: string) {
  return `renders/${path.replace(/\.[^/.]+$/g, "")}`;
}

export function buildRenderedPagePath(sourcePath: string, page: number) {
  return `${getRenderedPrefix(sourcePath)}/page-${String(page).padStart(3, "0")}.jpg`;
}

export async function listRenderedPages(sourcePath: string) {
  const supabase = getSupabaseAdmin();
  const bucket = await ensureBucket();
  const prefix = getRenderedPrefix(sourcePath);
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 500,
    sortBy: {
      column: "name",
      order: "asc"
    }
  });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((item) => !isFolder(item) && /\.jpe?g$/i.test(item.name))
    .map((item) => {
      const path = `${prefix}/${item.name}`;
      const { data: publicFile } = supabase.storage.from(bucket).getPublicUrl(path);

      return {
        path,
        name: item.name,
        publicUrl: publicFile.publicUrl
      } satisfies RenderedPage;
    });
}

export async function createSignedDocumentUpload(fileName: string, fileSize: number) {
  const maxBytes = getMaxUploadBytes();

  if (fileSize <= 0) {
    throw new Error("Arquivo vazio.");
  }

  if (fileSize > maxBytes) {
    throw new Error(`Arquivo acima do limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }

  const supabase = getSupabaseAdmin();
  const bucket = await ensureBucket();
  const path = buildStoragePath(fileName);
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

export async function createSignedRenderedPageUpload(sourcePath: string, page: number, fileSize: number) {
  const maxBytes = 8 * 1024 * 1024;

  if (!sourcePath.startsWith(`${ROOT_PREFIX}/`)) {
    throw new Error("Arquivo de origem invalido.");
  }

  if (!Number.isInteger(page) || page <= 0 || page > 500) {
    throw new Error("Pagina invalida.");
  }

  if (fileSize <= 0 || fileSize > maxBytes) {
    throw new Error("Pagina renderizada acima do limite.");
  }

  const supabase = getSupabaseAdmin();
  const bucket = await ensureBucket();
  const path = buildRenderedPagePath(sourcePath, page);
  const { data: signedUpload, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path, {
    upsert: true
  });

  if (error) {
    throw error;
  }

  if (!signedUpload) {
    throw new Error("URL de upload nao gerada.");
  }

  return {
    path,
    signedUrl: signedUpload.signedUrl
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
