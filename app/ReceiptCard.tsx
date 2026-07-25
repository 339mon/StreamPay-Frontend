"use client";

import React, { useState, useCallback } from "react";
import styles from "./ReceiptCard.module.css";

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
      className={styles.card}
      aria-label="Stream receipt card"
    >
      <header className={styles.header}>
        <div className={styles.brand}>
          <div>
            <span className={styles.brandWordmark}>StreamPay</span>
            <span className={styles.brandTagline}>Receipt</span>
          </div>
          {network && (
            <span 
              className={`${styles.networkBadge} ${network === "mainnet" ? styles.networkMainnet : styles.networkTestnet}`}
              data-network={network}
            >
              {networkLabel}
            </span>
          )}
        </div>
      </header>

      <section className={styles.amountSection}>
        <div className={styles.amount}>
          {amount} <span className={styles.assetCode}>{assetCode}</span>
        </div>
      </section>

      <div className={styles.divider}></div>

      <dl className={styles.kv}>
        <div className={styles.kvRow}>
          <dt className={styles.kvLabel}>Recipient</dt>
          <dd data-testid="receipt-recipient" className={styles.kvValue}>
            {shownRecipient}
          </dd>
        </div>
        <div className={styles.kvRow}>
          <dt className={styles.kvLabel}>Stream</dt>
          <dd className={styles.kvValue}>
            {streamId}
          </dd>
        </div>
      </dl>

      <div className={styles.divider}></div>

      <div className={styles.footer}>
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

        <div className={styles.actions}>
          <label className={styles.maskLabel}>
            <input
              type="checkbox"
              checked={masked}
              onChange={(e) => setMasked(e.target.checked)}
              aria-label="Mask recipient address for privacy"
              className={styles.maskInput}
            />
            Mask
          </label>

          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Share text copied" : "Copy share text"}
            className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : styles.copyBtnDefault}`}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </article>
  );
}
