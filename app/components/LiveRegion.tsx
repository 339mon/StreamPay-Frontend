"use client";

export type LiveRegionProps = {
  /** Text announced to assistive tech. An empty string announces nothing. */
  message: string;
  /**
   * `"polite"` waits for the screen reader to finish its current utterance;
   * `"assertive"` interrupts it. Default `"polite"` — appropriate for status
   * updates that aren't time-critical.
   */
  politeness?: "polite" | "assertive";
  /** Optional class forwarded to the wrapper, in addition to `sr-only`. */
  className?: string;
};

/**
 * Visually hidden `aria-live` region for announcing state changes (copy
 * feedback, toggles, async results, ...) to screen reader users without
 * moving focus or rendering visible UI.
 *
 * Mount once per component and update `message` — the DOM text change is
 * what triggers the announcement, so the region itself must stay in the DOM
 * across renders (don't conditionally unmount it).
 */
export function LiveRegion({
  message,
  politeness = "polite",
  className = "",
}: LiveRegionProps) {
  return (
    <div
      className={`sr-only ${className}`.trim()}
      aria-live={politeness}
      aria-atomic="true"
      role={politeness === "assertive" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
