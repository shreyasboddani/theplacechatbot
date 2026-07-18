import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { load } from "cheerio";

import {
  canonicalizeThePlaceUrl,
  THE_PLACE,
} from "../src/lib/config";
import type { WebsiteSource } from "../src/lib/knowledge/types";

const USER_AGENT =
  "LearnAI-ThePlaceKnowledgeBot/1.0 (+https://www.theplacega.org; offline knowledge sync)";
const DEFAULT_MAX_PAGES = 120;
const REQUEST_TIMEOUT_MS = 15_000;
const REQUEST_DELAY_MS = 300;

const SEED_URLS = [
  "https://www.theplacega.org/",
  "https://www.theplacega.org/contact-us",
  "https://www.theplacega.org/food-pantry/",
  "https://www.theplacega.org/food-donations",
  "https://www.theplacega.org/thrift-store-donations/",
  "https://www.theplacega.org/financial-assistance",
  "https://www.theplacega.org/fin-asst-initial-request/",
  "https://www.theplacega.org/new-volunteers",
  "https://www.theplacega.org/food-pantry-request",
  "https://www.theplacega.org/senior-assistance",
  "https://www.theplacega.org/calendar",
];

const BLOCKED_PATH =
  /\/(?:wp-admin|wp-login|admin|login|logout|checkout|cart|account|search|feed|xmlrpc|wp-json)(?:\/|$)/i;
const BLOCKED_EXTENSION =
  /\.(?:avif|bmp|css|csv|docx?|eot|gif|ico|jpe?g|js|json|mp3|mp4|pdf|png|pptx?|svg|tiff?|txt|webm|webp|woff2?|xlsx?|xml)$/i;

interface RobotsRules {
  allows: string[];
  disallows: string[];
  sitemaps: string[];
}

interface CrawlFailure {
  url: string;
  reason: string;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function isCrawlableUrl(value: string): boolean {
  const canonical = canonicalizeThePlaceUrl(value);
  if (!canonical) return false;
  const url = new URL(canonical);
  return !BLOCKED_PATH.test(url.pathname) && !BLOCKED_EXTENSION.test(url.pathname);
}

export function parseRobotsTxt(value: string): RobotsRules {
  const rules: RobotsRules = { allows: [], disallows: [], sitemaps: [] };
  let applies = false;
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const content = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      const agent = content.toLowerCase();
      applies = agent === "*" || USER_AGENT.toLowerCase().includes(agent);
    } else if (key === "allow" && applies && content) {
      rules.allows.push(content);
    } else if (key === "disallow" && applies && content) {
      rules.disallows.push(content);
    } else if (key === "sitemap" && content) {
      rules.sitemaps.push(content);
    }
  }
  return rules;
}

export function isAllowedByRobots(url: string, rules: RobotsRules): boolean {
  const pathname = new URL(url).pathname;
  const matchingAllow = rules.allows
    .filter((rule) => pathname.startsWith(rule))
    .sort((a, b) => b.length - a.length)[0];
  const matchingDisallow = rules.disallows
    .filter((rule) => pathname.startsWith(rule))
    .sort((a, b) => b.length - a.length)[0];
  if (!matchingDisallow) return true;
  return Boolean(matchingAllow && matchingAllow.length >= matchingDisallow.length);
}

