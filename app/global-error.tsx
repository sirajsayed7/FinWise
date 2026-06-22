"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="grid min-h-screen place-items-center bg-[#F8FAFC] px-5 text-[#0F172A]">
          <section className="w-full max-w-[420px] rounded-[28px] bg-white p-6 text-center shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[rgba(15,23,42,0.06)]">
            <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#6D35F5]">FinWise</p>
            <h1 className="mt-3 text-[28px] font-extrabold tracking-[-0.04em]">Something went wrong</h1>
            <p className="mt-2 text-[14px] font-semibold leading-relaxed text-[#64748B]">The issue was captured. Try reopening the app screen.</p>
            <button onClick={reset} className="mt-5 h-12 w-full rounded-[16px] bg-[#6D35F5] text-[15px] font-extrabold text-white shadow-lg shadow-[#6D35F5]/20">
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
