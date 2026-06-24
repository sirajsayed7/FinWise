"use client";

import { Cell, Pie, PieChart } from "recharts";
import type { SpendingRow } from "@/lib/types";

export default function SpendingPieChart({ rows }: { rows: SpendingRow[] }) {
  return (
    <PieChart width={184} height={184} className="h-full w-full max-w-full" tabIndex={-1} accessibilityLayer={false}>
      <Pie data={rows} dataKey="amount" nameKey="label" innerRadius={62} outerRadius={82} paddingAngle={2} stroke="#FFFFFF" strokeWidth={3} isAnimationActive={false}>
        {rows.map((row) => (
          <Cell key={row.label} fill={row.color} />
        ))}
      </Pie>
    </PieChart>
  );
}
