import { useMemo, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { PageError } from "../components/PageError";
import { StreamRow, type StreamRowData } from "../components/StreamRow";
import { TagChips } from "../components/TagChips";

export type StreamsViewState = "empty" | "loading" | "populated" | "error";

const streamListCopy = {
  description:
    "Track recipients, rates, statuses, and the next action from one scan-friendly streams list.",
  empty: {
    actionLabel: "Create Your First Stream",
    description: "No streams yet. Create one to start paying collaborators and vendors on a steady schedule.",
    eyebrow: "Streams",
    title: "Your streams list is empty",
  },
  heading: "Streams",
  loadingLabel: "Loading streams",
  populatedCount: "3 active records",
  primaryCta: "Create Stream",
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
  state?: StreamsViewState;
  streams?: StreamRowData[];
  /** Shown in the error panel when state === "error". */
  errorMessage?: string;
  /** Called when the user presses "Try again" in the error panel. */
  onRetry?: () => void;
};

function StreamListSkeleton() {
  return (
    <section aria-label={streamListCopy.loadingLabel} aria-busy="true" className="stream-list">
      {Array.from({ length: 3 }).map((_, index) => (
        <article
          aria-hidden="true"
          className="stream-row stream-row--skeleton"
          data-testid="stream-row-skeleton"
          key={`stream-skeleton-${index + 1}`}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="stream-row__primary">
            <div className="stream-row__skeleton-block">
              {/* Title skeleton matches StreamRow recipient text width */}
              <div className="skeleton skeleton--title" style={{ width: "60%", height: "1.125rem" }} />
              {/* Subtitle skeleton matches schedule text */}
              <div className="skeleton skeleton--text" style={{ width: "40%", height: "0.875rem", marginTop: "0.25rem" }} />
            </div>
            {/* Badge skeleton matches status badge size */}
            <div className="skeleton skeleton--badge" style={{ width: "4.5rem", height: "1.5rem", borderRadius: "9999px" }} />
          </div>

          <div className="stream-row__meta stream-row__meta--skeleton">
            <div>
              <div className="skeleton skeleton--label" style={{ width: "2.5rem", height: "0.75rem" }} />
              <div className="skeleton skeleton--value" style={{ width: "5rem", height: "1rem", marginTop: "0.25rem" }} />
            </div>
            <div>
              <div className="skeleton skeleton--label" style={{ width: "3rem", height: "0.75rem" }} />
              <div className="skeleton skeleton--value" style={{ width: "4rem", height: "1rem", marginTop: "0.25rem" }} />
            </div>
          </div>

          {/* Action button skeleton matches button width */}
          <div className="skeleton skeleton--button" style={{ width: "5.5rem", height: "2rem", borderRadius: "0.375rem" }} />
        </article>
      ))}
    </section>
  );
}

export function StreamsPageContent({
  state = "populated",
  streams = mockStreams,
  errorMessage,
  onRetry,
}: StreamsPageContentProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const tags = useMemo(
    () => Array.from(new Set(streams.flatMap((stream) => stream.tags ?? []))).sort(),
    [streams],
  );

  const visibleStreams = selectedTag
    ? streams.filter((stream) => stream.tags?.includes(selectedTag))
    : streams;

  const isEmpty = state === "empty" || streams.length === 0;
  const showToggle = state === "populated" && !isEmpty;
  const listClass = density === "compact" ? "stream-list stream-list--compact" : "stream-list";

  return (
    <main className="page-shell">
      <section className="page-hero">
        <div>
          <p className="page-hero__eyebrow">{streamListCopy.heading}</p>
          <h1 className="page-hero__title">Manage every stream from one list.</h1>
          <p className="page-hero__description">{streamListCopy.description}</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <button className="button button--secondary" type="button">
            Export History
          </button>
          <div className="density-toggle" aria-label="Streams list density">
            <span className="density-toggle__label">Density</span>
            <button
              type="button"
              className={`density-toggle__switch ${density === "compact" ? "density-toggle__switch--compact" : ""}`}
              role="switch"
              aria-checked={density === "compact"}
              onClick={() => setDensity((d) => (d === "compact" ? "comfortable" : "compact"))}
            >
              <span className="density-toggle__thumb" aria-hidden="true" />
              <span className="sr-only">{density === "compact" ? "Compact density" : "Comfortable density"}</span>
            </button>
          </div>
          <button className="button button--primary" type="button">
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
              Recipient, rate, status, and the primary next action stay visible at a glance.
            </p>
          </div>
          <div className="section-heading__toolbar">
            {showToggle && <p className="section-heading__meta">{streamListCopy.populatedCount}</p>}
            {showToggle && <DensityToggle value={density} onChange={setDensity} />}
          </div>
        </div>

        {state === "populated" && tags.length > 0 && (
          <TagChips tags={tags} selectedTag={selectedTag} onTagClick={setSelectedTag} />
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
            actionLabel={streamListCopy.empty.actionLabel}
            description={streamListCopy.empty.description}
            eyebrow={streamListCopy.empty.eyebrow}
            title={streamListCopy.empty.title}
          />
        ) : visibleStreams.length === 0 ? (
          <p className="section-heading__description" role="status">
            No streams match the “{selectedTag}” tag.
          </p>
        ) : (
          <section aria-label="Streams list" className="stream-list">
            {visibleStreams.map((stream) => (
              <StreamRow key={stream.id} stream={stream} />
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
