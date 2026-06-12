import { cookies } from "next/headers";
import { ensureProfile } from "@/lib/profiles";
import type { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export const ROLE_COOKIE = "selected_role";

function isUserRole(value: string | undefined): value is UserRole {
  return value === "student" || value === "recruiter";
}

function getMetadataRole(value: unknown): UserRole | null {
  return value === "student" || value === "recruiter" ? value : null;
}

export async function setSelectedRole(role: UserRole) {
  const cookieStore = await cookies();

  cookieStore.set(ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function clearSelectedRole() {
  const cookieStore = await cookies();

  cookieStore.delete(ROLE_COOKIE);
}

export async function getEffectiveProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
  options: { sync?: boolean } = {},
): Promise<Profile> {
  const profile = await ensureProfile(supabase, user);
  const cookieStore = await cookies();
  const selectedRole = cookieStore.get(ROLE_COOKIE)?.value;
  const cookieRole = isUserRole(selectedRole) ? selectedRole : null;
  const metadataRole = getMetadataRole(user.user_metadata?.role);
  const effectiveRole = cookieRole ?? metadataRole ?? profile.role;

  if (options.sync) {
    cookieStore.set(ROLE_COOKIE, effectiveRole, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  if (options.sync && profile.role !== effectiveRole) {
    await supabase.from("profiles").update({ role: effectiveRole }).eq("id", user.id);
  }

  return {
    ...profile,
    role: effectiveRole,
  };
}
