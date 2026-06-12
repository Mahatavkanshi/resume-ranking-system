"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supabase = createClient();
    const formData = new FormData(event.currentTarget);

    setLoading(true);
    setError("");

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const fullName = String(formData.get("fullName") ?? "");
    const organization = String(formData.get("organization") ?? "");

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
            organization,
          },
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      router.push(role === "student" ? "/student/dashboard" : "/recruiter/dashboard");
      router.refresh();
      return;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      {mode === "signup" ? (
        <>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Full name
            <input
              required
              name="fullName"
              className="h-11 rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-700"
              placeholder="Aarav Sharma"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            College or company
            <input
              name="organization"
              className="h-11 rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-700"
              placeholder="ABC College"
            />
          </label>
          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium text-slate-700">Account type</legend>
            <div className="grid grid-cols-2 gap-3">
              {(["student", "recruiter"] as UserRole[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRole(item)}
                  className={`h-11 rounded-md border text-sm font-semibold capitalize transition ${
                    role === item
                      ? "border-teal-700 bg-teal-700 text-white"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Email
        <input
          required
          type="email"
          name="email"
          className="h-11 rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-700"
          placeholder="you@example.com"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Password
        <input
          required
          minLength={6}
          type="password"
          name="password"
          className="h-11 rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-700"
          placeholder="Minimum 6 characters"
        />
      </label>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="h-11 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
      </button>

      <p className="text-center text-sm text-slate-600">
        {mode === "signup" ? "Already registered?" : "New to the platform?"}{" "}
        <Link
          className="font-semibold text-teal-700"
          href={mode === "signup" ? "/auth/login" : "/auth/signup"}
        >
          {mode === "signup" ? "Sign in" : "Create account"}
        </Link>
      </p>
    </form>
  );
}
