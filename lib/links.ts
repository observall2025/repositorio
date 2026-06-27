import { createHash } from "node:crypto";

const UPLOADS_PREFIX = "uploads/";
const SHORT_STORAGE_FILE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,180}$/;
const DOCUMENT_HASH_TOKEN_PATTERN = /^d-[a-zA-Z0-9_-]{10}$/;

function hashPath(path: string) {
  return createHash("sha256").update(path).digest("base64url").slice(0, 10);
}

export function toToken(path: string) {
  if (path.startsWith(UPLOADS_PREFIX)) {
    return `d-${hashPath(path)}`;
  }

  return Buffer.from(path, "utf8").toString("base64url");
}

export function isDocumentHashToken(token: string) {
  return DOCUMENT_HASH_TOKEN_PATTERN.test(token);
}

export function matchesDocumentToken(token: string, path: string) {
  return isDocumentHashToken(token) && token === toToken(path);
}

export function fromToken(token: string) {
  if (isDocumentHashToken(token)) {
    return null;
  }

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");

    if (decoded.startsWith(UPLOADS_PREFIX)) {
      return decoded;
    }
  } catch {
    // New short links are not base64 tokens.
  }

  if (SHORT_STORAGE_FILE_PATTERN.test(token) && !token.includes("/")) {
    return `${UPLOADS_PREFIX}${token}`;
  }

  return null;
}

export function getFileNameFromPath(path: string) {
  return path.split("/").filter(Boolean).at(-1) || path;
}

export function isImage(path: string) {
  return /\.(apng|avif|gif|jpe?g|png|svg|webp)$/i.test(path);
}

export function isBrowserDocument(path: string) {
  return /\.(pdf|txt|html?)$/i.test(path);
}

export function isPdf(path: string) {
  return /\.pdf$/i.test(path);
}

export function isOfficeDocument(path: string) {
  return /\.(docx?|xlsx?|pptx?)$/i.test(path);
}
