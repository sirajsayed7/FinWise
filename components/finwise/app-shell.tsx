"use client";

import type { ReactNode } from "react";
import { ChartIcon, GearIcon, HomeIcon, ReceiptIcon, UploadIcon } from "@/components/finwise/icons";
import type { ActiveView } from "@/lib/dashboard-types";

export function BottomNavigation({
  activeView,
  setActiveView
}: {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
}) {
  return (
    <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-[430px] rounded-t-[26px] bg-white px-5 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 shadow-2xl shadow-slate-400/30 ring-1 ring-[rgba(15,23,42,0.06)] sm:bottom-5 sm:rounded-[26px]">
      <div className="grid grid-cols-5 items-end text-center text-[12px] font-medium text-[#536180] min-[391px]:text-[13px]">
        <NavItem label="Home" active={activeView === "home" || activeView === "notifications"} icon={<HomeIcon />} onClick={() => setActiveView("home")} />
        <NavItem label="Transactions" active={activeView === "transactions"} icon={<ReceiptIcon />} onClick={() => setActiveView("transactions")} />
        <NavItem label="Upload" active={activeView === "upload"} icon={<UploadIcon />} onClick={() => setActiveView("upload")} raised />
        <NavItem label="Analytics" active={activeView === "insights"} icon={<ChartIcon />} onClick={() => setActiveView("insights")} />
        <NavItem label="Settings" active={activeView === "settings" || activeView === "statements" || activeView === "planning"} icon={<GearIcon />} onClick={() => setActiveView("settings")} dot />
      </div>
    </nav>
  );
}

function NavItem({
  label,
  icon,
  active,
  onClick,
  dot,
  raised
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
  dot?: boolean;
  raised?: boolean;
}) {
  return (
    <button onClick={onClick} aria-current={active ? "page" : undefined} aria-label={label} className={active ? "relative text-[#5D36F0]" : "relative text-[#536180]"}>
      <div className={raised ? "relative mx-auto mb-0.5 grid h-9 w-9 -translate-y-1 place-items-center rounded-full bg-[#633EF2] text-white shadow-lg shadow-[#633EF2]/25" : "relative mx-auto mb-0.5 grid h-7 w-7 place-items-center min-[391px]:h-8 min-[391px]:w-8"}>
        {icon}
        {dot ? <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[#5D36F0]" /> : null}
      </div>
      <span className={raised ? "-mt-1 block" : "block"}>{label}</span>
    </button>
  );
}
