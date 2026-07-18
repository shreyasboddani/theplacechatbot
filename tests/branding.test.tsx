import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "@/app/page";
import {
  LearnAILogo,
  ThePlaceLogo,
} from "@/components/branding/BrandLogos";
import { ChatPanel } from "@/components/chatbot/ChatPanel";

afterEach(cleanup);

function imageSource(image: HTMLImageElement): string {
  return `${image.getAttribute("src") || ""} ${image.getAttribute("srcset") || ""}`;
}

describe("product branding", () => {
  it("uses the supplied The Place and LearnAI image assets", () => {
    render(
      <>
        <ThePlaceLogo />
        <LearnAILogo />
      </>,
    );
    expect(
      imageSource(screen.getByAltText("The Place") as HTMLImageElement),
    ).toContain("branding%2Fthe-place-logo.png");
    expect(
      imageSource(screen.getByAltText("LearnAI") as HTMLImageElement),
    ).toContain("branding%2Flearnai-logo.png");
  });

  it("brands the standalone page as The Place and includes LearnAI attribution marks", () => {
    const { container } = render(<Home />);
    const sources = [...container.querySelectorAll("img")].map(imageSource);
    expect(
      sources.filter((source) => source.includes("the-place-logo.png")).length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      sources.filter((source) => source.includes("learnai-logo.png")).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("shows The Place branding and the LearnAI mark inside the chat panel", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    const { container } = render(
      <ChatPanel onMinimize={vi.fn()} onClose={vi.fn()} />,
    );
    const sources = [...container.querySelectorAll("img")].map(imageSource);
    expect(
      sources.some((source) => source.includes("the-place-logo.png")),
    ).toBe(true);
    expect(
      sources.some((source) => source.includes("learnai-logo.png")),
    ).toBe(true);
  });
});
