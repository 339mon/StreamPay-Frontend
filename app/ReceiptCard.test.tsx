/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReceiptCard, maskAddress } from "./ReceiptCard";

describe("ReceiptCard", () => {
  const defaultProps = {
    streamId: "stream-123456",
    recipient: "GB7ABCD...WXYZ",
    amount: "100.00",
    assetCode: "USDC",
    status: "active",
    network: "testnet" as const,
  };

  it("renders correctly with given props", () => {
    render(<ReceiptCard {...defaultProps} defaultMasked={false} />);
    
    expect(screen.getByText("100.00")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("stream-123456")).toBeInTheDocument();
    expect(screen.getByText("GB7ABCD...WXYZ")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Stellar Testnet")).toBeInTheDocument();
  });

  it("masks the recipient address by default", () => {
    render(<ReceiptCard {...defaultProps} recipient="GB7ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890" />);
    
    const masked = maskAddress("GB7ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");
    expect(screen.getByTestId("receipt-recipient")).toHaveTextContent(masked);
  });

  it("toggles the address masking when checkbox is clicked", () => {
    render(<ReceiptCard {...defaultProps} recipient="GB7ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890" />);
    
    const checkbox = screen.getByLabelText("Mask recipient address for privacy");
    
    // Initially masked
    const masked = maskAddress("GB7ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");
    expect(screen.getByTestId("receipt-recipient")).toHaveTextContent(masked);
    
    // Unmask
    fireEvent.click(checkbox);
    expect(screen.getByTestId("receipt-recipient")).toHaveTextContent("GB7ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");
    
    // Mask again
    fireEvent.click(checkbox);
    expect(screen.getByTestId("receipt-recipient")).toHaveTextContent(masked);
  });

  it("copies share text when copy button is clicked", async () => {
    const mockClipboard = {
      writeText: jest.fn().mockResolvedValue(undefined),
    };
    Object.assign(navigator, {
      clipboard: mockClipboard,
    });

    render(<ReceiptCard {...defaultProps} defaultMasked={false} />);
    
    const copyButton = screen.getByRole("button", { name: "Copy share text" });
    fireEvent.click(copyButton);

    expect(mockClipboard.writeText).toHaveBeenCalledWith(
      "StreamPay receipt stream-123456: 100.00 USDC to GB7ABCD...WXYZ"
    );

    // Should show "Copied" immediately
    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeInTheDocument();
    });
  });

  it("is focusable for keyboard navigation", () => {
    render(<ReceiptCard {...defaultProps} />);
    const article = screen.getByRole("article", { name: "Stream receipt card" });
    
    // Should have tabIndex=0 to receive keyboard focus
    expect(article).toHaveAttribute("tabindex", "0");
    
    // Simulate focus
    article.focus();
    expect(article).toHaveFocus();
  });
});
