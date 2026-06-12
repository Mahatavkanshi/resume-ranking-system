"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { setSelectedRole } from "@/lib/effective-profile";
import { ensureProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

const roleSchema = z.object({
  role: z.enum(["student", "recruiter"]),
});

export async function updateCurrentUserRole(formData: FormData) {
  const parsed = roleSchema.safeParse({
    role: formData.get("role"),
  });

  if (!parsed.success) {
    throw new Error("Invalid account role.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  await ensureProfile(supabase, user);
  await supabase.auth.updateUser({
    data: {
      role: parsed.data.role,
    },
  });
  await setSelectedRole(parsed.data.role);

  const { data: directProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", user.id)
    .select("id, full_name, role, organization")
    .single<Omit<Profile, "email">>();
  let updatedProfile: Profile | null = directProfile ? { ...directProfile, email: null } : null;

  if (updateError || updatedProfile?.role !== parsed.data.role) {
    const { data: rpcProfile, error: rpcError } = await supabase
      .rpc("switch_my_role", { next_role: parsed.data.role })
      .single<Profile>();

    if (!rpcError) {
      updatedProfile = rpcProfile;
    }
  }

  if (updatedProfile?.role !== parsed.data.role) {
    redirect(parsed.data.role === "recruiter" ? "/recruiter/dashboard" : "/student/dashboard");
  }

  redirect(updatedProfile.role === "recruiter" ? "/recruiter/dashboard" : "/student/dashboard");
}
