import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CommandPalette } from './CommandPalette';

describe('CommandPalette', () => {
  it('does not render initially', () => {
    render(<CommandPalette />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on Ctrl+K and closes on Escape', () => {
    render(<CommandPalette />);
    
    // Open
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    
    // Close
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on Cmd+K', () => {
    render(<CommandPalette />);
    
    // Open
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('allows typing in the search input', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    
    const input = screen.getByPlaceholderText('Search commands, streams, and more...');
    fireEvent.change(input, { target: { value: 'test query' } });
    
    expect(input).toHaveValue('test query');
    expect(screen.getByText('No results found for "test query".')).toBeInTheDocument();
  });
});
