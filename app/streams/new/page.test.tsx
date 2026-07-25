/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react";
const { screen, waitFor, within } = require("@testing-library/react") as any;
import NewStreamPage from "./page";

// Mock recentRecipients module
jest.mock("../../state/recentRecipients", () => ({
  addRecentRecipient: jest.fn(),
  getRecentRecipients: jest.fn(() => []),
}));

// Mock window.matchMedia
const createMockMedia = (matches: boolean) => {
  return () => ({
    matches,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
};

describe("NewStreamPage - Mobile Bottom Sheet Summary", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeAll(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterAll(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("renders the stream creation form successfully", () => {
    window.matchMedia = createMockMedia(false) as any;
    render(<NewStreamPage />);

    expect(screen.getByRole("heading", { name: /create stream/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/recipient address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/token/i)).toBeInTheDocument();
  });

  it("submits the form directly on desktop", async () => {
    window.matchMedia = createMockMedia(false) as any;
    render(<NewStreamPage />);

    // Fill in recipient and amount
    const recipientInput = screen.getByLabelText(/recipient address/i);
    const amountInput = screen.getByLabelText(/amount/i);
    const submitButton = screen.getByRole("button", { name: /create stream/i });

    fireEvent.change(recipientInput, { target: { value: "GD72X2Y3B6V7XW5P4D8Q2Z9K0F1E3R5T7Y9U0I2O4P6A8S0D2F4G6H8J" } });
    fireEvent.change(amountInput, { target: { value: "150" } });

    // Submit
    fireEvent.click(submitButton);

    // Should transition to success directly without showing bottom sheet
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /stream created/i })).toBeInTheDocument();
    });
    expect(screen.queryByTestId("bottom-sheet-overlay")).not.toBeInTheDocument();
  });

  it("opens the BottomSheet on mobile instead of submitting immediately", async () => {
    window.matchMedia = createMockMedia(true) as any;
    render(<NewStreamPage />);

    const recipientInput = screen.getByLabelText(/recipient address/i);
    const amountInput = screen.getByLabelText(/amount/i);
    const submitButton = screen.getByRole("button", { name: /create stream/i });

    fireEvent.change(recipientInput, { target: { value: "GD72X2Y3B6V7XW5P4D8Q2Z9K0F1E3R5T7Y9U0I2O4P6A8S0D2F4G6H8J" } });
    fireEvent.change(amountInput, { target: { value: "150" } });

    // Submit form
    fireEvent.click(submitButton);

    // Verify bottom sheet is open and displays correct summary details
    await waitFor(() => {
      expect(screen.getByTestId("bottom-sheet-overlay")).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: /review stream details/i })).toBeInTheDocument();
    expect(screen.getByText("GD72X2…6H8J")).toBeInTheDocument(); // shortened recipient address
    expect(screen.getByText("150 XLM")).toBeInTheDocument();
    expect(screen.getByText("You (Sender)")).toBeInTheDocument();
  });

  it("submits and creates stream when Confirm & Create is clicked in BottomSheet", async () => {
    window.matchMedia = createMockMedia(true) as any;
    render(<NewStreamPage />);

    const recipientInput = screen.getByLabelText(/recipient address/i);
    const amountInput = screen.getByLabelText(/amount/i);
    const submitButton = screen.getByRole("button", { name: /create stream/i });

    fireEvent.change(recipientInput, { target: { value: "GD72X2Y3B6V7XW5P4D8Q2Z9K0F1E3R5T7Y9U0I2O4P6A8S0D2F4G6H8J" } });
    fireEvent.change(amountInput, { target: { value: "150" } });

    // Submit
    fireEvent.click(submitButton);

    // Verify sheet open
    await waitFor(() => {
      expect(screen.getByTestId("bottom-sheet-overlay")).toBeInTheDocument();
    });

    // Click Confirm & Create in the BottomSheet
    const confirmButton = screen.getByRole("button", { name: /confirm & create/i });
    fireEvent.click(confirmButton);

    // Verify success screen
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /stream created/i })).toBeInTheDocument();
    });
  });

  it("closes the BottomSheet when Cancel is clicked", async () => {
    window.matchMedia = createMockMedia(true) as any;
    render(<NewStreamPage />);

    const recipientInput = screen.getByLabelText(/recipient address/i);
    const amountInput = screen.getByLabelText(/amount/i);
    const submitButton = screen.getByRole("button", { name: /create stream/i });

    fireEvent.change(recipientInput, { target: { value: "GD72X2Y3B6V7XW5P4D8Q2Z9K0F1E3R5T7Y9U0I2O4P6A8S0D2F4G6H8J" } });
    fireEvent.change(amountInput, { target: { value: "150" } });

    // Submit
    fireEvent.click(submitButton);

    // Verify sheet open
    await waitFor(() => {
      expect(screen.getByTestId("bottom-sheet-overlay")).toBeInTheDocument();
    });

    // Click Cancel in BottomSheet
    const overlay = screen.getByTestId("bottom-sheet-overlay");
    const cancelButton = within(overlay).getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    // Simulate animationEnd event because JSDOM doesn't run CSS animations
    fireEvent.animationEnd(overlay);

    // Verify sheet closed
    await waitFor(() => {
      expect(screen.queryByTestId("bottom-sheet-overlay")).not.toBeInTheDocument();
    });

    // Should still be on the edit form
    expect(screen.getByRole("heading", { name: /create stream/i })).toBeInTheDocument();
  });
});
