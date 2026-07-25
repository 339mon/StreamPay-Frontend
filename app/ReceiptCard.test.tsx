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

  it("applies color-blind safe pattern classes to the status badge", () => {
    const { container, rerender } = render(<ReceiptCard {...defaultProps} status="active" />);
    let badge = container.querySelector(".receipt-status-badge");
    expect(badge).toHaveClass("cb-pattern");
    expect(badge).toHaveClass("cb-pattern--active");

    rerender(<ReceiptCard {...defaultProps} status="draft" />);
    badge = container.querySelector(".receipt-status-badge");
    expect(badge).toHaveClass("cb-pattern");
    expect(badge).toHaveClass("cb-pattern--draft");

    rerender(<ReceiptCard {...defaultProps} status="withdrawn" />);
    badge = container.querySelector(".receipt-status-badge");
    expect(badge).toHaveClass("cb-pattern");
    expect(badge).toHaveClass("cb-pattern--withdrawn");
  });

  it("renders keyboard shortcut hints by default", () => {
    render(<ReceiptCard {...defaultProps} />);
    
    const maskKbd = screen.getByTestId("receipt-kbd-mask");
    const copyKbd = screen.getByTestId("receipt-kbd-copy");

    expect(maskKbd).toBeInTheDocument();
    expect(maskKbd).toHaveTextContent("M");
    expect(copyKbd).toBeInTheDocument();
    expect(copyKbd).toHaveTextContent("C");
  });

  it("hides keyboard shortcut hints when showKbdHints is false", () => {
    render(<ReceiptCard {...defaultProps} showKbdHints={false} />);
    
    expect(screen.queryByTestId("receipt-kbd-mask")).not.toBeInTheDocument();
    expect(screen.queryByTestId("receipt-kbd-copy")).not.toBeInTheDocument();
  });

  it("handles keyboard shortcut 'c' to copy share text", async () => {
    const mockClipboard = {
      writeText: jest.fn().mockResolvedValue(undefined),
    };
    Object.assign(navigator, {
      clipboard: mockClipboard,
    });

    render(<ReceiptCard {...defaultProps} defaultMasked={false} />);
    
    fireEvent.keyDown(window, { key: "c" });

    expect(mockClipboard.writeText).toHaveBeenCalledWith(
      "StreamPay receipt stream-123456: 100.00 USDC to GB7ABCD...WXYZ"
    );
    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeInTheDocument();
    });
  });

  it("handles keyboard shortcut 'm' to toggle mask", () => {
    const recipient = "GB7ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    render(<ReceiptCard {...defaultProps} recipient={recipient} />);
    
    const masked = maskAddress(recipient);
    expect(screen.getByTestId("receipt-recipient")).toHaveTextContent(masked);

    // Press 'm' to unmask
    fireEvent.keyDown(window, { key: "m" });
    expect(screen.getByTestId("receipt-recipient")).toHaveTextContent(recipient);

    // Press 'm' to mask again
    fireEvent.keyDown(window, { key: "M" });
    expect(screen.getByTestId("receipt-recipient")).toHaveTextContent(masked);
  });

  it("does not trigger keyboard shortcuts when focused in text inputs", () => {
    render(
      <div>
        <input data-testid="text-input" type="text" />
        <ReceiptCard {...defaultProps} recipient="GB7ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890" />
      </div>
    );

    const input = screen.getByTestId("text-input");
    input.focus();

    const masked = maskAddress("GB7ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");
    expect(screen.getByTestId("receipt-recipient")).toHaveTextContent(masked);

    // Press 'm' while focused in input text
    fireEvent.keyDown(input, { key: "m" });
    // Mask should NOT toggle
    expect(screen.getByTestId("receipt-recipient")).toHaveTextContent(masked);
  });
});
