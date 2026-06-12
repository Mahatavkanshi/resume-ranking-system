"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

function errorRedirect(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function getOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");

  if (origin) {
    return origin;
  }

  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";

  return `${protocol}://${host}`;
}

export async function signUpAction(formData: FormData) {
  const supabase = await createClient();
  const origin = await getOrigin();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const organization = String(formData.get("organization") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "student") as UserRole;

  if (!fullName || !email || password.length < 6) {
    errorRedirect("/auth/signup", "Please enter your name, email, and a password of at least 6 characters.");
  }

  if (role !== "student" && role !== "recruiter") {
    errorRedirect("/auth/signup", "Please choose a valid account type.");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
        organization,
      },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    errorRedirect("/auth/signup", error.message);
  }

  redirect(role === "student" ? "/student/dashboard" : "/recruiter/dashboard");
}

export async function loginAction(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    errorRedirect("/auth/login", "Please enter your email and password.");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    errorRedirect("/auth/login", error.message);
  }

  redirect("/dashboard");
}
