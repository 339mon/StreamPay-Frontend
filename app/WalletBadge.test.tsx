/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { WalletBadge } from "./WalletBadge";

describe("WalletBadge", () => {
  it("renders disconnected state by default with connect label and SR announcement", () => {
    render(<WalletBadge providerName="Freighter" />);
    const badge = screen.getByTestId("wallet-badge");
    expect(badge).toBeInTheDocument();
    expect(screen.getByText("Connect Wallet")).toBeInTheDocument();
    const liveRegion = screen.getByTestId("live-region");
    expect(liveRegion).toHaveTextContent("Freighter disconnected.");
  });

  it("announces connecting state via live region", () => {
    render(<WalletBadge state="connecting" providerName="Freighter" />);
    expect(screen.getByText("Connecting Freighter...")).toBeInTheDocument();
    const liveRegion = screen.getByTestId("live-region");
    expect(liveRegion).toHaveTextContent("Connecting to Freighter...");
  });

  it("announces connected state with formatted address, network, and balance", () => {
    render(
      <WalletBadge
        state="connected"
        address="GABCD1234567890XYZ"
        providerName="Freighter"
        network="Testnet"
        balance="150.00 XLM"
      />
    );
    expect(screen.getByText("GABC...0XYZ")).toBeInTheDocument();
    expect(screen.getByText("Testnet")).toBeInTheDocument();
    expect(screen.getByText("150.00 XLM")).toBeInTheDocument();

    const liveRegion = screen.getByTestId("live-region");
    expect(liveRegion).toHaveTextContent(
      "Freighter connected. Address: GABC...0XYZ. Network: Testnet. Balance: 150.00 XLM."
    );
  });

  it("announces error state with errorMessage", () => {
    render(
      <WalletBadge
        state="error"
        errorMessage="User rejected connection"
        providerName="Albedo"
      />
    );
    expect(screen.getByText("User rejected connection")).toBeInTheDocument();
    const liveRegion = screen.getByTestId("live-region");
    expect(liveRegion).toHaveTextContent("Wallet connection error: User rejected connection");
  });

  it("invokes onConnect when clicked in disconnected state", () => {
    const handleConnect = jest.fn();
    render(<WalletBadge state="disconnected" onConnect={handleConnect} />);
    fireEvent.click(screen.getByTestId("wallet-badge"));
    expect(handleConnect).toHaveBeenCalledTimes(1);
  });

  it("invokes onDisconnect when disconnect button is clicked in connected state", () => {
    const handleDisconnect = jest.fn();
    render(
      <WalletBadge
        state="connected"
        address="GABCD1234567890XYZ"
        onDisconnect={handleDisconnect}
      />
    );
    const disconnectBtn = screen.getByRole("button", { name: "Disconnect wallet" });
    fireEvent.click(disconnectBtn);
    expect(handleDisconnect).toHaveBeenCalledTimes(1);
  });

  it("respects custom announcement override", () => {
    render(
      <WalletBadge
        state="connected"
        address="GABCD1234567890XYZ"
        announcement="Custom screen reader message"
      />
    );
    const liveRegion = screen.getByTestId("live-region");
    expect(liveRegion).toHaveTextContent("Custom screen reader message");
  });

  it("renders EmptyState when showEmptyState is true and state is disconnected", () => {
    render(<WalletBadge state="disconnected" showEmptyState={true} />);
    expect(screen.getByTestId("wallet-badge-empty-state")).toBeInTheDocument();
    expect(screen.getByText("Wallet Disconnected")).toBeInTheDocument();
    expect(screen.getByText("Connect your Stellar wallet to participate in the GrantFox campaign.")).toBeInTheDocument();
  });
});
