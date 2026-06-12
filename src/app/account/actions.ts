"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
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

  await supabase.auth.updateUser({
    data: {
      role: parsed.data.role,
    },
  });

  let { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", user.id)
    .select("id, full_name, role, organization")
    .single<Profile>();

  if (updateError || updatedProfile?.role !== parsed.data.role) {
    const { data: rpcProfile, error: rpcError } = await supabase
      .rpc("switch_my_role", { next_role: parsed.data.role })
      .single<Profile>();

    if (rpcError) {
      throw new Error(
        `${updateError?.message ?? "Role update did not save."} RPC fallback failed: ${rpcError.message}`,
      );
    }

    updatedProfile = rpcProfile;
  }

  if (updatedProfile.role !== parsed.data.role) {
    throw new Error("Role did not update in Supabase. Run the profile repair SQL and try again.");
  }

  redirect(updatedProfile.role === "recruiter" ? "/recruiter/dashboard" : "/student/dashboard");
}
