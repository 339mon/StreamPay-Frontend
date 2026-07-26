import React, { useEffect, useState } from 'react';
import '../src/styles/typography.css'; // Adjust path if needed
import styles from './StreamTypeChip.module.css';
import './styles/patterns.css';

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

/** Valid stream lifecycle statuses for color-blind pattern fills. */
export type StreamStatus =
  | 'active'
  | 'draft'
  | 'paused'
  | 'ended'
  | 'cancelled'
  | 'withdrawn';

/**
 * StreamTypeChip component.
 * Displays a stream type and an amount using tabular figures for better alignment.
 *
 * Accessibility: when `status` is provided the chip receives a SVG-texture
 * overlay (via `cb-pattern--<status>`) so that users with colour-vision
 * deficiency (protanopia / deuteranopia / tritanopia / achromatopsia) can
 * distinguish stream statuses by geometric shape in addition to colour.
 *
 * @param type   - The stream type label (e.g. "Video", "Audio").
 * @param amount - The amount associated with the stream.
 * @param status - Optional stream lifecycle status. When provided, applies the
 *                 matching `cb-pattern--<status>` class from patterns.css.
 */
export interface StreamTypeChipProps {
  type: string;
  amount: number;
  /** Optional stream lifecycle status used to apply a color-blind-safe
   *  texture pattern overlay on the chip. */
  status?: StreamStatus;
}

export const StreamTypeChip: React.FC<StreamTypeChipProps> = ({ type, amount, status }) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const showEmpty =
    isEmpty ||
    type === undefined ||
    type === null ||
    (typeof type === 'string' && type.trim() === '');

  if (showEmpty) {
    return (
      <EmptyState
        title={emptyTitle ?? 'No stream type selected'}
        description={
          emptyDescription ??
          'Pick a stream type to see amount details, or create a new stream to get started.'
        }
        illustration={<StreamTypeChipEmptyIllustration />}
        ctaText={emptyCtaText ?? 'Create a stream'}
        onCtaClick={onEmptyCtaClick}
        className={`stream-type-chip-empty ${className}`.trim()}
        testId="stream-type-chip-empty-state"
        variant="stream-type-chip"
      />
    );
  }

  const chipLabel = `${type} ${amount}`;

  const patternClass = status ? `cb-pattern--${status}` : '';

  return (
    <div
      className={[styles.streamTypeChip, 'stream-type-chip', patternClass].filter(Boolean).join(' ')}
      tabIndex={0}
      data-reduced-motion={prefersReducedMotion}
      data-status={status ?? undefined}
      style={{
        transition: prefersReducedMotion ? 'none' : 'transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease',
        transform: prefersReducedMotion ? 'none' : undefined,
      }}
    >
      <span className={styles.type}>{type}</span>
      <span className={`tabular-nums ${styles.amount}`}>
        {amount ?? 0}
      </span>
      {kbdHint && <KbdHint shortcut={kbdHint} />}
    </div>
  );
};

export default StreamTypeChip;
