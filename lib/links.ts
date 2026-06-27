export function toToken(path: string) {
  return Buffer.from(path, "utf8").toString("base64url");
}

export function fromToken(token: string) {
  try {
    return Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return null;
  }
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
