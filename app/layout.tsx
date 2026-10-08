import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Lissan — تعلم اللغات بذكاء ومتعة",
  description:
    "تعلم الإسبانية والإنجليزية والفرنسية بالعربية والدارجة. دروس قصيرة، بطاقات كلمات وتدريب يومي.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
