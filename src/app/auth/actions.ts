"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

const AUTH_TIMEOUT_MS = 15000;

function errorRedirect(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;

    if (typeof record.message === "string" && record.message) {
      return record.message;
    }

    if (typeof record.error_description === "string" && record.error_description) {
      return record.error_description;
    }

    if (typeof record.error === "string" && record.error) {
      return record.error;
    }
  }

  return "Authentication failed. Please check your Supabase setup and try again.";
}

async function withAuthTimeout<T>(request: Promise<T>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(
        new Error(
          "Supabase auth request timed out. Check your internet connection, Supabase project status, and Auth settings.",
        ),
      );
    }, AUTH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([request, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
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

  let error: unknown;

  try {
    const response = await withAuthTimeout(
      supabase.auth.signUp({
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
      }),
    );

    error = response.error;
  } catch (caughtError) {
    error = caughtError;
  }

  if (error) {
    errorRedirect("/auth/signup", getErrorMessage(error));
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

  let error: unknown;

  try {
    const response = await withAuthTimeout(
      supabase.auth.signInWithPassword({
        email,
        password,
      }),
    );

    error = response.error;
  } catch (caughtError) {
    error = caughtError;
  }

  if (error) {
    errorRedirect("/auth/login", getErrorMessage(error));
  }

  redirect("/dashboard");
}
