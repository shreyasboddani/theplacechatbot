import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "@/components/chatbot/ChatPanel";

const staffSource = {
  id: "staff-answer",
  title: "Information provided by The Place staff",
  sourceType: "manager_faq" as const,
};

function answered(answer: string) {
  return {
    status: "answered",
    answer,
    sources: [staffSource],
    contactRecommended: false,
  };
}

function mockHttpResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ChatPanel request pipeline", () => {
  it("uses approved-information wording without exposing staff-source labels", () => {
    render(<ChatPanel onMinimize={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/approved information from The Place/i)).toBeDefined();
    expect(screen.queryByText(/staff-provided/i)).toBeNull();
  });

  it("sends a quick action through the normal JSON request pipeline", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockHttpResponse(answered("You can donate food at The Place.")),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatPanel onMinimize={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Donate food" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      "X-Chat-Language": "auto",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      message: "Where can I donate food?",
      history: [],
      language: "auto",
    });
  });

  it("sends typed input and follow-up history with only role and content", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockHttpResponse(answered("The Place offers confirmed food help.")),
      )
      .mockResolvedValueOnce(
        mockHttpResponse(answered("Dawson County has a separate next step.")),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatPanel onMinimize={vi.fn()} onClose={vi.fn()} />);

    const input = screen.getByLabelText("Ask The Place information assistant");
    fireEvent.change(input, { target: { value: "  I need food.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("The Place offers confirmed food help.");

    fireEvent.change(input, { target: { value: "What about Dawson County?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(firstInit.body as string)).toEqual({
      message: "I need food.",
      history: [],
      language: "auto",
    });
    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(secondInit.body as string)).toEqual({
      message: "What about Dawson County?",
      history: [
        { role: "user", content: "I need food." },
        {
          role: "assistant",
          content: "The Place offers confirmed food help.",
        },
      ],
      language: "auto",
    });
  });

  it("prevents a duplicate submission while the first request is pending", () => {
    const fetchMock = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatPanel onMinimize={vi.fn()} onClose={vi.fn()} />);
    const input = screen.getByLabelText("Ask The Place information assistant");
    const form = input.closest("form");
    fireEvent.change(input, { target: { value: "Where can I donate food?" } });
    if (!form) throw new Error("Chat form not found");
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a specific invalid-request response and excludes it from later history", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockHttpResponse({
          status: "invalid_request",
          answer:
            "The browser could not validate the recent conversation. Please restart the chat and try again.",
          sources: [],
          contactRecommended: false,
        }),
      )
      .mockResolvedValueOnce(mockHttpResponse(answered("A grounded answer.")));
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatPanel onMinimize={vi.fn()} onClose={vi.fn()} />);
    const input = screen.getByLabelText("Ask The Place information assistant");

    fireEvent.change(input, { target: { value: "First question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText(/browser could not validate/i);
    fireEvent.change(input, { target: { value: "Second question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const init = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      message: "Second question",
      history: [],
      language: "auto",
    });
  });

  it("shows a visible language selector and sends localized Spanish questions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockHttpResponse(answered("Puedes donar alimentos en The Place.")),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatPanel onMinimize={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText("Language")).toBeDefined();
    expect(
      screen.getByRole("group", { name: "Response language" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Español" }));
    expect(screen.getByText(/Puedo ayudarte a encontrar información aprobada/i)).toBeDefined();
    expect(screen.getByLabelText(/Pregúntale al asistente/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Donar alimentos" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      "X-Chat-Language": "es",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      message: "¿Dónde puedo donar alimentos?",
      history: [],
      language: "es",
    });
  });

  it("offers bounded keyboard resizing only for the floating panel", () => {
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 1000);
    const { unmount } = render(
      <ChatPanel onMinimize={vi.fn()} onClose={vi.fn()} />,
    );
    const dialog = screen.getByRole("dialog");
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      width: 390,
      height: 650,
      x: 0,
      y: 0,
      top: 0,
      right: 390,
      bottom: 650,
      left: 0,
      toJSON: () => ({}),
    });

    fireEvent.keyDown(
      screen.getByRole("button", { name: /Resize chat/i }),
      { key: "ArrowRight" },
    );
    expect(dialog.style.width).toBe("406px");
    expect(dialog.style.height).toBe("650px");
    unmount();

    render(
      <ChatPanel embedded onMinimize={vi.fn()} onClose={vi.fn()} />,
    );
    expect(
      screen.queryByRole("button", { name: /Resize chat/i }),
    ).toBeNull();
  });

  it("resizes the floating panel by dragging its corner handle", () => {
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 1000);
    render(<ChatPanel onMinimize={vi.fn()} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      width: 390,
      height: 650,
      x: 0,
      y: 0,
      top: 0,
      right: 390,
      bottom: 650,
      left: 0,
      toJSON: () => ({}),
    });
    const handle = screen.getByRole("button", { name: /Resize chat/i });

    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 7,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(handle, {
      pointerId: 7,
      clientX: 50,
      clientY: 40,
    });
    fireEvent.pointerUp(handle, { pointerId: 7 });

    expect(dialog.style.width).toBe("440px");
    expect(dialog.style.height).toBe("710px");
  });
});
