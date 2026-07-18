import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatInput } from "@/components/chatbot/ChatInput";
import { ChatMessage } from "@/components/chatbot/ChatMessage";
import { QuickActions } from "@/components/chatbot/QuickActions";
import { SourceCards } from "@/components/chatbot/SourceCards";

afterEach(cleanup);

describe("chat input and quick actions", () => {
  it("captures and trims input before clearing it", () => {
    const onSend = vi.fn();
    render(<ChatInput disabled={false} onSend={onSend} />);
    const input = screen.getByLabelText("Ask The Place information assistant");
    fireEvent.change(input, { target: { value: "  Where can I donate food?  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSend).toHaveBeenCalledWith("Where can I donate food?");
    expect(onSend.mock.calls[0]?.[0]).not.toHaveProperty("preventDefault");
    expect((input as HTMLTextAreaElement).value).toBe("");
  });

  it("routes Enter and the submit button through the same callback", () => {
    const onSend = vi.fn();
    render(<ChatInput disabled={false} onSend={onSend} />);
    const input = screen.getByLabelText("Ask The Place information assistant");
    fireEvent.change(input, { target: { value: "First question?" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    fireEvent.change(input, { target: { value: "Second question?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSend.mock.calls.map(([value]) => value)).toEqual([
      "First question?",
      "Second question?",
    ]);
  });

  it("sends quick actions as natural-language strings", () => {
    const onSelect = vi.fn();
    render(<QuickActions onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Donate food" }));
    expect(onSelect).toHaveBeenCalledWith("Where can I donate food?");
    expect(typeof onSelect.mock.calls[0]?.[0]).toBe("string");
  });
});

describe("safe message rendering", () => {
  it("renders supported Markdown for assistant answers", () => {
    render(
      <ChatMessage
        message={{
          id: "assistant-markdown",
          role: "assistant",
          includeInHistory: true,
          content:
            "### Food help\n\n**Start here**\n\n- Pantry\n- Mobile pantry\n\n1. Choose a county\n2. Ask for details\n\nUse `Forsyth` when relevant.",
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Food help" })).toBeDefined();
    expect(screen.getByText("Start here").tagName).toBe("STRONG");
    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getByText("Forsyth").tagName).toBe("CODE");
  });

  it("keeps user content escaped and plain", () => {
    const { container } = render(
      <ChatMessage
        message={{
          id: "user-text",
          role: "user",
          includeInHistory: true,
          content: "<img src=x onerror=alert(1)> **not bold**",
        }}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("strong")).toBeNull();
    expect(
      screen.getByText("<img src=x onerror=alert(1)> **not bold**"),
    ).toBeDefined();
  });

  it("does not render raw HTML in assistant Markdown", () => {
    const { container } = render(
      <ChatMessage
        message={{
          id: "assistant-html",
          role: "assistant",
          includeInHistory: true,
          content: "Safe text <script>alert('x')</script> <img src=x>",
        }}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("does not make unsupported Markdown URLs clickable", () => {
    render(
      <ChatMessage
        message={{
          id: "bad-link",
          role: "assistant",
          includeInHistory: true,
          content: "[Unknown site](https://example.com/private)",
        }}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Unknown site").tagName).toBe("SPAN");
  });

  it("allows approved The Place Markdown links safely", () => {
    render(
      <ChatMessage
        message={{
          id: "good-link",
          role: "assistant",
          includeInHistory: true,
          content:
            "[Food donations](https://www.theplacega.org/food-donations)",
        }}
      />,
    );
    const link = screen.getByRole("link", { name: "Food donations" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("continues to display staff and official website source cards", () => {
    render(
      <SourceCards
        sources={[
          {
            id: "staff",
            title: "Information provided by The Place staff",
            sourceType: "manager_faq",
          },
          {
            id: "website",
            title: "Food Donations | Support Community Through Donations — The Place",
            url: "https://www.theplacega.org/food-donations",
            sourceType: "official_website",
          },
        ]}
      />,
    );
    expect(
      screen.getByText("Information provided by The Place staff"),
    ).toBeDefined();
    const website = screen.getByRole("link", {
      name: /Food Donations.*View on The Place website/,
    });
    expect(website.getAttribute("href")).toBe(
      "https://www.theplacega.org/food-donations",
    );
  });
});
