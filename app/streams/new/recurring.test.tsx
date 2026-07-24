/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RecurringStreamPage from "./recurring";
import "@testing-library/jest-dom";

describe("RecurringStreamPage", () => {
  it("renders the stream creation form", () => {
    render(<RecurringStreamPage />);
    
    expect(screen.getByText("Create Recurring Stream")).toBeInTheDocument();
    expect(screen.getByText("Stream Name")).toBeInTheDocument();
    expect(screen.getByText("Amount per Payment")).toBeInTheDocument();
    expect(screen.getByText("Recipient Address")).toBeInTheDocument();
    expect(screen.getByText("Frequency")).toBeInTheDocument();
    expect(screen.getByText("Start Date")).toBeInTheDocument();
  });

  it("updates schedule preview when frequency changes", () => {
    render(<RecurringStreamPage />);
    
    // Set a known start date for consistency
    const startDateInput = screen.getByLabelText("Start Date");
    fireEvent.change(startDateInput, { target: { value: "2026-08-01" } });

    // Initial frequency is monthly
    const dateRegexMonthly = /Sep 1|Oct 1|Nov 1/; 
    expect(screen.getByText(dateRegexMonthly)).toBeInTheDocument();

    // Change to weekly
    const frequencySelect = screen.getByLabelText("Frequency");
    fireEvent.change(frequencySelect, { target: { value: "weekly" } });

    // Expect dates exactly 7 days apart from Aug 1 (Aug 8, Aug 15)
    expect(screen.getByText(/Aug 8/)).toBeInTheDocument();
    expect(screen.getByText(/Aug 15/)).toBeInTheDocument();
  });
});
