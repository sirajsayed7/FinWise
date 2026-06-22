"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
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
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: "rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-[0_16px_40px_rgba(15,23,42,0.12)]",
            title: "text-[14px] font-extrabold",
            description: "text-[12px] font-semibold text-slate-500"
          }
        }}
      />
    </QueryClientProvider>
  );
}
