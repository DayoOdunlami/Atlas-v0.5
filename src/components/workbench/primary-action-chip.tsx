"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  onClick?: () => void;
  className?: string;
}

export function PrimaryActionChip({ label, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5",
        "px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors",
        className,
      )}
    >
      {label}
      <ArrowRight className="w-4 h-4" />
    </button>
  );
}
