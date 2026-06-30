"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { useLenis } from "@/lib/use-lenis";

export function Providers({ children }: { children: ReactNode }) {
  useLenis();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1
          }
        }
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: "rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-[0_16px_40px_rgba(15,23,42,0.12)] dark:bg-slate-900 dark:border-slate-700 dark:text-slate-50",
              title: "text-[14px] font-extrabold",
              description: "text-[12px] font-semibold text-slate-500 dark:text-slate-400"
            }
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
