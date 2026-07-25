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

      <section style={{ maxWidth: '560px', margin: '0 auto 1.5rem', padding: '0 1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
          }}
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

      <CreateStreamForm />
    </main>
  );
}

