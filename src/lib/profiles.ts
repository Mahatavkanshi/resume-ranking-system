import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Profile, UserRole } from "@/lib/types";

function getRole(value: unknown): UserRole {
  return value === "recruiter" ? "recruiter" : "student";
}

export async function ensureProfile(supabase: SupabaseClient, user: User) {
  const metadata = user.user_metadata ?? {};
  const metadataRole = getRole(metadata.role);
  const { data: existingProfile, error: selectError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, organization")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (selectError) {
    throw selectError;
  }

  if (existingProfile) {
    const updates: Partial<Pick<Profile, "email" | "role">> = {};

    if (metadata.role && existingProfile.role !== metadataRole) {
      updates.role = metadataRole;
    }

    if (!existingProfile.email && user.email) {
      updates.email = user.email;
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("profiles").update(updates).eq("id", user.id);

      return {
        ...existingProfile,
        ...updates,
      };
    }

    return existingProfile;
  }

  const fallbackName = user.email?.split("@")[0] ?? "New user";

  const profile = {
    id: user.id,
    full_name: String(metadata.full_name ?? fallbackName),
    email: user.email ?? null,
    role: metadataRole,
    organization: metadata.organization ? String(metadata.organization) : null,
  };

  const { data: createdProfile, error: insertError } = await supabase
    .from("profiles")
    .insert(profile)
    .select("id, full_name, email, role, organization")
    .single<Profile>();

  if (insertError) {
    throw insertError;
  }

  return createdProfile;
}
