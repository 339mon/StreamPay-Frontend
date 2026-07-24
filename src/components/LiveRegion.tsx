"use client";

import React from "react";

export interface LiveRegionProps {
  /** Text message to announce to screen readers */
  message?: string;
  /** Politeness level for aria-live announcements ("polite", "assertive", "off"). Defaults to "polite". */
  politeness?: "polite" | "assertive" | "off";
  /** Directly sets aria-live attribute (takes precedence over politeness) */
  "aria-live"?: "polite" | "assertive" | "off";
  /** Whether screen reader should announce the entire region on change. Defaults to true. */
  atomic?: boolean;
  /** Directly sets aria-atomic attribute */
  "aria-atomic"?: boolean;
  /** ARIA role for the live region ("status", "alert", "log", etc.) */
  role?: "status" | "alert" | "log" | string;
  /** Types of changes to announce ("additions text", "all", etc.) */
  "aria-relevant"?: "additions" | "removals" | "text" | "all" | "additions text";
  /** Additional CSS class names */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Children elements if message is not supplied */
  children?: React.ReactNode;
}

/**
 * LiveRegion provides an accessible ARIA live region for screen reader announcements.
 * Dynamic content rendered inside is announced when updated without interrupting visual flow.
 */
export function LiveRegion({
  message,
  politeness = "polite",
  "aria-live": ariaLive,
  atomic = true,
  "aria-atomic": ariaAtomic,
  role,
  "aria-relevant": ariaRelevant,
  className = "",
  style,
  children,
}: LiveRegionProps) {
  const live = ariaLive ?? politeness;
  const isAtomic = ariaAtomic ?? atomic;
  const computedRole = role ?? (live === "assertive" ? "alert" : "status");

  // Visually hidden style to guarantee SR accessibility regardless of external CSS loading
  const srOnlyStyle: React.CSSProperties = {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: "0",
    ...style,
  };

  return (
    <div
      aria-live={live}
      aria-atomic={isAtomic}
      aria-relevant={ariaRelevant}
      role={computedRole}
      className={`sr-only ${className}`.trim()}
      style={srOnlyStyle}
      data-testid="live-region"
    >
      {message ?? children}
    </div>
  );
}

export default LiveRegion;
