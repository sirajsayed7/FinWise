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
    <main className="grid min-h-screen place-items-center px-5" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <section className="w-full max-w-[420px] rounded-[28px] p-6 text-center" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)", border: "1px solid var(--border)" }}>
        <div className="mx-auto mb-4 flex items-center justify-center gap-2">
          <LogoMark />
          <span className="text-[24px] font-extrabold tracking-[-0.035em]" style={{ color: "var(--text-primary)" }}>FinWise</span>
        </div>
        <p className="text-[14px] font-semibold" style={{ color: "var(--text-secondary)" }}>Loading your secure workspace...</p>
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
    defaultValues: { fullName: "", email: "", password: "" }
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
            data: { full_name: values.fullName?.trim() || values.email.split("@")[0] }
          }
        });

    if (result.error) { setStatus(result.error.message); return; }
    setStatus(mode === "signup" ? "Account created. Check your email if confirmation is enabled." : "Signed in.");
  }

  const inputClass = "h-12 rounded-[16px] px-4 text-[14px] font-semibold outline-none w-full transition";
  const inputStyle = { background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" };

  return (
    <main className="min-h-screen px-5 py-[calc(28px+env(safe-area-inset-top))]" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <section className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-[430px] flex-col justify-center">
        <div className="mb-8 flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[27px] font-extrabold tracking-[-0.04em]" style={{ color: "var(--text-primary)" }}>FinWise</span>
        </div>
        <div className="rounded-[30px] p-6" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)", border: "1px solid var(--border)" }}>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--accent)" }}>Secure finance dashboard</p>
          <h1 className="mt-3 text-[32px] font-extrabold leading-tight tracking-[-0.055em]" style={{ color: "var(--text-primary)" }}>
            {mode === "login" ? "Sign in to your account" : "Sign up for FinWise"}
          </h1>
          <p className="mt-2 text-[14px] font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Each account has its own statements, transactions, merchant rules, and saved logos.
          </p>

          <form onSubmit={handleSubmit(submitAuth)} className="mt-6 grid gap-3">
            {mode === "signup" ? (
              <label className="grid gap-1.5">
                <span className="text-[12px] font-bold" style={{ color: "var(--text-secondary)" }}>Full name</span>
                <input {...register("fullName")} type="text" autoComplete="name" placeholder="Your name" className={inputClass} style={inputStyle} />
                {errors.fullName ? <span className="text-[11.5px] font-bold text-red-400">{errors.fullName.message}</span> : null}
              </label>
            ) : null}
            <label className="grid gap-1.5">
              <span className="text-[12px] font-bold" style={{ color: "var(--text-secondary)" }}>Email</span>
              <input {...register("email")} type="email" autoComplete="email" className={inputClass} style={inputStyle} />
              {errors.email ? <span className="text-[11.5px] font-bold text-red-400">{errors.email.message}</span> : null}
            </label>
            <label className="grid gap-1.5">
              <span className="text-[12px] font-bold" style={{ color: "var(--text-secondary)" }}>Password</span>
              <input {...register("password")} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className={inputClass} style={inputStyle} />
              {errors.password ? <span className="text-[11.5px] font-bold text-red-400">{errors.password.message}</span> : null}
            </label>
            {status ? (
              <p className="rounded-[14px] p-3 text-[12px] font-semibold leading-relaxed" style={{ background: "var(--accent-soft)", color: "var(--text-accent)" }}>{status}</p>
            ) : null}
            <button disabled={isSubmitting} className="mt-2 h-12 rounded-[16px] text-[15px] font-extrabold text-white disabled:opacity-60" style={{ background: "var(--accent)", boxShadow: "var(--shadow-accent)" }}>
              {isSubmitting ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <button
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setStatus(""); reset(undefined, { keepValues: true }); }}
            className="mt-4 w-full text-center text-[13px] font-extrabold"
            style={{ color: "var(--accent)" }}
          >
            {mode === "login" ? "Create a new FinWise account" : "I already have an account"}
          </button>
        </div>
      </section>
    </main>
  );
}