export function sourceIdForUrl(url: string): string {
  const parsed = new URL(url);
  const slug =
    parsed.pathname
      .split("/")
      .filter(Boolean)
      .join("-")
      .replace(/[^a-z0-9-]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "home";
  const suffix = createHash("sha256").update(url).digest("hex").slice(0, 8);
  return `web-${slug}-${suffix}`;
}

function normalizedText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractWebsiteSource(
  html: string,
  requestedUrl: string,
  fetchedAt: string,
): WebsiteSource | undefined {
  const $ = load(html);
  const requestedCanonical = canonicalizeThePlaceUrl(requestedUrl);
  if (!requestedCanonical) return undefined;
  const declaredCanonical = $("link[rel='canonical']").attr("href");
  const canonicalUrl =
    (declaredCanonical && canonicalizeThePlaceUrl(declaredCanonical)) ||
    requestedCanonical;

  $(
    "script, style, noscript, template, iframe, svg, canvas, nav, footer, header, form, [aria-hidden='true'], .cookie, .cookies, .newsletter, .social-share",
  ).remove();

  const root = $("main").first().length
    ? $("main").first()
    : $("article").first().length
      ? $("article").first()
      : $("body").first();
  const title = normalizedText(
    $("meta[property='og:title']").attr("content") ||
      $("title").text() ||
      root.find("h1").first().text() ||
      "The Place",
  );
  const headings = root
    .find("h1, h2, h3")
    .toArray()
    .map((element) => normalizedText($(element).text()))
    .filter(Boolean)
    .slice(0, 40);

  const links = root
    .find("a[href]")
    .toArray()
    .flatMap((anchor) => {
      const href = $(anchor).attr("href");
      if (!href) return [];
      let absolute: string;
      try {
        absolute = new URL(href, canonicalUrl).toString();
      } catch {
        return [];
      }
      const url = canonicalizeThePlaceUrl(absolute);
      if (!url) return [];
      const label = normalizedText($(anchor).text());
      return [{ label: label || url, url }];
    })
    .filter(
      (link, index, values) =>
        values.findIndex(
          (candidate) => candidate.url === link.url && candidate.label === link.label,
        ) === index,
    )
    .slice(0, 100);

  const blocks = root
    .find("h1, h2, h3, h4, p, li, dt, dd, address")
    .toArray()
    .map((element) => normalizedText($(element).text()))
    .filter((text) => text.length > 1);
  const text = normalizedText(blocks.join("\n"));
  if (text.length < 80) return undefined;

  return {
    id: sourceIdForUrl(canonicalUrl),
    title,
    canonicalUrl,
    fetchedAt,
    text,
    headings,
    links,
    sourceType: "official_website",
  };
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.5",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      if (response.ok || response.status < 500) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error: unknown) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt === 0) await sleep(500);
  }
  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

async function discoverSitemapUrls(
  initialSitemaps: string[],
  maxCandidates: number,
): Promise<string[]> {
  const sitemapQueue = initialSitemaps;
  const visitedSitemaps = new Set<string>();
  const pageUrls = new Set<string>();

  while (
    sitemapQueue.length > 0 &&
    visitedSitemaps.size < 12 &&
    pageUrls.size < maxCandidates
  ) {
    const sitemapUrl = sitemapQueue.shift();
    if (!sitemapUrl || visitedSitemaps.has(sitemapUrl)) continue;
    visitedSitemaps.add(sitemapUrl);
    try {
      const response = await fetchWithRetry(sitemapUrl);
      if (!response.ok) continue;
      const xml = await response.text();
      const $ = load(xml, { xmlMode: true });
      const locations = $("loc")
        .toArray()
        .map((element) => $(element).text().trim())
        .filter(Boolean);
      if ($("sitemapindex").length > 0) {
        sitemapQueue.push(
          ...locations.filter((url) => canonicalizeThePlaceUrl(url) !== undefined),
        );
      } else {
        for (const url of locations) {
          const canonical = canonicalizeThePlaceUrl(url);
          if (canonical && isCrawlableUrl(canonical)) pageUrls.add(canonical);
          if (pageUrls.size >= maxCandidates) break;
        }
      }
    } catch {
      // Sitemap discovery is optional; the same-origin link crawl continues.
    }
    await sleep(REQUEST_DELAY_MS);
  }
  return [...pageUrls];
}

function pageMarkdown(source: WebsiteSource): string {
  const links = source.links
    .map((link) => `- ${link.label}: ${link.url}`)
    .join("\n");
  return [
    `# ${source.title}`,
    "",
    `Source ID: ${source.id}`,
    `Source type: ${source.sourceType}`,
    `Canonical URL: ${source.canonicalUrl}`,
    `Fetched at: ${source.fetchedAt}`,
    "",
    "## Page content",
    "",
    source.text,
    ...(links ? ["", "## Relevant links", "", links] : []),
    "",
  ].join("\n");
}

export async function crawlWebsite(maxPages = DEFAULT_MAX_PAGES) {
  const robotsUrl = `${THE_PLACE.canonicalOrigin}/robots.txt`;
  let robots: RobotsRules = { allows: [], disallows: [], sitemaps: [] };
  try {
    const robotsResponse = await fetchWithRetry(robotsUrl);
    if (robotsResponse.ok) robots = parseRobotsTxt(await robotsResponse.text());
  } catch {
    // An unavailable robots file is treated as allowing public pages.
  }

  const sitemapSeeds = [
    ...robots.sitemaps,
    `${THE_PLACE.canonicalOrigin}/sitemap.xml`,
    `${THE_PLACE.canonicalOrigin}/wp-sitemap.xml`,
    `${THE_PLACE.canonicalOrigin}/sitemap_index.xml`,
  ].filter((value, index, values) => values.indexOf(value) === index);
  const sitemapUrls = await discoverSitemapUrls(sitemapSeeds, maxPages * 3);
  const queue = [...SEED_URLS, ...sitemapUrls]
    .map(canonicalizeThePlaceUrl)
    .filter((url): url is string => Boolean(url));
  const visited = new Set<string>();
  const queued = new Set(queue);
  const contentHashes = new Map<string, string>();
  const sources: WebsiteSource[] = [];
  const failedPages: CrawlFailure[] = [];
  const duplicatePages: Array<{ url: string; duplicateOf: string }> = [];
  const blockedPages: string[] = [];

  while (queue.length > 0 && sources.length < maxPages) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    if (!isCrawlableUrl(current) || !isAllowedByRobots(current, robots)) {
      blockedPages.push(current);
      continue;
    }

    try {
      const response = await fetchWithRetry(current);
      if (!response.ok) {
        failedPages.push({ url: current, reason: `HTTP ${response.status}` });
        continue;
      }
      const contentType = response.headers.get("content-type")?.toLowerCase() || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        failedPages.push({ url: current, reason: `Unsupported content type: ${contentType || "unknown"}` });
        continue;
      }
      const finalUrl = canonicalizeThePlaceUrl(response.url) || current;
      const source = extractWebsiteSource(
        await response.text(),
        finalUrl,
        new Date().toISOString(),
      );
      if (!source) {
        failedPages.push({ url: current, reason: "No meaningful public page content found" });
        continue;
      }

      const hash = createHash("sha256").update(source.text).digest("hex");
      const duplicateOf = contentHashes.get(hash);
      if (duplicateOf) {
        duplicatePages.push({ url: source.canonicalUrl, duplicateOf });
      } else {
        contentHashes.set(hash, source.canonicalUrl);
        sources.push(source);
      }

      for (const link of source.links) {
        if (
          !queued.has(link.url) &&
          !visited.has(link.url) &&
          isCrawlableUrl(link.url)
        ) {
          queued.add(link.url);
          queue.push(link.url);
        }
      }
    } catch (error: unknown) {
      failedPages.push({
        url: current,
        reason: error instanceof Error ? error.message : "Request failed",
      });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  return {
    sources,
    report: {
      startedFrom: THE_PLACE.canonicalOrigin,
      crawledAt: new Date().toISOString(),
      maxPages,
      indexedPages: sources.map((source) => ({
        id: source.id,
        title: source.title,
        url: source.canonicalUrl,
        fetchedAt: source.fetchedAt,
      })),
      failedPages,
      duplicatePages,
      blockedPages,
      totalIndexed: sources.length,
    },
  };
}

async function main() {
  const maxArgument = process.argv.find((argument) => argument.startsWith("--max-pages="));
  const requestedMax = maxArgument
    ? Number(maxArgument.slice("--max-pages=".length))
    : DEFAULT_MAX_PAGES;
  const maxPages = Number.isFinite(requestedMax)
    ? Math.min(150, Math.max(1, Math.floor(requestedMax)))
    : DEFAULT_MAX_PAGES;
  const root = process.cwd();
  const outputDir = path.resolve(root, "knowledge/generated");
  const websiteDir = path.join(outputDir, "website");
  const { sources, report } = await crawlWebsite(maxPages);

  await rm(websiteDir, { recursive: true, force: true });
  await mkdir(websiteDir, { recursive: true });
  await Promise.all(
    sources.map((source) =>
      writeFile(
        path.join(websiteDir, `${source.id}.md`),
        pageMarkdown(source),
        "utf8",
      ),
    ),
  );
  await Promise.all([
    writeFile(
      path.join(outputDir, "crawl-data.json"),
      `${JSON.stringify(sources, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      path.join(outputDir, "crawl-report.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    ),
  ]);
  process.stdout.write(
    `Indexed ${sources.length} public HTML pages from ${THE_PLACE.canonicalOrigin}.\n`,
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown crawl error";
    process.stderr.write(`Website crawl failed: ${message}\n`);
    process.exitCode = 1;
  });
}

