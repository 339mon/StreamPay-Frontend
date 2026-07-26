"use client";

import { useMemo, useState } from "react";
import { StateTriad } from "../components/StateTriad";
import { StreamRow, type StreamRowData } from "../components/StreamRow";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { PageError } from "../components/PageError";
import type { StateTriadState } from "../components/StateTriad";

export type StreamsViewState = "loading" | "populated" | "empty" | "error";

export type DensityMode = "comfortable" | "compact";

const streamListCopy = {
  description:
    "Track recipients, rates, statuses, and the next action from one scan-friendly streams list.",
  empty: {
    actionLabel: "Create Your First Stream",
    description: "Define a recipient, cadence, and amount in minutes.",
    eyebrow: "Streams",
    title: "Start your first stream",
    guidanceStepsTitle: "What you'll set up",
    guidanceSteps: [
      "Choose a collaborator or vendor to pay",
      "Set your stream rate and schedule",
      "Deposit initial escrow balance to begin streaming",
    ],
  },
  filtered: {
    actionLabel: "Clear filters",
    description:
      "No streams match your current filters. Try clearing one filter or widening your search to bring more streams back into view.",
    eyebrow: "Streams",
    title: "No streams match your current filters",
  },
  heading: "Streams",
  loadingLabel: "Loading your streams…",
  populatedCount: (n: number) => `${n} active record${n === 1 ? "" : "s"}`,
  primaryCta: "Create Stream",
  exportCta: "Export History",
} as const;

export const mockStreams: StreamRowData[] = [
  {
    id: "stream-ada",
    nextAction: "Pause",
    rate: "120 XLM / month",
    recipient: "Ada Creative Studio",
    schedule: "Pays every 30 days",
    status: "active",
    tags: ["design", "vendor"],
  },
  {
    id: "stream-kemi",
    nextAction: "Start",
    rate: "32 XLM / week",
    recipient: "Kemi Onboarding Support",
    schedule: "Draft stream ready to launch",
    status: "draft",
    tags: ["onboarding"],
  },
  {
    id: "stream-yusuf",
    nextAction: "Withdraw",
    rate: "18 XLM / day",
    recipient: "Yusuf QA Partnership",
    schedule: "Ended yesterday with funds available",
    status: "ended",
    tags: ["qa", "vendor"],
  },
];

type StreamsPageContentProps = {
  /** Initial page-level state (overrides auto-detection). */
  state?: StreamsViewState;
  /** List of streams to render (when state==='populated' or auto-empty). */
  streams?: StreamRowData[];
  /** Error headline copy (when state==='error'). */
  errorMessage?: string;
  /** Handler bound to the error-state "Try again" button and top-level CTAs. */
  onRetry?: () => void;
  /** Alias callback for primary CTA action */
  onRetryAction?: () => void;
  /** Initial density layout mode */
  initialDensity?: DensityMode;
  /** Switches the empty-state copy to the filtered-results variant when the current list is empty. */
  emptyStateVariant?: "default" | "filtered";
  /** Optional callback for the filtered empty state CTA. */
  onClearFilters?: () => void;
};

/**
 * Placeholder skeleton rendered during the `loading` state.
 *
 * Produces 3 stacked "ghost rows" whose layout mirrors a populated StreamRow,
 * so the perceived page height is stable before data arrives. Uses the
 * standard `<Skeleton>` component so shimmer + color tokens stay consistent.
 *
 * Label above the rows carries `role="status"` so it's announced politely
 * rather than interrupting assistive tech.
 */
function StreamListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading streams" className="stream-list-loading">
      <p className="skeleton-heading-label">Loading your streams…</p>
      <div className="stream-list" aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <article
            key={i}
            data-testid="stream-row-skeleton"
            className="stream-row stream-row--skeleton"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="stream-row__meta">
              <Skeleton variant="title" width="45%" className="stream-row__skeleton-title" />
              <Skeleton variant="text" width="30%" />
            </div>
            <div className="stream-row__indicators">
              <Skeleton variant="badge" width="4.25rem" height="1.5rem" />
              <Skeleton variant="button" width="5.5rem" height="2rem" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function StreamsPageContent({
  state,
  streams = mockStreams,
  errorMessage = "There was a problem fetching your streams. Check your connection and try again.",
  onRetry,
  onRetryAction,
  initialDensity = "comfortable",
  emptyStateVariant = "default",
  onClearFilters,
}: StreamsPageContentProps) {
  const [density, setDensity] = useState<DensityMode>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("streampay-density");
        if (stored === "compact" || stored === "cozy" || stored === "comfortable") {
          return stored === "compact" ? "compact" : "comfortable";
        }
      } catch {}
    }
    return initialDensity;
  });
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const s of streams) {
      s.tags?.forEach((t) => set.add(t));
    }
    return Array.from(set);
  }, [streams]);

  const filteredStreams = useMemo(() => {
    if (!selectedTag) return streams;
    return streams.filter((s) => s.tags?.includes(selectedTag));
  }, [streams, selectedTag]);

  const isFilteredEmpty =
    (emptyStateVariant === "filtered" || selectedTag !== null) &&
    filteredStreams.length === 0 &&
    state !== "empty";

  const isEmpty = state === "empty" || (state !== "loading" && state !== "error" && filteredStreams.length === 0);
  const viewState = state === "loading" ? "loading" : state === "error" ? "error" : isEmpty ? "empty" : "success";
  const populatedCount = streamListCopy.populatedCount(filteredStreams.length);
  const primaryOnClick = onRetryAction ?? onRetry;

  return (
    <main className="page-shell">
      <section className="page-hero">
        <div>
          <p className="page-hero__eyebrow">{streamListCopy.heading}</p>
          <h1 className="page-hero__title">Manage every stream from one list.</h1>
          <p className="page-hero__description">{streamListCopy.description}</p>
        </div>
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button className="button button--secondary" type="button">
            {streamListCopy.exportCta}
          </button>
          {viewState === "success" && (
            <div className="density-toggle" role="radiogroup" aria-label="List density">
              <span className="density-toggle__label">Density</span>
              <button
                type="button"
                role="radio"
                aria-label="Cozy"
                aria-checked={density !== "compact"}
                className={`density-option ${density !== "compact" ? "is-active" : ""}`}
                onClick={() => {
                  setDensity("comfortable");
                  try { localStorage.setItem("streampay-density", "cozy"); } catch {}
                }}
              >
                Cozy
              </button>
              <button
                type="button"
                role="radio"
                aria-label="Compact"
                aria-checked={density === "compact"}
                className={`density-option ${density === "compact" ? "is-active" : ""}`}
                onClick={() => {
                  setDensity("compact");
                  try { localStorage.setItem("streampay-density", "compact"); } catch {}
                }}
              >
                Compact
              </button>
            </div>
          )}
          <button className="button button--primary" type="button" onClick={primaryOnClick}>
            {streamListCopy.primaryCta}
          </button>
        </div>
      </section>

      <section className="stream-layout" aria-labelledby="streams-overview-title">
        <div className="section-heading">
          <div>
            <h2 className="section-heading__title" id="streams-overview-title">
              Streams overview
            </h2>
            <p className="section-heading__description">
              Recipient, rate, status, and the primary next action stay visible at
              a glance.
            </p>
          </div>
          {viewState === "success" ? (
            <p className="section-heading__meta">{populatedCount}</p>
          ) : null}
        </div>

        {viewState === "success" && availableTags.length > 0 && (
          <div role="group" aria-label="Filter by tag" className="tag-filter-group">
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`tag-chip ${selectedTag === tag ? "is-active" : ""}`}
                onClick={() => setSelectedTag((prev) => (prev === tag ? null : tag))}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {state === "loading" ? (
          <StreamListSkeleton />
        ) : state === "error" ? (
          <PageError
            heading="Couldn't load your streams"
            message={
              errorMessage ??
              "There was a problem fetching your streams. Check your connection and try again."
            }
            onRetry={onRetry}
          />
        ) : isEmpty ? (
          <EmptyState
            actionLabel={isFilteredEmpty ? streamListCopy.filtered.actionLabel : streamListCopy.empty.actionLabel}
            description={isFilteredEmpty ? streamListCopy.filtered.description : streamListCopy.empty.description}
            eyebrow={isFilteredEmpty ? streamListCopy.filtered.eyebrow : streamListCopy.empty.eyebrow}
            title={isFilteredEmpty ? streamListCopy.filtered.title : streamListCopy.empty.title}
            guidanceSteps={isFilteredEmpty ? undefined : streamListCopy.empty.guidanceSteps}
            onAction={isFilteredEmpty ? (onClearFilters ?? (() => setSelectedTag(null))) : primaryOnClick}
          />
        ) : (
          <section aria-label="Streams list" className={`stream-list ${density === "compact" ? "stream-list--compact" : ""}`}>
            {filteredStreams.map((stream) => (
              <StreamRow
                key={stream.id}
                stream={stream}
                density={density === "compact" ? "compact" : undefined}
              />
            ))}
          </section>
        )}
      </section>
    </main>
  );
}

/*
 * Forward reference for convenience: callers importing this file can also
 * import the skeleton rendering for Storybook / design-QA previews.
 */
export { StreamListSkeleton };
