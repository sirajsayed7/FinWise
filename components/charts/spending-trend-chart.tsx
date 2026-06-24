"use client";

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/types";

export default function SpendingTrendChart({
  data,
  width,
  height,
  formatValue
}: {
  data: TrendPoint[];
  width: number;
  height: number;
  formatValue: (value: number) => string;
}) {
  return (
    <AreaChart width={width} height={height} data={data} margin={{ top: 8, right: 2, left: -8, bottom: 0 }} tabIndex={-1} accessibilityLayer={false}>
      <defs>
        <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6D35F5" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#6D35F5" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke="#EEF2F7" vertical={false} />
      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} interval="preserveStartEnd" tickMargin={7} padding={{ left: 4, right: 22 }} />
      <YAxis tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} width={34} tickFormatter={(value) => (Number(value) === 0 ? "0" : `${Number(value) / 1000}K`)} />
      <Tooltip cursor={false} formatter={(value) => [formatValue(Number(value)), "Spent"]} labelStyle={{ color: "#0F172A", fontWeight: 700 }} contentStyle={{ border: 0, borderRadius: 14, boxShadow: "0 12px 28px rgba(15,23,42,0.12)" }} wrapperStyle={{ outline: "none", border: 0 }} />
      <Area type="linear" dataKey="amount" stroke="#6D35F5" strokeWidth={3} fill="url(#trendFill)" activeDot={{ r: 5, fill: "#6D35F5", stroke: "#DDD6FE", strokeWidth: 5 }} dot={{ r: 3.4, fill: "#6D35F5", stroke: "#FFFFFF", strokeWidth: 2 }} />
    </AreaChart>
  );
}
