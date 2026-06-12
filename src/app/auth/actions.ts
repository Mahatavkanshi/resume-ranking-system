"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { setSelectedRole } from "@/lib/effective-profile";
import { ensureProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

const AUTH_TIMEOUT_MS = 15000;

function errorRedirect(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function noticeRedirect(path: string, message: string): never {
  redirect(`${path}?notice=${encodeURIComponent(message)}`);
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
          "Supabase signup is not completing. Run the auth/schema repair SQL in Supabase, then check Authentication > Providers > Email settings.",
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

  await supabase.auth.signOut();
  await setSelectedRole(role);

  let error: unknown;
  let signedUpRole: UserRole = role;

  try {
    const response = await withAuthTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            email,
            role,
            organization,
          },
          emailRedirectTo: `${origin}/auth/callback`,
        },
      }),
    );

    error = response.error;

    if (!error && response.data.user && response.data.session) {
      try {
        const profile = await ensureProfile(supabase, response.data.user);
        let savedRole = profile.role;

        if (profile.role !== role) {
          const { data: updatedProfile, error: updateError } = await supabase
            .from("profiles")
            .update({ role })
            .eq("id", response.data.user.id)
            .select("role")
            .single<{ role: UserRole }>();

          if (updateError) {
            error = updateError;
          } else {
            savedRole = updatedProfile.role;
          }
        }

        signedUpRole = savedRole;
        await setSelectedRole(signedUpRole);
      } catch (profileError) {
        error = profileError;
      }
    }
  } catch (caughtError) {
    error = caughtError;
  }

  if (error) {
    errorRedirect("/auth/signup", getErrorMessage(error));
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    noticeRedirect(
      "/auth/login",
      "Account created. Confirm your email if Supabase asks for it, then sign in.",
    );
  }

  redirect(signedUpRole === "student" ? "/student/dashboard" : "/recruiter/dashboard");
}

export async function loginAction(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "student") as UserRole;

  if (!email || !password) {
    errorRedirect("/auth/login", "Please enter your email and password.");
  }

  if (role !== "student" && role !== "recruiter") {
    errorRedirect("/auth/login", "Please choose a valid account type.");
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await supabase.auth.updateUser({
        data: { role },
      });

      const profile = await ensureProfile(supabase, {
        ...user,
        user_metadata: {
          ...(user.user_metadata ?? {}),
          role,
        },
      });

      if (profile.role !== role) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ role })
          .eq("id", user.id);

        if (updateError) {
          errorRedirect("/auth/login", getErrorMessage(updateError));
        }
      }

      await setSelectedRole(role);
    } catch (profileError) {
      errorRedirect("/auth/login", getErrorMessage(profileError));
    }
  }

  redirect(role === "recruiter" ? "/recruiter/dashboard" : "/student/dashboard");
}
