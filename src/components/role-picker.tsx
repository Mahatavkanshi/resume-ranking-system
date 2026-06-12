"use client";

import { useState } from "react";
import type { UserRole } from "@/lib/types";

export function RolePicker() {
  const [role, setRole] = useState<UserRole>("student");

  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium text-slate-700">Account type</legend>
      <div className="grid grid-cols-2 gap-3">
        {(["student", "recruiter"] as UserRole[]).map((option) => (
          <label
            key={option}
            className={`flex h-11 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold capitalize transition ${
              role === option
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            <input
              className="sr-only"
              type="radio"
              name="role"
              value={option}
              checked={role === option}
              onChange={() => setRole(option)}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
