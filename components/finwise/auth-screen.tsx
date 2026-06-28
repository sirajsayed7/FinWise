"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LogoMark } from "@/components/finwise/icons";
import { getSupabase } from "@/lib/supabase-client";

const authSchema = z.object({
  fullName: z.string().trim().max(60, "Name must be 60 characters or less.").optional(),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters.")
});

type AuthFormFields = z.infer<typeof authSchema>;

export function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F8FAFC] px-5 text-[#0F172A]">
      <section className="w-full max-w-[420px] rounded-[28px] bg-white p-6 text-center shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[rgba(15,23,42,0.06)]">
        <div className="mx-auto mb-4 flex items-center justify-center gap-2">
          <LogoMark />
          <span className="text-[24px] font-extrabold tracking-[-0.035em]">FinWise</span>
        </div>
        <p className="text-[14px] font-semibold text-[#64748B]">Loading your secure workspace...</p>
      </section>
    </main>
  );
}

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [status, setStatus] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<AuthFormFields>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: ""
    }
  });

  async function submitAuth(values: AuthFormFields) {
    const supabase = getSupabase();
    if (!supabase) return;
    setStatus("");

    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email: values.email, password: values.password })
      : await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: values.fullName?.trim() || values.email.split("@")[0]
            }
          }
        });

    if (result.error) {
      setStatus(result.error.message);
      return;
    }
    setStatus(mode === "signup" ? "Account created. Check your email if confirmation is enabled." : "Signed in.");
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-[calc(28px+env(safe-area-inset-top))] text-[#0F172A]">
      <section className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-[430px] flex-col justify-center">
        <div className="mb-8 flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[27px] font-extrabold tracking-[-0.04em]">FinWise</span>
        </div>
        <div className="rounded-[30px] bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[rgba(15,23,42,0.06)]">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#6D35F5]">Secure finance dashboard</p>
          <h1 className="mt-3 text-[32px] font-extrabold leading-tight tracking-[-0.055em]">{mode === "login" ? "Sign in to your account" : "Sign up for FinWise"}</h1>
          <p className="mt-2 text-[14px] font-medium leading-relaxed text-[#64748B]">Each account has its own statements, transactions, merchant rules, and saved logos.</p>

          <form onSubmit={handleSubmit(submitAuth)} className="mt-6 grid gap-3">
            {mode === "signup" ? (
              <label className="grid gap-1.5">
                <span className="text-[12px] font-bold text-[#475569]">Full name</span>
                <input {...register("fullName")} type="text" autoComplete="name" placeholder="Your name" className="h-12 rounded-[16px] bg-[#F8FAFC] px-4 text-[14px] font-semibold outline-none ring-1 ring-[#E2E8F0] focus:ring-[#6D35F5]" />
                {errors.fullName ? <span className="text-[11.5px] font-bold text-red-500">{errors.fullName.message}</span> : null}
              </label>
            ) : null}
            <label className="grid gap-1.5">
              <span className="text-[12px] font-bold text-[#475569]">Email</span>
              <input {...register("email")} type="email" autoComplete="email" className="h-12 rounded-[16px] bg-[#F8FAFC] px-4 text-[14px] font-semibold outline-none ring-1 ring-[#E2E8F0] focus:ring-[#6D35F5]" />
              {errors.email ? <span className="text-[11.5px] font-bold text-red-500">{errors.email.message}</span> : null}
            </label>
            <label className="grid gap-1.5">
              <span className="text-[12px] font-bold text-[#475569]">Password</span>
              <input {...register("password")} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className="h-12 rounded-[16px] bg-[#F8FAFC] px-4 text-[14px] font-semibold outline-none ring-1 ring-[#E2E8F0] focus:ring-[#6D35F5]" />
              {errors.password ? <span className="text-[11.5px] font-bold text-red-500">{errors.password.message}</span> : null}
            </label>
            {status ? <p className="rounded-[14px] bg-violet-50 p-3 text-[12px] font-semibold leading-relaxed text-[#5B21B6]">{status}</p> : null}
            <button disabled={isSubmitting} className="mt-2 h-12 rounded-[16px] bg-[#6D35F5] text-[15px] font-extrabold text-white shadow-lg shadow-[#6D35F5]/20 disabled:opacity-60">
              {isSubmitting ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setStatus("");
              reset(undefined, { keepValues: true });
            }}
            className="mt-4 w-full text-center text-[13px] font-extrabold text-[#6D35F5]"
          >
            {mode === "login" ? "Create a new FinWise account" : "I already have an account"}
          </button>
        </div>
      </section>
    </main>
  );
}
