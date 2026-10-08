import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token_hash"),
    type = req.nextUrl.searchParams.get("type");
  const site = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  if (token && ["signup", "recovery", "email"].includes(type || "")) {
    try {
      const { error } = await (
        await serverClient()
      ).auth.verifyOtp({
        token_hash: token,
        type: type as "signup" | "recovery" | "email",
      });
      if (!error)
        return NextResponse.redirect(
          new URL(type === "recovery" ? "/reset-password" : "/", site),
        );
    } catch {}
  }
  return NextResponse.redirect(new URL("/?auth_error=1", site));
}
