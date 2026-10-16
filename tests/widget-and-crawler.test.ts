import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  approvedRedirectTarget,
  collapseRecurringCalendarOccurrences,
  extractWebsiteSource,
  isAllowedByRobots,
  isCalendarPaginationLink,
  isCrawlableUrl,
  parseApprovedRemovalUrls,
  parseRobotsTxt,
} from "../scripts/crawl-website";
import type { WebsiteSource } from "../src/lib/knowledge/types";

function calendarSource(
  overrides: Partial<WebsiteSource> & { canonicalUrl: string; title: string; text: string },
): WebsiteSource {
  return {
    id: `web-${overrides.canonicalUrl}`,
    fetchedAt: "2026-08-23T00:00:00.000Z",
    headings: [],
    links: [],
    sourceType: "official_website",
    ...overrides,
  };
}
import { isValidWidgetUrl } from "@/lib/widget/url-validation";
import { parseEmbedPresentation } from "@/lib/widget/presentation";

describe("widget and crawler boundaries", () => {
  it("validates widget URLs and requires HTTPS outside localhost", () => {
    expect(isValidWidgetUrl("https://prototype.vercel.app/embed")).toBe(true);
    expect(isValidWidgetUrl("http://localhost:3000/embed")).toBe(true);
    expect(isValidWidgetUrl("http://example.com/embed")).toBe(false);
    expect(isValidWidgetUrl("javascript:alert(1)")).toBe(false);
  });

  it("constrains embed options to an allowlist", () => {
    expect(
      parseEmbedPresentation({
        theme: "url(javascript:bad)",
        launcher: "anything",
        position: "center",
      }),
    ).toEqual({
      theme: "light",
      launcherVisible: false,
      position: "bottom-right",
    });
  });

  it("uses the local The Place logo in the framework-independent launcher", () => {
    const loader = readFileSync("public/widget-loader.js", "utf8");
    expect(loader).toContain("/branding/the-place-logo.png");
    expect(loader).toContain('logoImage.alt = ""');
    expect(loader).toContain("chatbotUrl.origin !== scriptUrl.origin");
    expect(loader).toContain('resizeButton.addEventListener("pointerdown"');
    expect(loader).toContain('resizeButton.addEventListener("keydown"');
    expect(loader).toContain(".tp-resize{display:none}");
    expect(loader).toContain('script.getAttribute("data-prompt")');
    expect(loader).toContain('script.getAttribute("data-prompt-text")');
    expect(loader).toContain('iframe.loading = "eager"');
    expect(loader).toContain("Loading The Place assistant");
    expect(loader).toContain('panel.setAttribute("data-ready", "true")');
    expect(loader).toContain('"the-place-chatbot:close"');
    expect(loader).toContain("event.source !== iframe.contentWindow");
    expect(loader).toContain("event.origin !== chatbotUrl.origin");
    expect(loader).toContain("the-place-chatbot-nudge-seen");
    expect(loader).toContain("nudgeText.textContent = promptText");
    expect(loader).toContain('nudgeAction.addEventListener("click"');
    expect(loader).toContain('nudgeClose.addEventListener("click"');
  });

  it("keeps the crawler on public The Place HTML routes", () => {
    expect(isCrawlableUrl("https://theplacega.org/food-pantry/?utm_source=x")).toBe(
      true,
    );
    expect(isCrawlableUrl("https://www.theplacega.org/wp-admin/")).toBe(false);
    expect(isCrawlableUrl("https://example.com/food-pantry")).toBe(false);
    expect(isCrawlableUrl("https://www.theplacega.org/brochure.pdf")).toBe(false);
  });

  it("keeps nested Food Pantry schedule details separated in extracted text", () => {
    const source = extractWebsiteSource(
      `<main>
        <h2>Food Pantry Hours and Location</h2>
        <section>
          <strong>FORSYTH</strong>
          <p><span>Tuesday-Thursday</span><br><span>9:00am-1:30pm</span></p>
          <address><span>2550 The Place Circle</span><span>Cumming, GA 30040</span></address>
        </section>
      </main>`,
      "https://www.theplacega.org/food-pantry",
      "2026-10-16T00:00:00.000Z",
    );

    expect(source?.text).toContain("Tuesday-Thursday");
    expect(source?.text).toContain("9:00am-1:30pm");
    expect(source?.text).toContain("2550 The Place Circle Cumming, GA 30040");
    expect(source?.text).not.toContain("1:30pmAddress2550");
  });

  it("accepts only redirects back to approved The Place hosts", () => {
    expect(
      approvedRedirectTarget(
        "https://theplacega.org/food-pantry",
        "/food-pantry/",
      ),
    ).toBe("https://www.theplacega.org/food-pantry");
    expect(() =>
      approvedRedirectTarget(
        "https://www.theplacega.org/contact-us",
        "https://127.0.0.1/admin",
      ),
    ).toThrow("outside The Place website");
  });

  it("honors robots allow rules over shorter disallow rules", () => {
    const rules = parseRobotsTxt(
      "User-agent: *\nDisallow: /private\nAllow: /private/public\n",
    );
    expect(
      isAllowedByRobots("https://www.theplacega.org/private/page", rules),
    ).toBe(false);
    expect(
      isAllowedByRobots("https://www.theplacega.org/private/public/info", rules),
    ).toBe(true);
  });

  it("stops following recurring calendar event Previous/Next chains", () => {
    expect(
      isCalendarPaginationLink(
        "https://www.theplacega.org/calendar/free-ged-classes-dh7mh-hc34f-5s5zj-mrzzh-fty3x-ntp9b",
        "Next\nNext\nOctober 5\nFree GED Classes",
      ),
    ).toBe(true);
    expect(
      isCalendarPaginationLink(
        "https://www.theplacega.org/calendar/free-ged-classes-dh7mh-hc34f-5s5zj-mrzzh-fty3x",
        "Previous\nPrevious\nSeptember 28\nFree GED Classes",
      ),
    ).toBe(true);
    expect(
      isCalendarPaginationLink(
        "https://www.theplacega.org/calendar/red-robin-dine-to-donate",
        "Red Robin Dine to Donate",
      ),
    ).toBe(false);
    expect(
      isCalendarPaginationLink("https://www.theplacega.org/calendar", "Back to All Events"),
    ).toBe(false);
    expect(
      isCalendarPaginationLink(
        "https://www.theplacega.org/next-steps",
        "Next",
      ),
    ).toBe(false);
  });

  it("collapses recurring calendar occurrences to the nearest upcoming date", () => {
    const now = new Date("2026-08-23T00:00:00Z");
    const sources = [
      calendarSource({
        canonicalUrl: "https://www.theplacega.org/calendar/free-ged-classes-a",
        title: "Free GED Classes — The Place",
        text: "Free GED Classes\nWednesday, August 12, 2026\n6:00 PM",
      }),
      calendarSource({
        canonicalUrl: "https://www.theplacega.org/calendar/free-ged-classes-b",
        title: "Free GED Classes — The Place",
        text: "Free GED Classes\nWednesday, September 2, 2026\n6:00 PM",
      }),
      calendarSource({
        canonicalUrl: "https://www.theplacega.org/calendar/free-ged-classes-c",
        title: "Free GED Classes — The Place",
        text: "Free GED Classes\nWednesday, August 26, 2026\n6:00 PM",
      }),
      calendarSource({
        canonicalUrl: "https://www.theplacega.org/calendar/red-robin-dine-to-donate",
        title: "Red Robin Dine to Donate — The Place",
        text: "Red Robin Dine to Donate\nThursday, October 1, 2026\n5:00 PM",
      }),
      calendarSource({
        canonicalUrl: "https://www.theplacega.org/staff",
        title: "Staff — The Place",
        text: "Non-calendar page content that should pass through untouched.",
      }),
    ];

    const collapsed = collapseRecurringCalendarOccurrences(sources, now);

    expect(collapsed).toHaveLength(3);
    expect(collapsed.map((source) => source.canonicalUrl).sort()).toEqual(
      [
        "https://www.theplacega.org/calendar/free-ged-classes-c",
        "https://www.theplacega.org/calendar/red-robin-dine-to-donate",
        "https://www.theplacega.org/staff",
      ].sort(),
    );
  });

  it("rejects malformed and duplicate removal approvals", () => {
    expect(() => parseApprovedRemovalUrls({ canonicalUrls: "not-an-array" })).toThrow(
      "canonicalUrls array",
    );
    expect(() =>
      parseApprovedRemovalUrls({
        canonicalUrls: [
          "https://www.theplacega.org/contact-us",
          "https://theplacega.org/contact-us/",
        ],
      }),
    ).toThrow("Duplicate approved removal");
  });
});
