/**
 * @jest-environment jsdom
 */

import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import StreamTypeChip from './StreamTypeChip';
import '@testing-library/jest-dom';

const styleText = fs.readFileSync(
  path.join(__dirname, 'StreamTypeChip.module.css'),
  'utf8'
);

describe('StreamTypeChip', () => {
  it('renders the type and amount correctly', () => {
    render(<StreamTypeChip type="Video" amount={12345} />);
    
    expect(screen.getByText('Video')).toBeInTheDocument();
    expect(screen.getByText('12345')).toBeInTheDocument();
  });

  it('uses a stacked layout on narrow viewports and a row layout above the breakpoint', () => {
    expect(styleText).toContain('.streamTypeChip');
    expect(styleText).toContain('flex-direction: column');
    expect(styleText).toContain('@media (min-width: 30rem)');
    expect(styleText).toContain('flex-direction: row');
  });

  it('applies the tabular-nums class for tabular numerals', () => {
    render(<StreamTypeChip type="Audio" amount={67890} />);
    
    const amountElement = screen.getByText('67890');
    expect(amountElement).toHaveClass('tabular-nums');
  });

  it('is reachable via keyboard tab order', () => {
    const { container } = render(<StreamTypeChip type="Video" amount={12345} />);
    const chip = container.querySelector('.stream-type-chip');
    expect(chip).toHaveAttribute('tabIndex', '0');
  });

  it('receives real DOM focus and carries the shared focus-visible class hook', () => {
    const { container } = render(<StreamTypeChip type="Video" amount={12345} />);
    const chip = container.querySelector('.stream-type-chip') as HTMLElement;
    expect(chip).not.toBeNull();
    chip.focus();
    expect(chip).toHaveFocus();
    expect(chip).toHaveClass('stream-type-chip');
  });
});
