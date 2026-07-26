import React from "react";
import styles from "./KbdHint.module.css";

export interface KbdHintProps {
  /** The keyboard shortcut text to display */
  shortcut: string;
  /** Additional CSS class names */
  className?: string;
}

export function KbdHint({ shortcut, className = "" }: KbdHintProps) {
  if (!shortcut) return null;

  return (
    <kbd className={`${styles.kbd} ${className}`.trim()} aria-hidden="true" data-testid="kbd-hint">
      {shortcut}
    </kbd>
  );
}

export default KbdHint;
