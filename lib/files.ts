import { randomBytes } from "node:crypto";
import { getMaxUploadBytes } from "./env";
import {
  DEFAULT_FOLDER_SLUG,
  FOLDER_MARKER_NAME,
  labelFromFolderSlug,
  normalizeFolderSlug,
  sanitizeFolderName,
  type StorageFolder
} from "./folders";
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
  folderSlug: string;
  folderLabel: string;
  createdAt: string | null;
  updatedAt: string | null;
  publicUrl: string;
};

function isFolder(item: StorageObject) {
  return item.id === null || item.metadata === null;
}

function isFolderMarkerPath(path: string) {
  return path.endsWith(`/${FOLDER_MARKER_NAME}`);
}

function isLegacyDateFolder(slug: string) {
  return /^\d{4}-\d{2}(-\d{2})?$/.test(slug);
}

function getFolderPrefix(slug: string) {
  return `${ROOT_PREFIX}/${normalizeFolderSlug(slug)}`;
}

function getFolderSlugFromPath(path: string) {
  const parts = path.split("/").filter(Boolean);

  if (parts.length < 3 || parts[0] !== ROOT_PREFIX) {
    return DEFAULT_FOLDER_SLUG;
  }

  const folderSlug = normalizeFolderSlug(parts[1]);

  return isLegacyDateFolder(folderSlug) ? DEFAULT_FOLDER_SLUG : folderSlug;
}

function getFileNameFromStoragePath(path: string) {
  return path.split("/").filter(Boolean).at(-1) || "arquivo";
}

function buildFolderMarkerPath(slug: string) {
  return `${getFolderPrefix(slug)}/${FOLDER_MARKER_NAME}`;
}

async function readFolderMarker(slug: string) {
  const supabase = getSupabaseAdmin();
  const bucket = await ensureBucket();
  const { data, error } = await supabase.storage.from(bucket).download(buildFolderMarkerPath(slug));

  if (error || !data) {
    return null;
  }

  try {
    return JSON.parse(await data.text()) as {
      label?: string;
      createdAt?: string | null;
      updatedAt?: string | null;
    };
  } catch {
    return null;
  }
}

