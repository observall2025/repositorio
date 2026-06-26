export function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} nao configurado.`);
  }

  return value;
}

export function getBucketName() {
  return process.env.SUPABASE_BUCKET || "documents";
}

export function getMaxUploadBytes() {
  const megabytes = Number(process.env.MAX_UPLOAD_MB || "50");
  const safeMegabytes = Number.isFinite(megabytes) && megabytes > 0 ? megabytes : 50;

  return safeMegabytes * 1024 * 1024;
}
