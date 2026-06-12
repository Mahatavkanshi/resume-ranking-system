# Resume Ranking System

A final-year project built with Next.js and Supabase. Recruiters can post tech
requirements, students can apply with resumes, and applications are ranked by a
simple skill-based matching score.

## Tech Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Supabase Auth, Database, Storage, and Row Level Security
- Skill-based resume matching

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Never commit `.env.local`. This project already ignores `.env*` in `.gitignore`.

3. Run the Supabase schema:

- Open Supabase Dashboard.
- Go to SQL Editor.
- Paste the full contents of `supabase/schema.sql`.
- Run the query.

The schema is written to be safe to run more than once. It creates the profile,
job post, application, and resume storage setup, then enables Row Level Security.

4. For beginner testing, you can temporarily disable email confirmation:

- Supabase Dashboard
- Authentication
- Providers
- Email
- Turn off confirm email

5. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Important Supabase Notes

- Use the public project URL for `NEXT_PUBLIC_SUPABASE_URL`.
- Use only the anon public key for `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Do not put `sb_secret_...` values in frontend environment variables.
- If a secret key was shared accidentally, rotate it in Supabase.

If the SQL Editor shows an error, copy the exact red error text and fix that line
first. Common rerun errors like existing types or policies are already handled in
the current schema.

## Main Routes

- `/auth/signup`
- `/auth/login`
- `/dashboard`
- `/student/dashboard`
- `/recruiter/dashboard`

## Checks

```bash
npm run lint
npm run build
```
