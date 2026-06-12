import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Profile, UserRole } from "@/lib/types";

function getRole(value: unknown): UserRole {
  return value === "recruiter" ? "recruiter" : "student";
}

function isExplicitRole(value: unknown): value is UserRole {
  return value === "student" || value === "recruiter";
}

export async function ensureProfile(supabase: SupabaseClient, user: User) {
  const metadata = user.user_metadata ?? {};
  const metadataRole = getRole(metadata.role);
  const { data: existingProfile, error: selectError } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization")
    .eq("id", user.id)
    .maybeSingle<Omit<Profile, "email">>();

  if (selectError) {
    throw selectError;
  }

  if (existingProfile) {
    const updates: Partial<Pick<Profile, "role">> = {};

    if (isExplicitRole(metadata.role) && existingProfile.role !== metadataRole) {
      updates.role = metadataRole;
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("profiles").update(updates).eq("id", user.id);

      return {
        ...existingProfile,
        email: null,
        ...updates,
      };
    }

    return {
      ...existingProfile,
      email: null,
    };
  }

  const fallbackName = user.email?.split("@")[0] ?? "New user";

  const profile = {
    id: user.id,
    full_name: String(metadata.full_name ?? fallbackName),
    role: metadataRole,
    organization: metadata.organization ? String(metadata.organization) : null,
  };

  const { data: createdProfile, error: insertError } = await supabase
    .from("profiles")
    .insert(profile)
    .select("id, full_name, role, organization")
    .single<Omit<Profile, "email">>();

  if (insertError) {
    throw insertError;
  }

  return {
    ...createdProfile,
    email: null,
  };
}
