import { createClient } from "@supabase/supabase-js";
import { getBucketName, getMaxUploadBytes, requireEnv } from "./env";

let bucketReady = false;

export function getSupabaseAdmin() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function ensureBucket() {
  if (bucketReady) {
    return getBucketName();
  }

  const supabase = getSupabaseAdmin();
  const bucket = getBucketName();
  const { error } = await supabase.storage.getBucket(bucket);

  if (!error) {
    bucketReady = true;
    return bucket;
  }

  const statusCode = String((error as { statusCode?: string | number }).statusCode ?? "");
  const missingBucket = statusCode === "404" || /not found/i.test(error.message);

  if (!missingBucket) {
    throw error;
  }

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: getMaxUploadBytes()
  });

  if (createError) {
    throw createError;
  }

  bucketReady = true;
  return bucket;
}
