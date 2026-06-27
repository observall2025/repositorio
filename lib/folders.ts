export type StorageFolder = {
  slug: string;
  label: string;
  count: number;
  size: number;
  isSystem: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export const DEFAULT_FOLDER_SLUG = "geral";
export const FOLDER_MARKER_NAME = ".folder.json";

export function sanitizeFolderName(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 48);
}

export function normalizeFolderSlug(value?: string | null) {
  const normalized = sanitizeFolderName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

  return normalized || DEFAULT_FOLDER_SLUG;
}

export function labelFromFolderSlug(slug: string) {
  if (slug === DEFAULT_FOLDER_SLUG) {
    return "Geral";
  }

  return slug
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
