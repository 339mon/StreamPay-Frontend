/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StreamRow, type StreamRowData } from "./StreamRow";

const mockStream: StreamRowData = {
  id: "stream-test",
  nextAction: "Pause",
  rate: "100 XLM / month",
  recipient: "Test Recipient",
  schedule: "Pays every month",
  status: "active",
};

describe("StreamRow", () => {
  it("renders correctly and contains the recipient and action button", () => {
    render(<StreamRow stream={mockStream} />);
    expect(screen.getByText("Test Recipient")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("applies a consistent visible focus ring style when the action button is focused", () => {
    render(<StreamRow stream={mockStream} />);
    const actionButton = screen.getByRole("button", { name: "Pause" });

    // Initial state: not focused, should not have the custom outline styles
    expect(actionButton).not.toHaveStyle({ outline: "2px solid var(--accent)" });

    // Focus the button
    actionButton.focus();
    expect(actionButton).toHaveFocus();

    // Verify it applies the correct design-token outline style for visual consistency
    expect(actionButton).toHaveStyle({
      outline: "2px solid var(--accent)",
      outlineOffset: "2px",
    });

    // Blur the button
    actionButton.blur();
    expect(actionButton).not.toHaveFocus();
    expect(actionButton).not.toHaveStyle({ outline: "2px solid var(--accent)" });
  });
});
