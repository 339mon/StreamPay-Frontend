import React from 'react';
import '../src/styles/typography.css'; // Adjust path if needed
import styles from './StreamTypeChip.module.css';

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
}

export const StreamTypeChip: React.FC<StreamTypeChipProps> = ({ type, amount }) => {
  return (
    <div
      className={`${styles.streamTypeChip} stream-type-chip`}
      tabIndex={0}
    >
      <span className={styles.type}>{type}</span>
      <span className={`tabular-nums ${styles.amount}`}>
        {amount}
      </span>
    </div>
  );
};

export default StreamTypeChip;
