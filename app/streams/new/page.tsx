'use client';

import React from 'react';
import Link from 'next/link';
import { CreateStreamForm } from '../CreateStreamForm';

export default function NewStreamPage() {
  return (
    <main className="page-shell">
      <section className="page-hero">
        <div>
          <p className="page-hero__eyebrow">New Stream</p>
          <h1 className="page-hero__title">Create Stream</h1>
          <p className="page-hero__description">
            Set up a continuous payment stream to a Stellar address.
          </p>
        </div>
      </section>

      <section className="csf-section" data-testid="csf-cta-section" style={{ maxWidth: '560px', margin: '0 auto 1.5rem', padding: '0 1.5rem' }}>
        <div
          className="csf-cta-banner"
          data-testid="csf-cta-banner"
        >
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Need a fan-out split?</p>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--muted-light)', fontSize: 'var(--text-sm)' }}>
              Create one stream with percentage-based allocations for multiple recipients.
            </p>
          </div>
          <Link href="/streams/new/multi" className="button button--secondary">
            Create Multi-Recipient Stream
          </Link>
        </div>
      </section>

      <section className="csf-section" data-testid="csf-form-section" style={{ maxWidth: '560px', margin: '0 auto', padding: '0 1.5rem' }}>
        <form
          onSubmit={handleSubmit}
          data-testid="create-stream-form"
          className="create-stream-form"
          style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
        >
          {/* Recipient */}
          <div>
            <label
              htmlFor="recipient"
              style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: '0.5rem', color: 'var(--muted-light)' }}
            >
              Recipient address
            </label>
            <RecentRecipients
              onSelect={setRecipient}
              className="recent-recipients--inline"
            />
            <input
              id="recipient"
              type="text"
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="GABC..."
              className="csf-field"
              style={{ ...fieldStyle, marginTop: '0.5rem' }}
            />
          </div>

          {/* Amount + token */}
          <div className="csf-field-row" data-testid="csf-field-row" style={{ gap: '1rem' }}>
            <div>
              <label
                htmlFor="amount"
                style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: '0.5rem', color: 'var(--muted-light)' }}
              >
                Amount
              </label>
              <input
                id="amount"
                type="number"
                required
                min="0.0000001"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                className="csf-field"
                style={fieldStyle}
              />
            </div>
            <div>
              <label
                htmlFor="token"
                style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: '0.5rem', color: 'var(--muted-light)' }}
              >
                Token
              </label>
              <select
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value as 'XLM' | 'USDC')}
                className="csf-field"
                style={fieldStyle}
              >
                <option value="XLM">XLM</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
          </div>

          {/* Gas-on-recipient toggle — #528 */}
          <GasOnRecipientToggle
            enabled={gasOnRecipient}
            onChange={setGasOnRecipient}
            token={token}
          />

          {/* Actions */}
          <div className="csf-actions" data-testid="csf-actions">
            <button
              type="button"
              className="button button--secondary csf-field"
              onClick={() => window.history.back()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`button button--primary csf-field${isSubmitting ? ' button--busy' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating…' : 'Create Stream'}
            </button>
          </div>
        </form>
      </section>

      {/* Mobile Summary Bottom Sheet */}
      <BottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        title="Review Stream Details"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <p style={{ color: 'var(--muted-light)', fontSize: 'var(--text-sm, 0.875rem)', margin: 0 }}>
            Double-check the payment stream details below before finalizing.
          </p>

          <dl
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md, 8px)',
              padding: '1.25rem',
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
              <dt style={{ color: 'var(--muted)' }}>Recipient</dt>
              <dd style={{ fontWeight: 600, margin: 0, overflowWrap: 'anywhere', textAlign: 'right' }} title={recipient}>
                {shortenAddress(recipient)}
              </dd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
              <dt style={{ color: 'var(--muted)' }}>Amount</dt>
              <dd style={{ fontWeight: 600, margin: 0, textAlign: 'right' }}>
                {amount} {token}
              </dd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
              <dt style={{ color: 'var(--muted)' }}>Fee Bearer</dt>
              <dd style={{ fontWeight: 600, margin: 0, textAlign: 'right' }}>
                {gasOnRecipient ? 'Recipient' : 'You (Sender)'}
              </dd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
              <dt style={{ color: 'var(--muted)' }}>Est. Network Fee</dt>
              <dd style={{ fontWeight: 600, margin: 0, textAlign: 'right' }}>
                {gasOnRecipient ? '0.00001 XLM deducted' : '~0.00001 XLM'}
              </dd>
            </div>
          </dl>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginTop: '0.5rem',
            }}
          >
            <button
              type="button"
              className={`button button--primary${isSubmitting ? ' button--busy' : ''}`}
              disabled={isSubmitting}
              onClick={performCreateStream}
              style={{ width: '100%', minHeight: '2.75rem' }}
            >
              {isSubmitting ? 'Creating…' : 'Confirm & Create'}
            </button>
            <button
              type="button"
              className="button button--secondary"
              disabled={isSubmitting}
              onClick={() => setIsBottomSheetOpen(false)}
              style={{ width: '100%', minHeight: '2.75rem' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </BottomSheet>
    </main>
  );
}

