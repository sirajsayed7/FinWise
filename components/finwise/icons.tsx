import type { ReactNode } from "react";

function IconShell({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function BellIcon() { return <IconShell><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></IconShell>; }
export function LogoMark() { return <svg aria-hidden="true" viewBox="0 0 28 28" className="h-8 w-8"><rect x="3" y="15" width="5" height="10" rx="2.5" fill="#38BDF8" /><rect x="11.5" y="9" width="5" height="16" rx="2.5" fill="#6D35F5" /><rect x="20" y="3" width="5" height="22" rx="2.5" fill="#D946EF" /></svg>; }
export function RobotIcon() { return <svg aria-hidden="true" viewBox="0 0 72 72" className="h-[64px] w-[64px] shrink-0"><circle cx="36" cy="39" r="25" fill="#EDE9FE" /><path d="M23 32c0-8 6-14 13-14s13 6 13 14v11c0 8-6 13-13 13s-13-5-13-13V32Z" fill="#5B21B6" /><rect x="18" y="34" width="36" height="20" rx="10" fill="#6D35F5" /><circle cx="29" cy="44" r="3.5" fill="white" /><circle cx="43" cy="44" r="3.5" fill="white" /><path d="M36 18v-7" stroke="#6D35F5" strokeWidth="3" strokeLinecap="round" /><circle cx="36" cy="9" r="3" fill="#6D35F5" /><path d="M18 42h-4M58 42h-4" stroke="#6D35F5" strokeWidth="4" strokeLinecap="round" /></svg>; }
export function EyeIcon() { return <IconShell className="h-5 w-5"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></IconShell>; }
export function TrendIcon() { return <IconShell className="h-7 w-7"><path d="m5 15 5-5 4 4 5-7" /><path d="M15 7h4v4" /></IconShell>; }
export function ArrowDownIcon() { return <IconShell><path d="M12 4v15" /><path d="m6 13 6 6 6-6" /></IconShell>; }
export function ArrowUpIcon() { return <IconShell><path d="M12 20V5" /><path d="m6 11 6-6 6 6" /></IconShell>; }
export function WalletIcon() { return <IconShell><path d="M4 7h16v12H4z" /><path d="M16 12h4" /></IconShell>; }
export function StatementIcon() { return <IconShell className="h-7 w-7"><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v5h5" /><path d="M10 13h6" /><path d="M10 17h4" /></IconShell>; }
export function CheckIcon() { return <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3 3 7-7" /></svg>; }
export function ChevronIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-[#536180]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>; }
export function HomeIcon() { return <IconShell><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /></IconShell>; }
export function ReceiptIcon() { return <IconShell><path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1z" /><path d="M9 8h6" /><path d="M9 12h6" /></IconShell>; }
export function UploadIcon() { return <IconShell><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></IconShell>; }
export function ChartIcon() { return <IconShell><path d="M6 20V10" /><path d="M12 20V4" /><path d="M18 20v-7" /></IconShell>; }
export function GearIcon() { return <IconShell><circle cx="12" cy="12" r="3" /><path d="M19.4 15a8 8 0 0 0 .1-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 5.5h-4L10.6 8a8 8 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8 8 0 0 0 .1 2l-2.1 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.4 2.5h4l.4-2.5a8 8 0 0 0 1.7-1l2.4 1 2-3.5z" /></IconShell>; }
export function SearchIcon() { return <IconShell className="h-4 w-4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></IconShell>; }
export function ChevronDownIcon() { return <IconShell className="h-4 w-4"><path d="m6 9 6 6 6-6" /></IconShell>; }
export function ChevronUpIcon({ collapsed }: { collapsed?: boolean }) { return <IconShell className={collapsed ? "h-4 w-4 rotate-180" : "h-4 w-4"}><path d="m18 15-6-6-6 6" /></IconShell>; }
export function FilterIcon() { return <IconShell className="h-4 w-4"><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></IconShell>; }
export function CalendarIcon() { return <IconShell className="h-4 w-4"><path d="M8 2v4" /><path d="M16 2v4" /><path d="M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="3" /></IconShell>; }
export function OpenIcon() { return <IconShell className="h-4 w-4"><path d="M14 3h7v7" /><path d="m10 14 11-11" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></IconShell>; }
export function DotsIcon() { return <IconShell className="h-4 w-4"><path d="M12 5h.01" /><path d="M12 12h.01" /><path d="M12 19h.01" /></IconShell>; }
