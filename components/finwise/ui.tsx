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
        <h1 className="text-[clamp(27px,7vw,31px)] font-extrabold leading-tight tracking-[-0.04em] text-[#11152D]">{title}</h1>
        <p className="mt-1 text-[15px] font-medium leading-snug text-[#64708A] min-[391px]:text-[15.5px]">{subtitle}</p>
      </div>
      {actionLabel ? (
        <button onClick={onAction} className="shrink-0 rounded-full bg-[#633EF2] px-4 py-2 text-[13px] font-bold text-white">
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
        <span className="text-[22px] font-extrabold tracking-[-0.035em] text-[#0F172A]">FinWise</span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => window.dispatchEvent(new CustomEvent("finwise:notifications"))} aria-label="Open notifications" className="relative grid h-9 w-9 place-items-center rounded-full bg-white text-[#334155] ring-1 ring-[#E8ECF3]">
          <BellIcon />
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#6D35F5] ring-2 ring-white" />
        </button>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-sky-100 text-[15px] font-extrabold text-[#0F172A] ring-2 ring-white">S</div>
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
  const valueClass = tone === "red"
    ? "text-red-500"
    : tone === "green"
      ? "text-emerald-500"
      : tone === "purple"
        ? "text-[#6D35F5]"
        : "text-[#0F172A]";
  return (
    <article className="min-h-[88px] rounded-[18px] bg-white p-3 shadow-[0_10px_22px_rgba(15,23,42,0.035)] ring-1 ring-[rgba(15,23,42,0.055)]">
      <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#64748B]">{label}</p>
      <p className={`mt-2 truncate text-[16px] font-extrabold tracking-[-0.03em] min-[391px]:text-[17px] ${valueClass}`}>{value}</p>
      <p className="mt-1.5 text-[12px] font-medium text-[#64748B]">{helper}</p>
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
    <section className="rounded-[22px] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-[#0F172A]">{title}</h2>
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
  const toneClass = tone === "green" ? "text-emerald-500" : tone === "red" ? "text-red-500" : "text-[#111827]";
  return (
    <div className="rounded-[18px] bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.06)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#64708A]">{label}</p>
      <p className={`mt-1 truncate text-[14px] font-extrabold ${toneClass}`}>{value}</p>
    </div>
  );
}

export function FieldPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-12 items-center justify-between rounded-[16px] bg-[#F8FAFC] px-4 ring-1 ring-[#E2E8F0]">
      <span className="text-[13px] font-bold text-[#64708A]">{label}</span>
      <span className="text-[14px] font-extrabold text-[#111827]">{value}</span>
    </div>
  );
}

export function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-[20px] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.045)] ring-1 ring-[rgba(15,23,42,0.06)]">
      <p className="text-[15px] font-extrabold">{title}</p>
      <p className="mt-1 text-[13px] font-medium text-[#64708A]">{body}</p>
    </div>
  );
}
