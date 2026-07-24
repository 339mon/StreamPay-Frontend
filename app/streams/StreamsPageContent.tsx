import { useState, useEffect } from "react";
import { StateTriad } from "../components/StateTriad";
import { StreamRow, type StreamRowData } from "../components/StreamRow";
import type { StateTriadState } from "../components/StateTriad";

export type StreamsViewState = "loading" | "populated" | "empty" | "error";

const streamListCopy = {
  description:
    "Track recipients, rates, statuses, and the next action from one scan-friendly streams list.",
  empty: {
    actionLabel: "Create your first stream",
    description: "Get started with a single payout flow. Define a recipient, cadence, and amount in minutes.",
    eyebrow: "First-time setup",
    title: "Start your first stream",
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
  errorMessage?: string;
  onRetry?: () => void;
  onRetryAction?: () => void;
};

export function StreamsPageContent({
  state = "populated",
  streams = mockStreams,
  errorMessage,
  onRetry,
  onRetryAction,
}: StreamsPageContentProps) {
  const [viewState, setViewState] = useState<StateTriadState>("loading");

  useEffect(() => {
    // Map the prop state to StateTriad state
    if (state === "loading") {
      setViewState("loading");
    } else if (state === "error") {
      setViewState("error");
    } else if (state === "empty" || streams.length === 0) {
      setViewState("empty");
    } else {
      setViewState("success");
    }
  }, [state, streams]);

  const handleCreateStream = () => {
    // Navigate to create stream or open modal
    console.log("Create stream clicked");
    // window.location.href = "/streams/new";
  };

  return (
    <main className="page-shell">
      <section className="page-hero">
        <div>
          <p className="page-hero__eyebrow">{streamListCopy.heading}</p>
          <h1 className="page-hero__title">
            Manage every stream from one list.
          </h1>
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

      <section
        className="stream-layout"
        aria-labelledby="streams-overview-title"
      >
        <div className="section-heading">
          <div>
            <h2
              className="section-heading__title"
              id="streams-overview-title"
            >
              Streams overview
            </h2>
            <p className="section-heading__description">
              Recipient, rate, status, and the primary next action stay visible
              at a glance.
            </p>
          </div>
          {viewState === "success" && (
            <p className="section-heading__meta">
              {streamListCopy.populatedCount}
            </p>
          )}
        </div>

        {state === "loading" ? (
          <StreamListSkeleton />
        ) : isEmpty ? (
          <EmptyState
            actionLabel={streamListCopy.empty.actionLabel}
            description={streamListCopy.empty.description}
            eyebrow={streamListCopy.empty.eyebrow}
            title={streamListCopy.empty.title}
          >
            <div className="empty-state__supporting">
              <p className="empty-state__supporting-title">What you&apos;ll set up</p>
              <ul className="empty-state__supporting-list">
                <li>Choose a collaborator or vendor to pay.</li>
                <li>Set a recurring cadence and payout amount.</li>
                <li>Review the schedule before you launch it.</li>
              </ul>
            </div>
          </EmptyState>
        ) : (
          <section aria-label="Streams list" className="stream-list">
            {visibleStreams.map((stream) => (
              <StreamRow key={stream.id} stream={stream} />
            ))}
          </section>
        </StateTriad>
      </section>
    </main>
  );
}
