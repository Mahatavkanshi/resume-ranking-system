import Link from "next/link";
import { loginAction, signUpAction } from "@/app/auth/actions";

type AuthFormProps = {
  mode: "login" | "signup";
  error?: string;
  notice?: string;
};

export function AuthForm({ mode, error, notice }: AuthFormProps) {
  return (
    <form action={mode === "signup" ? signUpAction : loginAction} className="grid gap-5">
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
              <label className="has-[:checked]:border-teal-700 has-[:checked]:bg-teal-700 has-[:checked]:text-white flex h-11 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition">
                <input
                  className="sr-only"
                  type="radio"
                  name="role"
                  value="student"
                  defaultChecked
                />
                Student
              </label>
              <label className="has-[:checked]:border-teal-700 has-[:checked]:bg-teal-700 has-[:checked]:text-white flex h-11 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition">
                <input className="sr-only" type="radio" name="role" value="recruiter" />
                Recruiter
              </label>
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

      {notice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}

      <button
        type="submit"
        className="h-11 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        {mode === "signup" ? "Create account" : "Sign in"}
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
