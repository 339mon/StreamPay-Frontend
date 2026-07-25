import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DateRangePicker } from './DateRangePicker';

describe('DateRangePicker', () => {
  it('renders start and end date inputs with accessible labels', () => {
    render(<DateRangePicker startLabel="From" endLabel="To" />);

    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
  });
});
