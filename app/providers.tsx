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
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: "rounded-2xl bg-[#1C1F35] text-[#F1F5F9] shadow-[0_16px_40px_rgba(0,0,0,0.5)]",
              title: "text-[14px] font-extrabold",
              description: "text-[12px] font-semibold text-[#94A3B8]"
            }
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
