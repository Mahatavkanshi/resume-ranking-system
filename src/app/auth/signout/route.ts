import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getRedirectUrl(request: Request) {
  const requestUrl = new URL(request.url);
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (!next.startsWith("/") || next.startsWith("//")) {
    return new URL("/", requestUrl.origin);
  }

  return new URL(next, requestUrl.origin);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(getRedirectUrl(request));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(getRedirectUrl(request));
}
