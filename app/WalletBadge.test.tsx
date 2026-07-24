/** @jest-environment jsdom */

/**
 * WalletBadge Unit Tests
 * GrantFox campaign (Stellar Wave) tabular-nums & accessibility verification.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WalletBadge } from "./WalletBadge";

describe("WalletBadge", () => {
  describe("Render & Props", () => {
    it("renders with default props", () => {
      const { container } = render(<WalletBadge />);
      const badge = container.querySelector(".wallet-badge");
      expect(badge).not.toBeNull();
      expect(badge).toHaveAttribute("role", "status");
    });

    it("truncates long Stellar address and renders with tabular-nums", () => {
      const fullAddress = "GA2C0000000000000000000000000000000000000000000000000001";
      const { container } = render(<WalletBadge address={fullAddress} />);
      const addressEl = container.querySelector(".wallet-badge__address");
      expect(addressEl).not.toBeNull();
      expect(addressEl).toHaveClass("tabular-nums");
      expect(addressEl).toHaveTextContent("GA2C...0001");
    });

    it("renders network label when provided", () => {
      render(<WalletBadge network="Testnet" />);
      expect(screen.getByText("Testnet")).toBeInTheDocument();
    });

    it("triggers onClick callback when clicked", () => {
      const handleClick = jest.fn();
      const { container } = render(<WalletBadge onClick={handleClick} />);
      const badge = container.querySelector(".wallet-badge");
      if (badge) {
        fireEvent.click(badge);
      }
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("tabular-nums font variant formatting (FWC26 Stellar Wave)", () => {
    it("applies tabular-nums class to the balance container and balance amount element", () => {
      const { container } = render(<WalletBadge balance={1500.75} assetCode="XLM" />);
      const balanceEl = container.querySelector(".wallet-badge__balance");
      const amountEl = container.querySelector(".wallet-badge__amount");

      expect(balanceEl).not.toBeNull();
      expect(balanceEl).toHaveClass("tabular-nums");

      expect(amountEl).not.toBeNull();
      expect(amountEl).toHaveClass("tabular-nums");
      expect(amountEl).toHaveTextContent("1,500.75");
    });

    it("applies tabular-nums class when balance is provided as a pre-formatted string", () => {
      const { container } = render(<WalletBadge balance="99,999.00" assetCode="USDC" />);
      const amountEl = container.querySelector(".wallet-badge__amount");
      expect(amountEl).toHaveClass("tabular-nums");
      expect(amountEl).toHaveTextContent("99,999.00");
    });

    it("applies tabular-nums class to the pending count badge when count > 0", () => {
      const { container } = render(<WalletBadge pendingCount={3} />);
      const pendingEl = container.querySelector(".wallet-badge__pending");
      expect(pendingEl).not.toBeNull();
      expect(pendingEl).toHaveClass("tabular-nums");
      expect(pendingEl).toHaveTextContent("3");
    });

    it("does not render pending count badge when pendingCount is 0", () => {
      const { container } = render(<WalletBadge pendingCount={0} />);
      const pendingEl = container.querySelector(".wallet-badge__pending");
      expect(pendingEl).toBeNull();
    });
  });

  describe("Accessibility (WCAG 2.1 AA)", () => {
    it("provides accurate aria-label describing address and balance", () => {
      render(
        <WalletBadge
          address="GA2C0000000000000000000000000000000000000000000000000001"
          balance={500}
          assetCode="XLM"
        />
      );
      const badge = screen.getByRole("status");
      expect(badge).toHaveAttribute("aria-label", "Wallet GA2C...0001, Balance: 500 XLM");
    });

    it("provides aria-label on pending count badge", () => {
      render(<WalletBadge pendingCount={4} />);
      const pendingEl = screen.getByLabelText("4 pending transactions");
      expect(pendingEl).toBeInTheDocument();
      expect(pendingEl).toHaveClass("tabular-nums");
    });
  });
});
