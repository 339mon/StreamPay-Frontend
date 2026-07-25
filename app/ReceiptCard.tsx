"use client";

import React, { useState, useCallback } from "react";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  draft: "Draft",
  ended: "Ended",
  paused: "Paused",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
};

export type ReceiptCardProps = {
  streamId: string;
  recipient: string;
  amount: string;
  assetCode?: string;
  status?: string;
  network?: "testnet" | "mainnet";
  defaultMasked?: boolean;
};

export function maskAddress(address: string): string {
  if (address.length <= 10) return "•".repeat(address.length);
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

const COPY_FEEDBACK_MS = 2000;

export function ReceiptCard({
  streamId,
  recipient,
  amount,
  assetCode = "XLM",
  status,
  network,
  defaultMasked = true,
}: ReceiptCardProps) {
  const [masked, setMasked] = useState(defaultMasked);
  const [copied, setCopied] = useState(false);

  const shownRecipient = masked ? maskAddress(recipient) : recipient;
  const networkLabel = network === "mainnet" ? "Stellar Mainnet" : "Stellar Testnet";
  const statusLabel = status ? STATUS_LABELS[status] ?? status : undefined;

  const handleCopy = useCallback(() => {
    const shareText = `StreamPay receipt ${streamId}: ${amount} ${assetCode} to ${shownRecipient}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
      }).catch((e) => {
        console.error("Failed to copy", e);
      });
    }
  }, [streamId, amount, assetCode, shownRecipient]);

  return (
    <article
      className="receipt-doc"
      style={{
        backgroundColor: "var(--panel)",
        color: "var(--foreground)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "24px",
        maxWidth: "400px",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        boxShadow: "var(--shadow-soft)"
      }}
      aria-label="Stream receipt card"
    >
      <header className="receipt-header" style={{ marginBottom: "16px" }}>
        <div className="receipt-brand" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="receipt-brand__wordmark" style={{ fontWeight: 600, fontSize: "1.125rem" }}>StreamPay</span>
            <span className="receipt-brand__tagline" style={{ marginLeft: "8px", color: "var(--muted)" }}>Receipt</span>
          </div>
          {network && (
            <span 
              className="receipt-network-badge" 
              data-network={network}
              style={{
                fontSize: "0.75rem",
                padding: "2px 8px",
                borderRadius: "999px",
                backgroundColor: network === "mainnet" ? "var(--system-success-bg)" : "var(--system-warning-bg)",
                color: network === "mainnet" ? "var(--system-success-text)" : "var(--system-warning-text)",
                border: `1px solid ${network === "mainnet" ? "var(--system-success-border)" : "var(--system-warning-border)"}`
              }}
            >
              {networkLabel}
            </span>
          )}
        </div>
      </header>

      <section className="receipt-section" style={{ textAlign: "center", margin: "24px 0" }}>
        <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--foreground)" }}>
          {amount} <span style={{ fontSize: "1.25rem", color: "var(--muted)" }}>{assetCode}</span>
        </div>
      </section>

      <div className="receipt-divider" style={{ borderTop: "1px dashed var(--border)", margin: "16px 0" }}></div>

      <dl className="receipt-kv" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px", fontSize: "0.875rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <dt style={{ color: "var(--muted)" }}>Recipient</dt>
          <dd data-testid="receipt-recipient" className="receipt-mono" style={{ fontFamily: "monospace", color: "var(--foreground)" }}>
            {shownRecipient}
          </dd>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <dt style={{ color: "var(--muted)" }}>Stream</dt>
          <dd className="receipt-mono" style={{ fontFamily: "monospace", color: "var(--foreground)" }}>
            {streamId}
          </dd>
        </div>
      </dl>

      <div className="receipt-divider" style={{ borderTop: "1px dashed var(--border)", margin: "16px 0" }}></div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="receipt-status">
          {statusLabel && (
            <span
              className={`receipt-status-badge receipt-status-badge--${status}`}
              style={{
                fontSize: "0.75rem",
                padding: "2px 8px",
                borderRadius: "4px",
                backgroundColor: `var(--stream-status-${status}-bg, var(--panel-elevated))`,
                color: `var(--stream-status-${status}-text, var(--foreground))`,
                border: `1px solid var(--stream-status-${status}-border, var(--border))`
              }}
            >
              {statusLabel}
            </span>
          )}
        </div>

        <div className="receipt-actions" style={{ display: "flex", gap: "8px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", color: "var(--muted)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={masked}
              onChange={(e) => setMasked(e.target.checked)}
              aria-label="Mask recipient address for privacy"
              style={{ accentColor: "var(--accent)" }}
            />
            Mask
          </label>

          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Share text copied" : "Copy share text"}
            style={{
              background: copied ? "var(--system-success-bg)" : "transparent",
              color: copied ? "var(--system-success-text)" : "var(--accent)",
              border: `1px solid ${copied ? "var(--system-success-border)" : "var(--accent)"}`,
              borderRadius: "4px",
              padding: "4px 8px",
              fontSize: "0.75rem",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </article>
  );
}