async function upsertFolderMarker(slug: string, label: string, createdAt?: string | null) {
  const supabase = getSupabaseAdmin();
  const bucket = await ensureBucket();
  const marker = {
    label,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const { error } = await supabase.storage.from(bucket).upload(
    buildFolderMarkerPath(slug),
    JSON.stringify(marker),
    {
      contentType: "application/json",
      upsert: true
    }
  );

  if (error) {
    throw error;
  }
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

    if (isFolderMarkerPath(path)) {
      continue;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const folderSlug = getFolderSlugFromPath(path);

    documents.push({
      path,
      name: item.name,
      size: Number(item.metadata?.size ?? 0),
      mimeType: String(item.metadata?.mimetype ?? item.metadata?.mimeType ?? "application/octet-stream"),
      folderSlug,
      folderLabel: labelFromFolderSlug(folderSlug),
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      publicUrl: data.publicUrl
    });
  }

  return documents;
}

export async function listDocuments() {
  const documents = await listRecursive(ROOT_PREFIX);
  const folderLabels = new Map<string, string>();

  await Promise.all(
    Array.from(new Set(documents.map((document) => document.folderSlug))).map(async (slug) => {
      const marker = await readFolderMarker(slug);
      folderLabels.set(slug, sanitizeFolderName(marker?.label) || labelFromFolderSlug(slug));
    })
  );

  return documents
    .map((document) => ({
      ...document,
      folderLabel: folderLabels.get(document.folderSlug) ?? document.folderLabel
    }))
    .sort((left, right) => {
      const leftDate = new Date(left.createdAt ?? left.updatedAt ?? 0).getTime();
      const rightDate = new Date(right.createdAt ?? right.updatedAt ?? 0).getTime();

      return rightDate - leftDate;
    });
}

export async function listFolders(documents?: DocumentItem[]): Promise<StorageFolder[]> {
  const supabase = getSupabaseAdmin();
  const bucket = await ensureBucket();
  const currentDocuments = documents ?? (await listDocuments());
  const folderSlugs = new Set<string>([DEFAULT_FOLDER_SLUG]);
  const rootItems = await listPrefix(ROOT_PREFIX);

  for (const item of rootItems) {
    if (isFolder(item)) {
      const folderSlug = normalizeFolderSlug(item.name);

      if (!isLegacyDateFolder(folderSlug)) {
        folderSlugs.add(folderSlug);
      }
    }
  }

  for (const document of currentDocuments) {
    folderSlugs.add(document.folderSlug);
  }

  const folders = await Promise.all(
    Array.from(folderSlugs).map(async (slug) => {
      const marker = await readFolderMarker(slug);
      const folderDocuments = currentDocuments.filter((document) => document.folderSlug === slug);
      const markerMetadata = rootItems.find((item) => item.name === slug);

      return {
        slug,
        label: sanitizeFolderName(marker?.label) || labelFromFolderSlug(slug),
        count: folderDocuments.length,
        size: folderDocuments.reduce((sum, document) => sum + document.size, 0),
        isSystem: slug === DEFAULT_FOLDER_SLUG,
        createdAt: marker?.createdAt ?? markerMetadata?.created_at ?? null,
        updatedAt: marker?.updatedAt ?? markerMetadata?.updated_at ?? null
      } satisfies StorageFolder;
    })
  );

  return folders.sort((left, right) => {
    if (left.isSystem) {
      return -1;
    }

    if (right.isSystem) {
      return 1;
    }

    return left.label.localeCompare(right.label, "pt-BR");
  });
}

export async function createFolder(label: string) {
  const safeLabel = sanitizeFolderName(label);

  if (!safeLabel) {
    throw new Error("Informe o nome da pasta.");
  }

  const slug = normalizeFolderSlug(safeLabel);

  if (slug === DEFAULT_FOLDER_SLUG) {
    throw new Error("A pasta Geral ja existe.");
  }

  const folders = await listFolders();

  if (folders.some((folder) => folder.slug === slug)) {
    throw new Error("Ja existe uma pasta com esse nome.");
  }

  await upsertFolderMarker(slug, safeLabel);

  return {
    slug,
    label: safeLabel
  };
}

export async function renameFolder(slug: string, label: string) {
  const folderSlug = normalizeFolderSlug(slug);
  const safeLabel = sanitizeFolderName(label);

  if (folderSlug === DEFAULT_FOLDER_SLUG) {
    throw new Error("A pasta Geral nao pode ser renomeada.");
  }

  if (!safeLabel) {
    throw new Error("Informe o novo nome da pasta.");
  }

  const marker = await readFolderMarker(folderSlug);

  await upsertFolderMarker(folderSlug, safeLabel, marker?.createdAt);

  return {
    slug: folderSlug,
    label: safeLabel
  };
}

export async function deleteFolder(slug: string) {
  const folderSlug = normalizeFolderSlug(slug);

  if (folderSlug === DEFAULT_FOLDER_SLUG) {
    throw new Error("A pasta Geral nao pode ser excluida.");
  }

  const documents = await listDocuments();

  if (documents.some((document) => document.folderSlug === folderSlug)) {
    throw new Error("Mova ou exclua os arquivos antes de excluir a pasta.");
  }

  const supabase = getSupabaseAdmin();
  const bucket = await ensureBucket();
  const { error } = await supabase.storage.from(bucket).remove([buildFolderMarkerPath(folderSlug)]);

  if (error) {
    throw error;
  }
}

export async function moveDocumentToFolder(path: string, folder: string) {
  if (!path.startsWith(`${ROOT_PREFIX}/`) || isFolderMarkerPath(path)) {
    throw new Error("Arquivo invalido.");
  }

  const destinationFolder = normalizeFolderSlug(folder);
  const folders = await listFolders();

  if (!folders.some((item) => item.slug === destinationFolder)) {
    throw new Error("Pasta de destino nao encontrada.");
  }

  const currentFolder = getFolderSlugFromPath(path);

  if (currentFolder === destinationFolder) {
    return path;
  }

  const supabase = getSupabaseAdmin();
  const bucket = await ensureBucket();
  const fileName = getFileNameFromStoragePath(path);
  const destinationPath = `${getFolderPrefix(destinationFolder)}/${fileName}`;
  const { error } = await supabase.storage.from(bucket).move(path, destinationPath);

  if (error) {
    throw error;
  }

  return destinationPath;
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

export function buildStoragePath(fileName: string, folder?: string | null) {
  const unique = createShortId();
  const { baseName, extension } = splitFileName(fileName);
  const folderSlug = normalizeFolderSlug(folder);

  return `${ROOT_PREFIX}/${folderSlug}/${unique}-${baseName}${extension}`;
}

export async function createSignedDocumentUpload(fileName: string, fileSize: number, folder?: string | null) {
  const maxBytes = getMaxUploadBytes();

  if (fileSize <= 0) {
    throw new Error("Arquivo vazio.");
  }

  if (fileSize > maxBytes) {
    throw new Error(`Arquivo acima do limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }

  const supabase = getSupabaseAdmin();
  const bucket = await ensureBucket();
  const path = buildStoragePath(fileName, folder);
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
