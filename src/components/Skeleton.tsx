/**
 * Skeleton
 *
 * Themed loading placeholder that uses `--skeleton-base` and
 * `--skeleton-shine` CSS variables so it adapts to dark / light mode
 * and high-contrast themes without any JavaScript.
 *
 * ## Design token integration
 * The shimmer animation uses the two tokens already defined in
 * `globals.css`:
 *
 *   | Token              | Dark default | Light override |
 *   |--------------------|--------------|----------------|
 *   | `--skeleton-base`  | `#20202a`    | `#f3f4f6`      |
 *   | `--skeleton-shine` | `#31313f`    | `#e5e7eb`      |
 *
 * The `.skeleton` class and variant modifiers (`.skeleton--{variant}`)
 * are defined in `globals.css` which is already imported by Next.js.
 *
 * ## Accessibility (WCAG 2.1 AA)
 * - `aria-hidden="true"` keeps the element out of the AT tree.
 * - The *parent* should set `aria-busy="true"` and optionally
 *   `aria-label="Loading…"` to signal loading state.
 * - `prefers-reduced-motion`: the CSS shimmer animation is automatically
 *   disabled by the `@media (prefers-reduced-motion)` rule in globals.css.
 *
 * ## Usage
 * ```tsx
 * // Bare skeleton (100% wide, 1 rem tall — original defaults)
 * <Skeleton />
 *
 * // Variant-sized skeleton aligned with real UI element
 * <Skeleton variant="title" />
 * <Skeleton variant="button" />
 *
 * // Custom dimensions
 * <Skeleton width="100%" height="2.75rem" />
 *
 * // Circular avatar skeleton
 * <Skeleton width={40} height={40} circle />
 * ```
 */

"use client";

import React from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SkeletonVariant =
  | "title"
  | "text"
  | "badge"
  | "label"
  | "value"
  | "button";

export interface SkeletonProps {
  /** Optional width to override default variant width. */
  width?: string | number;
  /** Optional height to override default variant height. */
  height?: string | number;
  /** Set to `true` for a circular skeleton (e.g. avatar). */
  circle?: boolean;
  /** Additional CSS classes appended to the element. */
  className?: string;
  /**
   * Predetermined variant that matches global CSS tokens for consistent
   * visual parity with real UI elements.
   *
   * | Variant   | Default size       | Real counterpart            |
   * |-----------|--------------------|-----------------------------|
   * | `title`   | 10rem × 1rem       | Page / section headings     |
   * | `text`    | 14rem × 0.875rem   | Body / description copy     |
   * | `badge`   | 5.5rem × 2rem      | Status / tag badge          |
   * | `label`   | 3.5rem × 0.75rem   | Form field labels           |
   * | `value`   | 7rem × 1rem        | Numeric / currency values   |
   * | `button`  | 7.5rem × 2.75rem   | Primary / secondary buttons |
   */
  variant?: SkeletonVariant;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Skeleton component to show loading states with design-token parity.
 * Implements WCAG 2.1 AA accessibility by hiding the presentation element
 * from screen readers.
 */
export function Skeleton({
  width,
  height,
  circle = false,
  className = "",
  variant,
}: SkeletonProps) {
  // Build class string: base class + optional variant modifier + extra classes.
  const variantClass = variant ? `skeleton--${variant}` : "";
  const finalClassName = ["skeleton", variantClass, className]
    .filter(Boolean)
    .join(" ");

  // When a variant is supplied the CSS class drives dimensions; only apply
  // inline overrides when explicitly passed.
  const finalWidth = width ?? (variant ? undefined : "100%");
  const finalHeight = height ?? (variant ? undefined : "1rem");

  return (
    <div
      className={finalClassName}
      aria-hidden="true"
      style={{
        width:
          typeof finalWidth === "number" ? `${finalWidth}px` : finalWidth,
        height:
          typeof finalHeight === "number" ? `${finalHeight}px` : finalHeight,
        borderRadius: circle ? "50%" : undefined,
      }}
    />
  );
}
