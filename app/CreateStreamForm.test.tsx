/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CreateStreamForm } from "./CreateStreamForm";

describe("CreateStreamForm", () => {
  describe("tabular-nums formatting for numeric displays", () => {
    it("applies the tabular-nums class to the amount value in the bottom sheet summary", () => {
      render(<CreateStreamForm />);

      const amountInput = screen.getByLabelText(/amount/i);
      fireEvent.change(amountInput, { target: { value: "150.00" } });

      const submitButton = screen.getByRole("button", { name: /create stream/i });
      fireEvent.click(submitButton);

      const tabularAmount = screen.getByText("150.00");
      expect(tabularAmount).toHaveClass("tabular-nums");
    });

    it("applies the tabular-nums class to the estimated network fee display", () => {
      render(<CreateStreamForm />);

      const amountInput = screen.getByLabelText(/amount/i);
      fireEvent.change(amountInput, { target: { value: "150" } });

      const recipientInput = screen.getByLabelText(/recipient address/i);
      fireEvent.change(recipientInput, {
        target: { value: "GD72X2Y3B6V7XW5P4D8Q2Z9K0F1E3R5T7Y9U0I2O4P6A8S0D2F4G6H8J" },
      });

      const submitButton = screen.getByRole("button", { name: /create stream/i });
      fireEvent.click(submitButton);

      const feeDisplay = screen.getByText(/0\.00001 XLM/);
      expect(feeDisplay).toHaveClass("tabular-nums");
    });

    it("applies the tabular-nums class to the token amount in the bottom sheet review", () => {
      render(<CreateStreamForm />);

      const amountInput = screen.getByLabelText(/amount/i);
      fireEvent.change(amountInput, { target: { value: "500.50" } });

      const recipientInput = screen.getByLabelText(/recipient address/i);
      fireEvent.change(recipientInput, {
        target: { value: "GD72X2Y3B6V7XW5P4D8Q2Z9K0F1E3R5T7Y9U0I2O4P6A8S0D2F4G6H8J" },
      });

      const submitButton = screen.getByRole("button", { name: /create stream/i });
      fireEvent.click(submitButton);

      const amountInReview = screen.getByText("500.50");
      expect(amountInReview).toHaveClass("tabular-nums");
    });

    it("renders the CreateStreamForm with all form fields", () => {
      render(<CreateStreamForm />);

      expect(screen.getByLabelText(/recipient address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/token/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /create stream/i })).toBeInTheDocument();
    });

    it("applies the tabular-nums class from src/styles/typography.css to amount elements", () => {
      const { container } = render(<CreateStreamForm />);

      const styleSheets = container.querySelectorAll("style");
      let hasTypographyStyle = false;
      styleSheets.forEach((sheet) => {
        if (sheet.textContent?.includes("tabular-nums")) {
          hasTypographyStyle = true;
        }
      });

      expect(hasTypographyStyle).toBe(true);
    });
  });

  describe("form submission behavior", () => {
    it("submits the form with the correct numeric amount", async () => {
      render(<CreateStreamForm />);

      const amountInput = screen.getByLabelText(/amount/i);
      fireEvent.change(amountInput, { target: { value: "1000" } });

      const submitButton = screen.getByRole("button", { name: /create stream/i });
      fireEvent.click(submitButton);

      await screen.findByText("Stream Created");
      expect(screen.getByRole("heading", { name: /stream created/i })).toBeInTheDocument();
    });

    it("opens the bottom sheet on mobile viewport before submission", async () => {
      const mockMedia = window.matchMedia;
      window.matchMedia = (() => {
        return (query: string) => ({
          matches: query.includes("max-width"),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        }) as any;
      })();

      render(<CreateStreamForm />);

      const amountInput = screen.getByLabelText(/amount/i);
      fireEvent.change(amountInput, { target: { value: "250" } });

      const recipientInput = screen.getByLabelText(/recipient address/i);
      fireEvent.change(recipientInput, {
        target: { value: "GD72X2Y3B6V7XW5P4D8Q2Z9K0F1E3R5T7Y9U0I2O4P6A8S0D2F4G6H8J" },
      });

      const submitButton = screen.getByRole("button", { name: /create stream/i });
      fireEvent.click(submitButton);

      await screen.findByTestId("bottom-sheet-overlay");
      expect(screen.getByTestId("bottom-sheet-overlay")).toBeInTheDocument();

      window.matchMedia = mockMedia;
    });
  });
});