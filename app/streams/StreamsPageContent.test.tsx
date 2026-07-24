/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { StreamsPageContent, mockStreams } from "./StreamsPageContent";

// Mock the StreamRow component
jest.mock("../components/StreamRow", () => ({
  StreamRow: ({ stream }: { stream: any }) => (
    <div data-testid="stream-row">
      <span>{stream.recipient}</span>
      <span>{stream.rate}</span>
      <span>{stream.status}</span>
    </div>
  ),
}));

describe("StreamsPageContent", () => {
  it("shows loading state", () => {
    render(<StreamsPageContent state="loading" streams={[]} />);
    
    // Check for loading skeletons
    expect(document.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    expect(screen.getByText(/Loading your streams/i)).toBeInTheDocument();
  });

  it("shows populated state with streams", () => {
    render(<StreamsPageContent state="populated" streams={mockStreams} />);
    
    // Check that streams are rendered
    expect(screen.getByText("Ada Creative Studio")).toBeInTheDocument();
    expect(screen.getByText("Kemi Onboarding Support")).toBeInTheDocument();
    expect(screen.getByText("Yusuf QA Partnership")).toBeInTheDocument();
    
    // Check for the count
    expect(screen.getByText("3 active records")).toBeInTheDocument();
  });

  it("shows empty state when no streams", () => {
    render(<StreamsPageContent state="empty" streams={[]} />);
    
    expect(screen.getByText("Your streams list is empty")).toBeInTheDocument();
    expect(screen.getByText(/No streams yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Your First Stream" })).toBeInTheDocument();
  });

  it("shows error state", () => {
    const onRetry = jest.fn();
    render(
      <StreamsPageContent 
        state="error" 
        streams={[]} 
        errorMessage="Custom error message"
        onRetry={onRetry}
      />
    );
    
    expect(screen.getByText("Couldn't load your streams")).toBeInTheDocument();
    expect(screen.getByText("Custom error message")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("renders the page header with title and description", () => {
    render(<StreamsPageContent state="populated" streams={mockStreams} />);
    
    expect(screen.getByText("Manage every stream from one list.")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Track recipients, rates, statuses, and the next action from one scan-friendly streams list./i
      )
    ).toBeInTheDocument();
  });

  it("shows action buttons", () => {
    render(<StreamsPageContent state="populated" streams={mockStreams} />);
    
    expect(screen.getByRole("button", { name: "Export History" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Stream" })).toBeInTheDocument();
  });
});
