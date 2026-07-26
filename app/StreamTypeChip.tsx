"use client";

import React, { useEffect, useRef, useState } from 'react';
import '../src/styles/typography.css'; // Adjust path if needed
import styles from './StreamTypeChip.module.css';
import { LiveRegion } from '../src/components/LiveRegion';

/**
 * Tracks the user's `prefers-reduced-motion` setting.
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setPrefersReduced(event.matches);

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }

    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);

  return prefersReduced;
}

/**
 * StreamTypeChip component.
 * Displays a stream type and an amount using tabular figures for better alignment.
 * Announces type/amount changes to assistive technologies via an aria-live region.
 *
 * @param {string} type - The type of stream.
 * @param {number} amount - The amount associated with the stream.
 */
export interface StreamTypeChipProps {
  type: string;
  amount: number;
}

export const StreamTypeChip: React.FC<StreamTypeChipProps> = ({ type, amount }) => {
  const prefersReducedMotion = usePrefersReducedMotion();

  // ── ARIA live announcements ────────────────────────────────────────────────
  const [srAnnouncement, setSrAnnouncement] = useState('');
  const prevTypeRef = useRef<string | null>(null);
  const prevAmountRef = useRef<number | null>(null);

  useEffect(() => {
    const prevType = prevTypeRef.current;
    const prevAmount = prevAmountRef.current;

    // First render — seed refs without announcing (avoid false positives).
    if (prevType === null) {
      prevTypeRef.current = type;
      prevAmountRef.current = amount;
      return;
    }

    const typeChanged = prevType !== type;
    const amountChanged = prevAmount !== amount;

    if (typeChanged && amountChanged) {
      setSrAnnouncement(`Stream type ${type}, amount ${amount}`);
    } else if (typeChanged) {
      setSrAnnouncement(`Stream type changed to ${type}`);
    } else if (amountChanged) {
      setSrAnnouncement(`Stream amount updated to ${amount}`);
    }

    prevTypeRef.current = type;
    prevAmountRef.current = amount;
  }, [type, amount]);

  return (
    <div
      className={`${styles.streamTypeChip} stream-type-chip`}
      tabIndex={0}
      data-reduced-motion={prefersReducedMotion}
      style={{
        transition: prefersReducedMotion ? 'none' : 'transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease',
        transform: prefersReducedMotion ? 'none' : undefined,
      }}
    >
      {/* Screen-reader live announcements for type / amount changes */}
      <LiveRegion message={srAnnouncement} data-testid="stream-type-chip-live" />

      <span className={styles.type}>{type}</span>
      <span className={`tabular-nums ${styles.amount}`}>
        {amount}
      </span>
    </div>
  );
};

export default StreamTypeChip;
