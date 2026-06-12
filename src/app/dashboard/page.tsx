import { redirect } from "next/navigation";
import { getEffectiveProfile } from "@/lib/effective-profile";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardRedirectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const profile = await getEffectiveProfile(supabase, user);

  if (profile?.role === "recruiter") {
    redirect("/recruiter/dashboard");
  }

  redirect("/student/dashboard");
}
