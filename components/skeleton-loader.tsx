import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

interface SkeletonLoaderProps {
  count?: number;
  height?: number | string;
  width?: number | string;
  circle?: boolean;
  className?: string;
}

export function SkeletonLoader({
  count = 1,
  height = 20,
  width = "100%",
  circle = false,
  className = ""
}: SkeletonLoaderProps) {
  return (
    <SkeletonTheme baseColor="#f3f4f6" highlightColor="#e5e7eb" borderRadius="0.5rem">
      <div className={className}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} height={height} width={width} circle={circle} className="mb-2" />
        ))}
      </div>
    </SkeletonTheme>
  );
}

export function TransactionSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonLoader count={6} height={60} />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonLoader count={4} height={120} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonLoader count={1} height={300} />
        <SkeletonLoader count={1} height={300} />
      </div>
    </div>
  );
}
