import { NextResponse } from "next/server";
import { ROLE_COOKIE } from "@/lib/effective-profile";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

function getRole(value: string | null): UserRole {
  return value === "recruiter" ? "recruiter" : "student";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const role = getRole(requestUrl.searchParams.get("role"));
  const redirectUrl = new URL(
    role === "recruiter" ? "/recruiter/dashboard" : "/student/dashboard",
    requestUrl.origin,
  );
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.auth.updateUser({
      data: { role },
    });

    const { data: updatedProfile } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (!updatedProfile) {
      await supabase.rpc("switch_my_role", { next_role: role });
    }
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
