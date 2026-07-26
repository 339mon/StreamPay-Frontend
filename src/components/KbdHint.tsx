import React from 'react';
import styles from './KbdHint.module.css';

export interface KbdHintProps {
  shortcut: string;
  ariaLabel?: string;
}

export const KbdHint: React.FC<KbdHintProps> = ({ shortcut, ariaLabel }) => {
  return (
    <kbd
      className={styles.kbdHint}
      aria-label={ariaLabel || `Keyboard shortcut: ${shortcut}`}
      title={`Keyboard shortcut: ${shortcut}`}
    >
      {shortcut}
    </kbd>
  );
};

export default KbdHint;
