import Link from "next/link";
import "./globals.css";

// 404 for paths outside /ru and /kk (rare: the proxy adds a language to almost every URL).
export default function RootNotFound() {
  return (
    <html lang="ru">
      <body className="flex min-h-dvh items-center justify-center p-6 font-sans">
        <div className="text-center">
          <p className="text-[13px] font-semibold tracking-widest text-[#2340FF]">404</p>
          <h1 className="mt-2 text-3xl font-bold">Страница не найдена</h1>
          <Link href="/ru" className="mt-6 inline-block font-semibold text-[#2340FF] underline">
            На главную
          </Link>
        </div>
      </body>
    </html>
  );
}
