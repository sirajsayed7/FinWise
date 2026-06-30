import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

interface TrendChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
  title: string;
  color?: string;
}

export function TrendChart({ data, title, color = "#6D35F5" }: TrendChartProps) {
  return (
    <div className="rounded-lg bg-white dark:bg-slate-800 p-4 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.8} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(15, 23, 42, 0.9)",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#e2e8f0"
            }}
          />
          <Area type="monotone" dataKey="value" stroke={color} fillOpacity={1} fill="url(#colorValue)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ComparisonChart({
  data,
  title
}: {
  data: Array<{ name: string; current: number; previous: number }>;
  title: string;
}) {
  return (
    <div className="rounded-lg bg-white dark:bg-slate-800 p-4 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(15, 23, 42, 0.9)",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#e2e8f0"
            }}
          />
          <Legend />
          <Bar dataKey="current" fill="#6D35F5" />
          <Bar dataKey="previous" fill="#cbd5e1" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MetricBoard({
  metrics
}: {
  metrics: Array<{
    label: string;
    value: string;
    change?: string;
    trend?: "up" | "down";
  }>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, i) => (
        <div key={i} className="rounded-lg bg-white dark:bg-slate-800 p-4 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{metric.label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">{metric.value}</p>
          {metric.change && (
            <p
              className={`mt-1 text-sm font-medium ${
                metric.trend === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {metric.trend === "up" ? "↑" : "↓"} {metric.change}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
