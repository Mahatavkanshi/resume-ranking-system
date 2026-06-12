import { redirect } from "next/navigation";
import { ensureProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardRedirectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const profile = await ensureProfile(supabase, user);

  if (profile?.role === "recruiter") {
    redirect("/recruiter/dashboard");
  }

  redirect("/student/dashboard");
}
