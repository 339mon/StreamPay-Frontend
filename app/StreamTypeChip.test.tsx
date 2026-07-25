import React from 'react';
import { render, screen } from '@testing-library/react';
import StreamTypeChip from './StreamTypeChip';
import '@testing-library/jest-dom';

describe('StreamTypeChip', () => {
  it('renders the type and amount correctly', () => {
    render(<StreamTypeChip type="Video" amount={12345} />);
    
    expect(screen.getByText('Video')).toBeInTheDocument();
    expect(screen.getByText('12345')).toBeInTheDocument();
  });

  it('applies the tabular-nums class for tabular numerals', () => {
    render(<StreamTypeChip type="Audio" amount={67890} />);
    
    const amountElement = screen.getByText('67890');
    expect(amountElement).toHaveClass('tabular-nums');
  });
});
