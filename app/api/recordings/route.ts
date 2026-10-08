import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { genericError, rateLimit, sameOrigin } from "@/lib/security";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403 });
  try {
    const client = await serverClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "سجل الدخول أولاً" }, { status: 401 });
    const limited = await rateLimit("upload", user.id);
    if (limited) return limited;
    if (Number(req.headers.get("content-length")) > 5300000)
      return NextResponse.json(
        { error: "التسجيل أكبر من 5 MB" },
        { status: 413 },
      );
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof File) || file.size > 5242880) return genericError();
    const { data, error } = await client.functions.invoke("pronunciation", {
      body: form,
    });
    if (error) {
      if (error.context instanceof Response && error.context.status === 429) {
        const retry = error.context.headers.get("Retry-After") || "60";
        return NextResponse.json(
          { error: `محاولات كثيرة. حاول بعد ${retry} ثانية.` },
          { status: 429, headers: { "Retry-After": retry } },
        );
      }
      return genericError();
    }
    return NextResponse.json(data);
  } catch {
    return genericError();
  }
}
