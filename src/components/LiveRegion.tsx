import React from "react";

type LiveRegionProps = {
  message: string;
  politeness?: "polite" | "assertive";
  className?: string;
  role?: "status" | "alert" | "log";
};

export function LiveRegion({
  message,
  politeness = "polite",
  className = "sr-only",
  role = "status",
}: LiveRegionProps) {
  return (
    <div className={className} aria-live={politeness} role={role}>
      {message}
    </div>
  );
}
