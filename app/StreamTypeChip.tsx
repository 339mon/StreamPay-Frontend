import React from 'react';
import '../src/styles/typography.css'; // Adjust path if needed

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
    <div className="stream-type-chip" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <span className="type" style={{ fontWeight: 'bold' }}>{type}</span>
      <span className="amount tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {amount}
      </span>
    </div>
  );
};

export default StreamTypeChip;
