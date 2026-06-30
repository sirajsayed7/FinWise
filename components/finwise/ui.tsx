"use client";

import type { ReactNode } from "react";
import { BellIcon, LogoMark } from "@/components/finwise/icons";

export function PageHeader({
  title,
  subtitle,
  actionLabel,
  onAction
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3 pt-1">
      <div className="min-w-0">
        <h1 className="text-[clamp(27px,7vw,31px)] font-extrabold leading-tight tracking-[-0.04em]" style={{ color: "var(--text-primary)" }}>{title}</h1>
        <p className="mt-1 text-[15px] font-medium leading-snug min-[391px]:text-[15.5px]" style={{ color: "var(--text-secondary)" }}>{subtitle}</p>
      </div>
      {actionLabel ? (
        <button onClick={onAction} className="shrink-0 rounded-full px-4 py-2 text-[13px] font-bold text-white transition-colors duration-200" style={{ background: "var(--accent)" }}>
          {actionLabel}
        </button>
      ) : null}
    </header>
  );
}

export function AppTopBar() {
  return (
    <header className="mb-5 flex items-center justify-between pt-1">
      <div className="flex items-center gap-2.5">
        <LogoMark />
        <span className="text-[22px] font-extrabold tracking-[-0.035em]" style={{ color: "var(--text-primary)" }}>FinWise</span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => window.dispatchEvent(new CustomEvent("finwise:notifications"))} aria-label="Open notifications" className="relative grid h-9 w-9 place-items-center rounded-full" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
          <BellIcon />
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--bg-base)]" style={{ background: "var(--accent)" }} />
        </button>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 text-[15px] font-extrabold text-white">S</div>
      </div>
    </header>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  tone = "slate"
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "slate" | "red" | "green" | "purple";
}) {
  const valueColor = tone === "red"
    ? "var(--danger)"
    : tone === "green"
      ? "var(--success)"
      : tone === "purple"
        ? "var(--accent)"
        : "var(--text-primary)";
  return (
    <article className="min-h-[88px] rounded-[18px] p-3" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)", border: "1px solid var(--border)" }}>
      <p className="text-[12px] font-bold uppercase tracking-[0.04em]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-2 truncate text-[16px] font-extrabold tracking-[-0.03em] min-[391px]:text-[17px]" style={{ color: valueColor }}>{value}</p>
      <p className="mt-1.5 text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{helper}</p>
    </article>
  );
}

export function InsightPanel({
  title,
  aside,
  children
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[22px] p-4" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-extrabold tracking-[-0.02em]" style={{ color: "var(--text-primary)" }}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function MiniMetric({
  label,
  value,
  tone = "slate"
}: {
  label: string;
  value: string;
  tone?: "slate" | "red" | "green";
}) {
  const valueColor = tone === "green" ? "var(--success)" : tone === "red" ? "var(--danger)" : "var(--text-primary)";
  return (
    <div className="rounded-[18px] p-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.04em]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-1 truncate text-[14px] font-extrabold" style={{ color: valueColor }}>{value}</p>
    </div>
  );
}

export function FieldPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-12 items-center justify-between rounded-[16px] px-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
      <span className="text-[13px] font-bold" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-[14px] font-extrabold" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

export function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-[20px] p-4" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)", border: "1px solid var(--border)" }}>
      <p className="text-[15px] font-extrabold" style={{ color: "var(--text-primary)" }}>{title}</p>
      <p className="mt-1 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>{body}</p>
    </div>
  );
}
