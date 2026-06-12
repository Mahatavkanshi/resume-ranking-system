import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Profile, UserRole } from "@/lib/types";

function getRole(value: unknown): UserRole {
  return value === "recruiter" ? "recruiter" : "student";
}

export async function ensureProfile(supabase: SupabaseClient, user: User) {
  const { data: existingProfile, error: selectError } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (selectError) {
    throw selectError;
  }

  if (existingProfile) {
    return existingProfile;
  }

  const metadata = user.user_metadata ?? {};
  const fallbackName = user.email?.split("@")[0] ?? "New user";

  const profile = {
    id: user.id,
    full_name: String(metadata.full_name ?? fallbackName),
    role: getRole(metadata.role),
    organization: metadata.organization ? String(metadata.organization) : null,
  };

  const { data: createdProfile, error: insertError } = await supabase
    .from("profiles")
    .insert(profile)
    .select("id, full_name, role, organization")
    .single<Profile>();

  if (insertError) {
    throw insertError;
  }

  return createdProfile;
}
