export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isAllowedPhotoUrl(url: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || url.length > 500) return false;

  try {
    const expected = new URL(base);
    const actual = new URL(url);
    return (
      actual.origin === expected.origin &&
      actual.pathname.startsWith("/storage/v1/object/public/patient-photos/")
    );
  } catch {
    return false;
  }
}
