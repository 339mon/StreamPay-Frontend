/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReceiptShareCard, maskAddress } from "./ReceiptShareCard";

const RECIPIENT = "GABCDEF1234567890XYZ";
const MASKED_RECIPIENT = "GABC…0XYZ";

describe("maskAddress", () => {
  it("keeps the first and last four characters", () => {
    expect(maskAddress(RECIPIENT)).toBe(MASKED_RECIPIENT);
  });

  it("fully masks short strings", () => {
    expect(maskAddress("abc")).toBe("•••");
  });

  it("handles empty string", () => {
    expect(maskAddress("")).toBe("");
  });

  it("handles exactly 10 characters", () => {
    expect(maskAddress("1234567890")).toBe("••••••••••");
  });

  it("handles one character", () => {
    expect(maskAddress("A")).toBe("•");
  });
});

describe("ReceiptShareCard", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("renders the amount and asset code", () => {
    render(
      <ReceiptShareCard streamId="s-1" recipient={RECIPIENT} amount="42.00" />,
    );

    expect(screen.getByText("42.00")).toBeInTheDocument();
    expect(screen.getByText("XLM")).toBeInTheDocument();
  });

  it("masks the recipient by default", () => {
    render(
      <ReceiptShareCard streamId="s-1" recipient={RECIPIENT} amount="42.00" />,
    );

    const recipient = screen.getByTestId("receipt-recipient");
    expect(recipient).toHaveTextContent(MASKED_RECIPIENT);
  });

  it("reveals the full recipient when mask is toggled off", () => {
    render(
      <ReceiptShareCard streamId="s-1" recipient={RECIPIENT} amount="42.00" />,
    );

    const toggle = screen.getByLabelText("Mask recipient address for privacy");
    fireEvent.click(toggle);

    const recipient = screen.getByTestId("receipt-recipient");
    expect(recipient).toHaveTextContent(RECIPIENT);
  });

  it("re-masks the recipient when toggled back on", () => {
    render(
      <ReceiptShareCard streamId="s-1" recipient={RECIPIENT} amount="42.00" />,
    );

    const toggle = screen.getByLabelText("Mask recipient address for privacy");
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    const recipient = screen.getByTestId("receipt-recipient");
    expect(recipient).toHaveTextContent(MASKED_RECIPIENT);
  });

  it("shows recipient unmasked when defaultMasked is false", () => {
    render(
      <ReceiptShareCard
        streamId="s-1"
        recipient={RECIPIENT}
        amount="42.00"
        defaultMasked={false}
      />,
    );

    const recipient = screen.getByTestId("receipt-recipient");
    expect(recipient).toHaveTextContent(RECIPIENT);
  });

  it("copies share text to clipboard when copy button is clicked", async () => {
    render(
      <ReceiptShareCard streamId="s-1" recipient={RECIPIENT} amount="42.00" />,
    );

    const copyBtn = screen.getByRole("button", { name: "Copy share text" });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "StreamPay receipt s-1: 42.00 XLM to GABC…0XYZ",
      );
    });
  });

  it("shows copied state after successful copy", async () => {
    render(
      <ReceiptShareCard streamId="s-1" recipient={RECIPIENT} amount="42.00" />,
    );

    const copyBtn = screen.getByRole("button", { name: "Copy share text" });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(copyBtn).toHaveTextContent("Copied");
    });
  });

  it("resets copy button after 2 seconds", async () => {
    render(
      <ReceiptShareCard streamId="s-1" recipient={RECIPIENT} amount="42.00" />,
    );

    const copyBtn = screen.getByRole("button", { name: "Copy share text" });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(copyBtn).toHaveTextContent("Copied");
    });

    jest.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(copyBtn).toHaveTextContent("Copy");
    });
  });

  it("renders the brand wordmark and tagline", () => {
    render(
      <ReceiptShareCard streamId="s-1" recipient={RECIPIENT} amount="10" />,
    );

    expect(screen.getByText("StreamPay")).toBeInTheDocument();
    expect(screen.getByText("Receipt")).toBeInTheDocument();
  });

  it("renders status badge when status is provided", () => {
    render(
      <ReceiptShareCard
        streamId="s-1"
        recipient={RECIPIENT}
        amount="10"
        status="active"
      />,
    );

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("does not render status badge when status is omitted", () => {
    render(
      <ReceiptShareCard streamId="s-1" recipient={RECIPIENT} amount="10" />,
    );

    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("renders network badge when network is provided", () => {
    render(
      <ReceiptShareCard
        streamId="s-1"
        recipient={RECIPIENT}
        amount="10"
        network="mainnet"
      />,
    );

    expect(screen.getByText("Stellar Mainnet")).toBeInTheDocument();
  });

  it("does not render network badge when network is omitted", () => {
    render(
      <ReceiptShareCard streamId="s-1" recipient={RECIPIENT} amount="10" />,
    );

    expect(screen.queryByText("Stellar")).not.toBeInTheDocument();
  });

  it("renders with aria-label on the figure", () => {
    render(
      <ReceiptShareCard streamId="s-1" recipient={RECIPIENT} amount="10" />,
    );

    const figure = screen.getByLabelText("Stream receipt share card");
    expect(figure).toBeInTheDocument();
  });

  it("renders the stream ID", () => {
    render(
      <ReceiptShareCard streamId="stream-abc" recipient={RECIPIENT} amount="10" />,
    );

    expect(screen.getByText("stream-abc")).toBeInTheDocument();
  });

  it("renders with custom asset code", () => {
    render(
      <ReceiptShareCard
        streamId="s-1"
        recipient={RECIPIENT}
        amount="100"
        assetCode="USDC"
      />,
    );

    expect(screen.getByText("USDC")).toBeInTheDocument();
  });

  it("includes masked address in copied text", async () => {
    render(
      <ReceiptShareCard streamId="s-1" recipient={RECIPIENT} amount="42.00" />,
    );

    const copyBtn = screen.getByRole("button", { name: "Copy share text" });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining(MASKED_RECIPIENT),
      );
    });
  });

  it("includes unmasked address in copied text when unmasked", async () => {
    render(
      <ReceiptShareCard streamId="s-1" recipient={RECIPIENT} amount="42.00" />,
    );

    const toggle = screen.getByLabelText("Mask recipient address for privacy");
    fireEvent.click(toggle);

    const copyBtn = screen.getByRole("button", { name: "Copy share text" });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining(RECIPIENT),
      );
    });
  });
});
