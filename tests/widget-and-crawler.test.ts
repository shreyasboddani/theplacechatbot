import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  isAllowedByRobots,
  isCrawlableUrl,
  parseRobotsTxt,
} from "../scripts/crawl-website";
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
  });

  it("keeps the crawler on public The Place HTML routes", () => {
    expect(isCrawlableUrl("https://theplacega.org/food-pantry/?utm_source=x")).toBe(
      true,
    );
    expect(isCrawlableUrl("https://www.theplacega.org/wp-admin/")).toBe(false);
    expect(isCrawlableUrl("https://example.com/food-pantry")).toBe(false);
    expect(isCrawlableUrl("https://www.theplacega.org/brochure.pdf")).toBe(false);
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
});
