import type { Metadata } from "next";
import { Alexandria } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const arabic = Alexandria({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "وَتيرة — من وصف المهمة إلى أتمتة تعمل",
  description:
    "صف مهمتك بلغتك الطبيعية، وسيقيّمها وَتيرة ويبني لك أتمتة جاهزة للتشغيل — مع موافقتك على كل إجراء حساس.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${arabic.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* تثبيت الثيم المحفوظ قبل أول رسم — بلا وميض */}
        <Script id="simat-theme-boot" strategy="beforeInteractive">
          {`try{if(localStorage.getItem("simat_theme")==="light")document.documentElement.classList.add("light");if(localStorage.getItem("simat_lang")==="en"){document.documentElement.lang="en";document.documentElement.dir="ltr"}}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
