import { NextResponse } from "next/server";
import { getEffectiveProfile } from "@/lib/effective-profile";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      signedIn: false,
      message: "No user is signed in.",
    });
  }

  const profile = await getEffectiveProfile(supabase, user);

  return NextResponse.json({
    signedIn: true,
    userId: user.id,
    email: user.email,
    authMetadataRole: user.user_metadata?.role ?? null,
    effectiveRole: profile.role,
    profileRoleUsedForDashboard: profile.role,
    studentDashboard: profile.role === "student" ? "allowed" : "blocked",
    recruiterDashboard: profile.role === "recruiter" ? "allowed" : "blocked",
  });
}
