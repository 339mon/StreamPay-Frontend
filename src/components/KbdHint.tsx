/**
 * KbdHint
 *
 * Renders a keyboard shortcut hint inline with form fields.
 * Uses semantic `<kbd>` elements for each key, styled with design tokens
 * so they adapt to dark / light themes without hardcoded colours.
 *
 * ## Accessibility (WCAG 2.1 AA)
 * - Each `<kbd>` is wrapped in an `<abbr>` when a `title` description is
 *   provided, giving screen-reader users context for the shortcut.
 * - The outer `<span>` carries `aria-label` combining all key labels so the
 *   full shortcut reads naturally: "Keyboard shortcut: Ctrl K".
 * - The component is hidden from AT when `aria-hidden` is passed (useful
 *   when the shortcut is already announced in a nearby live region).
 *
 * ## Usage
 * ```tsx
 * // Single key
 * <KbdHint keys={["Esc"]} label="Close" />
 *
 * // Combination (Ctrl + Enter)
 * <KbdHint keys={["Ctrl", "Enter"]} label="Submit" />
 *
 * // Hidden from screen readers (announced elsewhere)
 * <KbdHint keys={["Ctrl", "K"]} aria-hidden />
 * ```
 */

"use client";

import React from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface KbdHintProps {
  /**
   * The key(s) that form the shortcut.  Each entry renders as one `<kbd>`.
   * Multi-key combinations are separated by a "+" glyph.
   */
  keys: string[];
  /**
   * Human-readable description of what the shortcut does.
   * Used as `aria-label` for the whole hint and as `<abbr title>` when
   * a single, ambiguous key glyph is used (e.g. "⌘" → "Command").
   */
  label: string;
  /**
   * When true, the component is hidden from assistive technologies.
   * Use this if the action is already announced via a LiveRegion.
   */
  "aria-hidden"?: boolean;
  /** Additional CSS class applied to the outer wrapper. */
  className?: string;
}

// ── Styles ───────────────────────────────────────────────────────────────────

/**
 * Inline styles use CSS variables already defined in `globals.css` so the
 * component respects dark / light mode and high-contrast themes automatically.
 */
const wrapperStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  verticalAlign: "middle",
};

const kbdStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "inherit",
  fontSize: "0.6875rem",          // 11px — smaller than body text
  lineHeight: 1,
  fontWeight: 600,
  padding: "0.1875rem 0.375rem",  // 3px 6px
  background: "var(--panel-elevated, #17171f)",
  color: "var(--muted-light, #a1a1aa)",
  border: "1px solid var(--border, #27272a)",
  borderBottomWidth: "2px",       // tactile depth, classic kbd look
  borderRadius: "0.25rem",
  boxShadow: "0 1px 0 0 var(--border, #27272a)",
  whiteSpace: "nowrap",
  userSelect: "none",
};

const separatorStyle: React.CSSProperties = {
  color: "var(--muted, #71717a)",
  fontSize: "0.6875rem",
  lineHeight: 1,
  userSelect: "none",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function KbdHint({
  keys,
  label,
  "aria-hidden": ariaHidden,
  className,
}: KbdHintProps) {
  const ariaLabel = `Keyboard shortcut: ${keys.join(" ")}`;

  return (
    <span
      style={wrapperStyle}
      aria-label={ariaHidden ? undefined : ariaLabel}
      aria-hidden={ariaHidden ? "true" : undefined}
      title={label}
      className={className}
      data-testid="kbd-hint"
    >
      {keys.map((key, i) => (
        <React.Fragment key={key}>
          {i > 0 && (
            <span style={separatorStyle} aria-hidden="true">
              +
            </span>
          )}
          <kbd style={kbdStyle}>{key}</kbd>
        </React.Fragment>
      ))}
    </span>
  );
}
