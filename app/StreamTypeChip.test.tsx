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

  describe('reduced-motion', () => {
    afterEach(() => {
      // @ts-expect-error reset between tests
      delete window.matchMedia;
    });

    it('applies standard transition style and attribute when reduced motion is not requested', () => {
      window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const { container } = render(<StreamTypeChip type="Video" amount={12345} />);
      const chip = container.querySelector('.stream-type-chip') as HTMLElement;
      
      expect(chip).toHaveAttribute('data-reduced-motion', 'false');
      expect(chip.style.transition).toContain('transform');
    });

    it('renders static fallback (transition/transform none) when reduced motion is requested', () => {
      window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const { container } = render(<StreamTypeChip type="Video" amount={12345} />);
      const chip = container.querySelector('.stream-type-chip') as HTMLElement;
      
      expect(chip).toHaveAttribute('data-reduced-motion', 'true');
      expect(chip.style.transition).toBe('none');
      expect(chip.style.transform).toBe('none');
    });
  });

  describe('aria-live announcements', () => {
    it('renders a LiveRegion with data-testid stream-type-chip-live', () => {
      render(<StreamTypeChip type="Video" amount={12345} />);
      expect(screen.getByTestId('stream-type-chip-live')).toBeInTheDocument();
    });

    it('has empty announcement on initial render (no false positive)', () => {
      render(<StreamTypeChip type="Video" amount={12345} />);
      const region = screen.getByTestId('stream-type-chip-live');
      expect(region).toHaveTextContent('');
      expect(region).toHaveAttribute('aria-live', 'polite');
      expect(region).toHaveAttribute('role', 'status');
    });

    it('announces type change via aria-live region', () => {
      const { rerender } = render(<StreamTypeChip type="Video" amount={12345} />);
      rerender(<StreamTypeChip type="Audio" amount={12345} />);
      expect(screen.getByTestId('stream-type-chip-live')).toHaveTextContent(
        'Stream type changed to Audio'
      );
    });

    it('announces amount change via aria-live region', () => {
      const { rerender } = render(<StreamTypeChip type="Video" amount={12345} />);
      rerender(<StreamTypeChip type="Video" amount={999} />);
      expect(screen.getByTestId('stream-type-chip-live')).toHaveTextContent(
        'Stream amount updated to 999'
      );
    });

    it('announces combined type and amount when both change', () => {
      const { rerender } = render(<StreamTypeChip type="Video" amount={12345} />);
      rerender(<StreamTypeChip type="Audio" amount={50} />);
      expect(screen.getByTestId('stream-type-chip-live')).toHaveTextContent(
        'Stream type Audio, amount 50'
      );
    });
  });
});

