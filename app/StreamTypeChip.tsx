import React, { useEffect, useState } from 'react';
import '../src/styles/typography.css'; // Adjust path if needed
import styles from './StreamTypeChip.module.css';
import { KbdHint } from '../src/components/KbdHint';

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
 * 
 * @param {string} type - The type of stream.
 * @param {number} amount - The amount associated with the stream.
 */
export interface StreamTypeChipProps {
  type: string;
  amount: number;
  kbdHint?: string;
}

export const StreamTypeChip: React.FC<StreamTypeChipProps> = ({ type, amount, kbdHint }) => {
  const prefersReducedMotion = usePrefersReducedMotion();

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
      <span className={styles.type}>{type}</span>
      <span className={`tabular-nums ${styles.amount}`}>
        {amount}
      </span>
      {kbdHint && <KbdHint shortcut={kbdHint} />}
    </div>
  );
};

export default StreamTypeChip;

