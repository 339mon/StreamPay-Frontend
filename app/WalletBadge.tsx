"use client";

import React from "react";

/**
 * Props for the WalletBadge component.
 */
export interface WalletBadgeProps {
  /** Optional Stellar wallet address or public key (e.g. G...) */
  address?: string;
  /** Wallet balance amount (numeric or string representation) */
  balance?: string | number;
  /** Asset or currency code display (defaults to "XLM") */
  assetCode?: string;
  /** Optional pending transaction or activity count */
  pendingCount?: number;
  /** Optional Stellar network indicator label (e.g. "Mainnet", "Testnet") */
  network?: string;
  /** Additional CSS class names for styling overrides */
  className?: string;
  /** Optional click event handler */
  onClick?: () => void;
}

/**
 * WalletBadge Component
 *
 * GrantFox campaign (Stellar Wave) component for displaying wallet status, address,
 * balance, and pending activities. Uses `tabular-nums` formatting for fixed-width
 * digit rendering to prevent visual jitter when numeric values update dynamically.
 *
 * SECURITY & ACCESSIBILITY:
 * - WCAG 2.1 AA compliant with appropriate ARIA roles and labels.
 * - Tabular numbers ensure clean readability across all screen breakpoints.
 */
export function WalletBadge({
  address,
  balance,
  assetCode = "XLM",
  pendingCount,
  network,
  className = "",
  onClick,
}: WalletBadgeProps) {
  const formattedAddress = address
    ? address.length > 8
      ? `${address.slice(0, 4)}...${address.slice(-4)}`
      : address
    : null;

  const formattedBalance =
    typeof balance === "number" ? balance.toLocaleString() : balance;

  return (
    <div
      className={`wallet-badge ${className}`.trim()}
      role="status"
      aria-label={
        address
          ? `Wallet ${formattedAddress}${balance !== undefined ? `, Balance: ${formattedBalance} ${assetCode}` : ""}`
          : "Wallet Badge"
      }
      onClick={onClick}
    >
      {network && <span className="wallet-badge__network">{network}</span>}

      {formattedAddress && (
        <span className="wallet-badge__address tabular-nums">
          {formattedAddress}
        </span>
      )}

      {balance !== undefined && balance !== null && (
        <span className="wallet-badge__balance tabular-nums">
          <span className="wallet-badge__amount tabular-nums">
            {formattedBalance}
          </span>{" "}
          <span className="wallet-badge__asset">{assetCode}</span>
        </span>
      )}

      {typeof pendingCount === "number" && pendingCount > 0 && (
        <span
          className="wallet-badge__pending tabular-nums"
          aria-label={`${pendingCount} pending transactions`}
        >
          {pendingCount}
        </span>
      )}
    </div>
  );
}

export default WalletBadge;
