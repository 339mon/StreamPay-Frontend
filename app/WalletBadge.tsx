"use client";

import React, { useEffect, useMemo, useState } from "react";
import { LiveRegion } from "../src/components/LiveRegion";
import { EmptyState } from "../src/components/EmptyState";

export type WalletState = "disconnected" | "connecting" | "connected" | "error" | "disconnecting";

export interface WalletBadgeProps {
  /** Connection state of the wallet */
  state?: WalletState;
  /** Stellar wallet public key / address */
  address?: string | null;
  /** Name of the connected wallet provider (e.g. Freighter, Albedo) */
  providerName?: string;
  /** Connected network name (e.g. Mainnet, Testnet) */
  network?: string;
  /** Formatted balance string (e.g. "100.00 XLM") */
  balance?: string;
  /** Error details if state === "error" */
  errorMessage?: string;
  /** Callback triggered when user clicks connect */
  onConnect?: () => void;
  /** Callback triggered when user clicks disconnect */
  onDisconnect?: () => void;
  /** Callback triggered when user clicks the badge container */
  onClick?: () => void;
  /** Screen reader announcement politeness level */
  politeness?: "polite" | "assertive";
  /** Manual announcement message override */
  announcement?: string;
  /** Additional CSS class names */
  className?: string;
  /** Whether to show a detailed empty state when disconnected */
  showEmptyState?: boolean;
}

/**
 * WalletBadge displays current wallet status and announces state changes via an ARIA live region.
 */
export function WalletBadge({
  state = "disconnected",
  address = null,
  providerName,
  network,
  balance,
  errorMessage,
  onConnect,
  onDisconnect,
  onClick,
  politeness = "polite",
  announcement,
  className = "",
  showEmptyState = false,
}: WalletBadgeProps) {
  const [srMessage, setSrMessage] = useState<string>("");

  const formattedAddress = useMemo(() => {
    if (!address) return "";
    if (address.length <= 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }, [address]);

  // Generate SR-announce text on state/prop changes
  useEffect(() => {
    if (announcement !== undefined) {
      setSrMessage(announcement);
      return;
    }

    const provider = providerName ? providerName : "Wallet";

    switch (state) {
      case "connecting":
        setSrMessage(`Connecting to ${provider}...`);
        break;
      case "connected": {
        const parts = [`${provider} connected.`];
        if (formattedAddress) parts.push(`Address: ${formattedAddress}.`);
        if (network) parts.push(`Network: ${network}.`);
        if (balance) parts.push(`Balance: ${balance}.`);
        setSrMessage(parts.join(" "));
        break;
      }
      case "disconnecting":
        setSrMessage(`Disconnecting from ${provider}...`);
        break;
      case "disconnected":
        setSrMessage(`${provider} disconnected.`);
        break;
      case "error":
        setSrMessage(`Wallet connection error: ${errorMessage || "Failed to connect"}`);
        break;
      default:
        setSrMessage("");
    }
  }, [state, address, formattedAddress, providerName, network, balance, errorMessage, announcement]);

  const handleAction = (e: React.MouseEvent) => {
    if (onClick) onClick();
    if (state === "disconnected" && onConnect) {
      onConnect();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (onClick) onClick();
      if (state === "disconnected" && onConnect) {
        onConnect();
      }
    }
  };

  const getStatusColor = () => {
    switch (state) {
      case "connected":
        return "#10B981"; // green
      case "connecting":
      case "disconnecting":
        return "#F59E0B"; // amber / yellow
      case "error":
        return "#EF4444"; // red
      case "disconnected":
      default:
        return "#9CA3AF"; // gray
    }
  };

  const isInteractive = Boolean(onClick || (state === "disconnected" && onConnect));

  if (showEmptyState && state === "disconnected") {
    return (
      <EmptyState
        title="Wallet Disconnected"
        description="Connect your Stellar wallet to participate in the GrantFox campaign."
        illustration={
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
        }
        ctaText="Connect Wallet"
        onCtaClick={onConnect}
        className={className}
        testId="wallet-badge-empty-state"
      />
    );
  }

  return (
    <div
      className={`wallet-badge wallet-badge--${state} ${className}`.trim()}
      onClick={handleAction}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      role={isInteractive ? "button" : "region"}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={`Wallet status: ${state}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.4rem 0.8rem",
        borderRadius: "9999px",
        border: "1px solid var(--border, #374151)",
        backgroundColor: "var(--panel, #1F2937)",
        color: "var(--foreground, #F9FAFB)",
        fontSize: "0.875rem",
        fontWeight: 500,
        cursor: isInteractive ? "pointer" : "default",
        userSelect: "none",
        position: "relative",
      }}
      data-testid="wallet-badge"
    >
      {/* Status Dot */}
      <span
        className="wallet-badge__dot"
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: getStatusColor(),
          display: "inline-block",
        }}
        aria-hidden="true"
      />

      {/* Main Content */}
      <span className="wallet-badge__label">
        {state === "connecting" && (providerName ? `Connecting ${providerName}...` : "Connecting...")}
        {state === "disconnecting" && "Disconnecting..."}
        {state === "error" && (errorMessage || "Connection Error")}
        {state === "disconnected" && "Connect Wallet"}
        {state === "connected" && (
          <>
            {providerName && <span style={{ opacity: 0.8, marginRight: "0.25rem" }}>{providerName}:</span>}
            <span>{formattedAddress || "Connected"}</span>
          </>
        )}
      </span>

      {/* Optional Network tag */}
      {state === "connected" && network && (
        <span
          className="wallet-badge__network"
          style={{
            fontSize: "0.75rem",
            padding: "0.1rem 0.4rem",
            borderRadius: "4px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            color: "var(--muted-light, #9CA3AF)",
          }}
        >
          {network}
        </span>
      )}

      {/* Optional Balance tag */}
      {state === "connected" && balance && (
        <span className="wallet-badge__balance" style={{ fontWeight: 600 }}>
          {balance}
        </span>
      )}

      {/* Disconnect Action Button */}
      {state === "connected" && onDisconnect && (
        <button
          type="button"
          className="wallet-badge__disconnect"
          onClick={(e) => {
            e.stopPropagation();
            onDisconnect();
          }}
          aria-label="Disconnect wallet"
          style={{
            background: "none",
            border: "none",
            color: "var(--muted-light, #9CA3AF)",
            cursor: "pointer",
            fontSize: "0.75rem",
            padding: "0 0.2rem",
            marginLeft: "0.25rem",
          }}
        >
          ✕
        </button>
      )}

      {/* ARIA Live Region Announcement */}
      <LiveRegion message={srMessage} politeness={politeness} />
    </div>
  );
}

export default WalletBadge;
