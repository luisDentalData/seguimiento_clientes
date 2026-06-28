import { cn as cx } from "@/lib/utils";

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cx(
        "h-4 w-full animate-pulse rounded-sm bg-fg-subtle",
        className,
      )}
    />
  );
}
