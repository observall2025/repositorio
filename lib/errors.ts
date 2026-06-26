export function toFriendlyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;

  if (/invalid compact jws|jwt/i.test(message)) {
    return "Configure SUPABASE_SERVICE_ROLE_KEY com a service_role key do Supabase.";
  }

  return message;
}
