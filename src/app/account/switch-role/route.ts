import { NextResponse } from "next/server";
import { ROLE_COOKIE } from "@/lib/effective-profile";
import { ensureProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

function getRole(value: string | null): UserRole {
  return value === "recruiter" ? "recruiter" : "student";
}

async function switchRole(request: Request, role: UserRole) {
  const requestUrl = new URL(request.url);
  const redirectUrl = new URL(role === "recruiter" ? "/recruiter/dashboard" : "/student/dashboard", requestUrl.origin);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", requestUrl.origin));
  }

  await ensureProfile(supabase, user);
  await supabase.auth.updateUser({
    data: { role },
  });

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  let switchError = updateError?.message;

  if (updateError || !updatedProfile) {
    const { data: rpcProfile, error: rpcError } = await supabase.rpc("switch_my_role", { next_role: role });

    if (rpcError || !rpcProfile) {
      switchError = rpcError?.message ?? switchError ?? "No profile row was updated.";
    } else {
      switchError = undefined;
    }
  }

  const { data: verifiedProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: UserRole }>();

  if (verifiedProfile?.role !== role) {
    const errorUrl = new URL("/auth/login", requestUrl.origin);
    errorUrl.searchParams.set(
      "error",
      `Role change was not saved in Supabase. ${switchError ?? "Run supabase/fix-role-switch.sql, then sign in again."}`,
    );

    const response = NextResponse.redirect(errorUrl);
    response.cookies.set(ROLE_COOKIE, verifiedProfile?.role ?? "student", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return response;
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const role = getRole(String(formData.get("role") ?? ""));

  return switchRole(request, role);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const errorUrl = new URL("/auth/login", requestUrl.origin);
  errorUrl.searchParams.set("error", "Use the role button on the dashboard page to change account type.");

  return NextResponse.redirect(errorUrl);
}
