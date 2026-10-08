export const dynamic = "force-dynamic";
import LissanApp from "@/components/lissan-app";
export default function Page() {
  return (
    <LissanApp
      configured={Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      )}
    />
  );
}
