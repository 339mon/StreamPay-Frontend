import React, { useEffect, useState } from 'react';
import '../src/styles/typography.css'; // Adjust path if needed
import styles from './StreamTypeChip.module.css';
import { EmptyState } from '../src/components/EmptyState';
import { StreamTypeChipEmptyIllustration } from './StreamTypeChipEmptyIllustration';

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
 * When empty, renders a themed EmptyState with a helpful CTA (Issue #1085).
 */
export interface StreamTypeChipProps {
  /** The type of stream. Optional when rendering the empty state. */
  type?: string;
  /** The amount associated with the stream. Optional when empty. */
  amount?: number;
  /** Force the empty-state illustration + CTA. */
  isEmpty?: boolean;
  /** Empty-state title override. */
  emptyTitle?: string;
  /** Empty-state description override. */
  emptyDescription?: string;
  /** Empty-state CTA label. */
  emptyCtaText?: string;
  /** Empty-state CTA handler. */
  onEmptyCtaClick?: () => void;
  /** Additional CSS class names. */
  className?: string;
}

export const StreamTypeChip: React.FC<StreamTypeChipProps> = ({
  type,
  amount,
  isEmpty = false,
  emptyTitle,
  emptyDescription,
  emptyCtaText,
  onEmptyCtaClick,
  className = '',
}) => {
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

  return (
    <div
      className={`${styles.streamTypeChip} stream-type-chip ${className}`.trim()}
      tabIndex={0}
      data-reduced-motion={prefersReducedMotion}
      style={{
        transition: prefersReducedMotion ? 'none' : 'transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease',
        transform: prefersReducedMotion ? 'none' : undefined,
      }}
    >
      <span className={styles.type}>{type}</span>
      <span className={`tabular-nums ${styles.amount}`}>
        {amount ?? 0}
      </span>
    </div>
  );
};

export default StreamTypeChip;
