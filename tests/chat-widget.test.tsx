import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatWidget } from "@/components/chatbot/ChatWidget";

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(cleanup);

describe("chat widget lifecycle", () => {
  it("preserves the browser-session draft when minimized", () => {
    render(<ChatWidget initialOpen />);
    const input = screen.getByLabelText("Ask The Place information assistant");
    fireEvent.change(input, { target: { value: "What about Dawson County?" } });

    fireEvent.click(screen.getByRole("button", { name: "Minimize chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Open The Place assistant" }));

    expect(
      (screen.getByLabelText(
        "Ask The Place information assistant",
      ) as HTMLTextAreaElement).value,
    ).toBe("What about Dawson County?");
  });

  it("starts a fresh conversation after the user closes the chat", () => {
    render(<ChatWidget initialOpen />);
    fireEvent.change(
      screen.getByLabelText("Ask The Place information assistant"),
      { target: { value: "A draft question" } },
    );

    fireEvent.click(screen.getByRole("button", { name: "Close chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Open The Place assistant" }));

    expect(
      (screen.getByLabelText(
        "Ask The Place information assistant",
      ) as HTMLTextAreaElement).value,
    ).toBe("");
    expect(screen.getAllByText(/approved information from The Place/i)).toHaveLength(1);
  });
});
