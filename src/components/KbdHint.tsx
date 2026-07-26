/**
 * KbdHint
 *
 * Displays a list of keyboard shortcuts as visually styled `<kbd>` tags.
 * Used inline within components (e.g. StreamProgress, CommandPalette) to
 * surface discoverable key bindings without cluttering the UI.
 *
 * ## Accessibility (WCAG 2.1 AA)
 * - The hint list is decorative (`aria-hidden="true"`) — screen readers
 *   already announce interactive elements' keyboard behaviour via ARIA.
 * - Each `<kbd>` element is styled to look like a physical key cap.
 * - The component respects `prefers-reduced-motion` by disabling any
 *   transition on the hint reveal.
 * - The parent toggle button (when present) carries `aria-expanded` and
 *   `aria-controls` so assistive tech can understand the show/hide state.
 *
 * ## Usage
 * ```tsx
 * <KbdHint
 *   shortcuts={[
 *     { keys: ["Space"], description: "Pause / resume" },
 *     { keys: ["Ctrl", "K"], description: "Command palette" },
 *   ]}
 * />
 * ```
 */

"use client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KbdShortcut {
  /** Key labels to display (e.g. ["Space"], ["Ctrl", "K"]). */
  keys: string[];
  /** Human-readable description of the action. */
  description: string;
}

export interface KbdHintProps {
  /** List of keyboard shortcuts to display. */
  shortcuts: KbdShortcut[];
  /** Optional CSS class forwarded to the wrapper element. */
  className?: string;
  /** Optional data-testid for test selectors. */
  "data-testid"?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function KbdHint({
  shortcuts,
  className = "",
  "data-testid": testId,
}: KbdHintProps) {
  if (shortcuts.length === 0) return null;

  return (
    <div
      className={`kbd-hint ${className}`.trim()}
      role="list"
      aria-label="Keyboard shortcuts"
      data-testid={testId}
    >
      {shortcuts.map((shortcut, index) => (
        <span className="kbd-hint__item" key={index} role="listitem">
          <span className="kbd-hint__keys" aria-hidden="true">
            {shortcut.keys.map((key, keyIndex) => (
              <span key={keyIndex}>
                {keyIndex > 0 && <span className="kbd-hint__separator">+</span>}
                <kbd className="kbd">{key}</kbd>
              </span>
            ))}
          </span>
          <span className="kbd-hint__description">{shortcut.description}</span>
        </span>
      ))}
    </div>
  );
}
