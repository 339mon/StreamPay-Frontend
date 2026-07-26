import React from 'react';

export interface DateRangePickerProps {
  startLabel?: string;
  endLabel?: string;
}

export function DateRangePicker({
  startLabel = 'Start',
  endLabel = 'End',
}: DateRangePickerProps): JSX.Element {
  return (
    <fieldset>
      <legend>Date range</legend>
      <label>
        <span>{startLabel}</span>
        <input type="date" aria-label={startLabel} />
      </label>
      <label>
        <span>{endLabel}</span>
        <input type="date" aria-label={endLabel} />
      </label>
    </fieldset>
  );
}

export default DateRangePicker;
