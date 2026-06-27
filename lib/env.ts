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

export function getStorageCapacityBytes() {
  const megabytes = Number(process.env.STORAGE_CAPACITY_MB || "1024");
  const safeMegabytes = Number.isFinite(megabytes) && megabytes > 0 ? megabytes : 1024;

  return safeMegabytes * 1024 * 1024;
}
