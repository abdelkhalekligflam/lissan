import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    try {
      const { error } = await (
        await serverClient()
      ).auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(
          new URL(
            req.nextUrl.searchParams.get("next") === "/reset-password"
              ? "/reset-password"
              : "/",
            site,
          ),
        );
    } catch {}
  }
  return NextResponse.redirect(new URL("/?auth_error=1", site));
}
