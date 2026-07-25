/**
 * KbdHint
 *
 * Reusable component for rendering accessible keyboard shortcut hints using design tokens.
 *
 * ## Accessibility (WCAG 2.1 AA)
 * - Renders semantic `<kbd>` element(s) with readable contrast in both light and dark modes.
 * - Provides `aria-label` for screen reader clarity.
 * - Uses `aria-hidden="true"` on visual key separator symbols (+).
 *
 * ## Design Tokens
 * - Uses `var(--panel-elevated)` or `var(--panel)` for background.
 * - Uses `var(--foreground)` for text color.
 * - Uses `var(--border)` for borders.
 * - Uses `var(--font-mono)` for monospaced shortcut text.
 *
 * ## Usage
 * ```tsx
 * <KbdHint keys="C" ariaLabel="Keyboard shortcut: C" />
 * <KbdHint keys={["Ctrl", "C"]} />
 * <KbdHint keys="M" variant="subtle" size="sm" />
 * ```
 */

"use client";

import React from "react";

export interface KbdHintProps {
  /** Key or array of keys for the shortcut (e.g., "C", ["Ctrl", "C"], "Ctrl+C") */
  keys: string | string[];
  /** Visual variant: "default" | "outline" | "subtle". Default is "default". */
  variant?: "default" | "outline" | "subtle";
  /** Component size: "sm" | "md". Default is "sm". */
  size?: "sm" | "md";
  /** Screen reader label. Defaults to "Keyboard shortcut: [keys]" */
  ariaLabel?: string;
  /** Additional CSS class names */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
  /** Test identifier for testing library */
  testId?: string;
}

export function KbdHint({
  keys,
  variant = "default",
  size = "sm",
  ariaLabel,
  className = "",
  style,
  testId = "kbd-hint",
}: KbdHintProps) {
  const keyList = Array.isArray(keys)
    ? keys
    : typeof keys === "string" && keys.includes("+")
    ? keys.split("+").map((k) => k.trim())
    : [keys];

  const fullShortcutLabel = keyList.join("+");
  const computedAriaLabel = ariaLabel || `Keyboard shortcut: ${fullShortcutLabel}`;

  const baseKbdStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily:
      "var(--font-mono, monospace, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas)",
    fontSize: size === "sm" ? "0.6875rem" : "0.75rem",
    fontWeight: 600,
    lineHeight: 1,
    padding: size === "sm" ? "0.125rem 0.375rem" : "0.2rem 0.5rem",
    borderRadius: "0.25rem",
    minWidth: size === "sm" ? "1.125rem" : "1.375rem",
    textAlign: "center",
    userSelect: "none",
    ...getVariantStyles(variant),
    ...style,
  };

  return (
    <span
      className={`kbd-hint-wrapper ${className}`.trim()}
      aria-label={computedAriaLabel}
      data-testid={testId}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem" }}
    >
      {keyList.map((keyStr, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span
              aria-hidden="true"
              style={{
                fontSize: "0.6875rem",
                color: "var(--muted, #9ca3af)",
                margin: "0 0.1rem",
              }}
            >
              +
            </span>
          )}
          <kbd style={baseKbdStyle}>{keyStr}</kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

function getVariantStyles(variant: "default" | "outline" | "subtle"): React.CSSProperties {
  switch (variant) {
    case "outline":
      return {
        backgroundColor: "transparent",
        color: "var(--foreground, #f9fafb)",
        border: "1px solid var(--border, #374151)",
      };
    case "subtle":
      return {
        backgroundColor: "var(--panel, rgba(255, 255, 255, 0.05))",
        color: "var(--muted-light, #9ca3af)",
        border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
      };
    case "default":
    default:
      return {
        backgroundColor: "var(--panel-elevated, var(--panel, #1f2937))",
        color: "var(--foreground, #f9fafb)",
        border: "1px solid var(--border, #374151)",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
      };
  }
}

export default KbdHint;
