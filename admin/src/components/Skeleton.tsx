import React from 'react';
import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div className={cn("animate-pulse bg-white/5 rounded-md", className)} />
  );
};

export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number, cols?: number }) => {
  return (
    <div className="w-full space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-6 py-4 border-b border-white/5">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={cn("h-4", j === 0 ? "w-1/4" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton = () => (
  <div className="glass p-6 rounded-2xl space-y-3">
    <Skeleton className="h-3 w-1/3" />
    <Skeleton className="h-8 w-1/2" />
  </div>
);
