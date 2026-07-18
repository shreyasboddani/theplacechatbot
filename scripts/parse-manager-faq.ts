import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { load } from "cheerio";
import mammoth from "mammoth";

import { canonicalizeThePlaceUrl } from "../src/lib/config";
import type { FaqEntry, FaqStatus } from "../src/lib/knowledge/types";

interface ParagraphRecord {
  text: string;
  links: string[];
}

interface FaqBlueprint {
  id: string;
  question: string;
  match: string;
  status?: FaqStatus;
  inlineAnswer?: (rawText: string) => string | undefined;
}

const pending: FaqStatus = "pending";

const FAQ_BLUEPRINTS: FaqBlueprint[] = [
  { id: "food-order-help", question: "I can't order my food. What should I do?", match: "i can't order my food" },
  { id: "food-pantry-donation-items", question: "Will you accept these items for the food pantry?", match: "will you accept these items (for food pantry)" },
  { id: "thrift-store-donation-items", question: "Will you accept these items for donation to the thrift store?", match: "will you accept these items for donation to the thrift store" },
  { id: "thrift-store-shopping-hours", question: "What are your thrift store shopping hours?", match: "what are your thrift store shopping hours" },
  { id: "thrift-store-donation-hours", question: "What are your thrift store donation hours?", match: "what are your thrift store donation hours" },
  { id: "where-to-donate-food", question: "Where can I donate food?", match: "where can i donate food" },
  { id: "current-food-needs", question: "What are your food needs?", match: "what are your food needs" },
  { id: "new-volunteer", question: "I want to volunteer. What do I do?", match: "i want to volunteer, what do i do" },
  { id: "community-service", question: "I need to do community service. What do I do?", match: "i need to do community service, what do i do" },
  { id: "financial-assistance", question: "I need help paying my bills. What should I do?", match: "i need help paying my bills" },
  { id: "food-assistance", question: "I need food. What should I do?", match: "i need food" },
  { id: "assistance-application-follow-up", question: "I filled out an application for help and haven't heard anything. What should I do?", match: "i filled out an application for help and haven't heard anything" },
  { id: "host-a-drive", question: "We are planning a drive. Will you take these items?", match: "we are planning a drive, will you take these items" },
  { id: "drive-types", question: "What kind of drive can we host?", match: "what kind of drive?" },
  { id: "group-volunteering", question: "My club or group wants to volunteer. Who do I contact?", match: "my club/group wants to volunteer, who do i contact" },
  { id: "direct-family-item-donation", question: "I have a specific item that I want to go directly to a family in need. What should I do?", match: "i have a specific item that i want to go directly to a family in need" },
  {
    id: "financial-assistance-documents",
    question: "Where do I send my documents for financial assistance?",
    match: "where do i send my documents for financial assistance",
    inlineAnswer: (text) => text.split("?").slice(1).join("?").replace(/^\s*answer\s*/i, "").trim() || undefined,
  },
  { id: "expired-shopper-id", question: "My shopper ID is expired. What do I do?", match: "my shopper id is expired, what do i do" },
  {
    id: "food-order-pickup-change",
    question: "I won't be able to pick up my food order. Who should I notify?",
    match: "i won't be able to pickup my food order",
    inlineAnswer: (text) => text.match(/\((.+)\)\s*$/)?.[1]?.trim(),
  },
  { id: "benefits-application-help", question: "I need help applying for food stamps or Medicaid. Who can help?", match: "i need help applying for food stamps, medicaid" },
  { id: "clothing-assistance", question: "I need help getting clothing. What should I do?", match: "i need help getting clothes" },
  { id: "senior-food-assistance", question: "I'm a senior and need help getting food. Who should I contact?", match: "i'm a senior and need help getting food" },
  { id: "furniture-delivery-fees", question: "What are your delivery fees for furniture?", match: "what are your delivery fees for furniture", status: pending },
  { id: "return-policy", question: "What is your return policy?", match: "what is your return policy", status: pending },
  { id: "fitting-rooms", question: "Does your store have fitting rooms?", match: "does your store have fitting rooms" },
  { id: "electronics-testing-outlets", question: "Are there outlets to test electronics?", match: "are there outlets to test electronics", status: pending },
  { id: "colored-clothing-barbs", question: "What do the colored barbs on the clothing mean?", match: "what do the colored barbs on the clothing mean", status: pending },
  { id: "price-negotiation", question: "Do you negotiate prices?", match: "do you negotiate prices", status: pending },
  { id: "clothing-exchanges", question: "Can I exchange my clothing for clothing in the store?", match: "can i exchange my clothing for clothing in the store", status: pending },
  { id: "office-hours", question: "What are your office hours?", match: "what are your office hours?" },
  { id: "diapers-and-formula", question: "Do you have diapers or formula?", match: "do you have diapers, formula?" },
  { id: "baby-item-donations", question: "Do you take baby item donations such as cribs or car seats?", match: "do you take baby item donations such as cribs, car seats" },
  { id: "free-car-seats", question: "Do you have free car seats?", match: "do you have free car seats?" },
];

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function paragraphsFromMammothHtml(html: string): ParagraphRecord[] {
  const $ = load(html, null, false);
  return $("p, li")
    .toArray()
    .map((element) => {
      const ownContent = $(element).clone();
      ownContent.find("ul, ol").remove();
      return {
        text: ownContent.text().replace(/\s+/g, " ").trim(),
        links: ownContent
        .find("a[href]")
        .toArray()
        .map((anchor) => $(anchor).attr("href")?.trim())
        .filter((href): href is string => Boolean(href)),
      };
    })
    .filter((paragraph) => paragraph.text.length > 0);
}

function findBlueprintIndex(text: string): number {
  const candidate = normalize(text);
  return FAQ_BLUEPRINTS.findIndex((blueprint) =>
    candidate.startsWith(normalize(blueprint.match)),
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function contactsFrom(records: ParagraphRecord[]): string[] {
  const values: string[] = [];
  for (const record of records) {
    for (const link of record.links) {
      if (link.toLowerCase().startsWith("mailto:")) {
        values.push(link.slice("mailto:".length).toLowerCase());
      }
    }
    values.push(
      ...(record.text.match(/[A-Z0-9._%+-]+@theplacega\.org/gi) ?? []).map(
        (email) => email.toLowerCase(),
      ),
    );
  }
  return unique(values);
}

function urlsFrom(records: ParagraphRecord[]): string[] {
  return unique(
    records.flatMap((record) =>
      record.links
        .map(canonicalizeThePlaceUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  );
}

export function parseFaqParagraphs(paragraphs: ParagraphRecord[]): FaqEntry[] {
  const boundaryByParagraph = new Map<number, number>();
  paragraphs.forEach((paragraph, index) => {
    const blueprintIndex = findBlueprintIndex(paragraph.text);
    if (blueprintIndex >= 0) boundaryByParagraph.set(index, blueprintIndex);
  });

  const entries: FaqEntry[] = [];
  const usedBlueprints = new Set<number>();
  const boundaries = [...boundaryByParagraph.keys()].sort((a, b) => a - b);
  for (let position = 0; position < boundaries.length; position += 1) {
    const paragraphIndex = boundaries[position];
    const blueprintIndex = boundaryByParagraph.get(paragraphIndex);
    if (blueprintIndex === undefined || usedBlueprints.has(blueprintIndex)) continue;
    usedBlueprints.add(blueprintIndex);

    const blueprint = FAQ_BLUEPRINTS[blueprintIndex];
    const nextBoundary = boundaries[position + 1] ?? paragraphs.length;
    const questionRecord = paragraphs[paragraphIndex];
    const answerRecords = paragraphs.slice(paragraphIndex + 1, nextBoundary);
    const inlineAnswer = blueprint.inlineAnswer?.(questionRecord.text);
    const answerParts = [inlineAnswer, ...answerRecords.map((item) => item.text)].filter(
      (value): value is string => Boolean(value && value.trim()),
    );
    const allRecords = [questionRecord, ...answerRecords];
    const requestedStatus = blueprint.status;
    const status: FaqStatus = requestedStatus
      ? requestedStatus
      : answerParts.length > 0
        ? "approved"
        : "needs_review";

    entries.push({
      id: blueprint.id,
      question: blueprint.question,
      answer: status === "approved" ? answerParts.join("\n") : "",
      status,
      contacts: contactsFrom(allRecords),
      relatedUrls: urlsFrom(allRecords),
      notes:
        status === "approved"
          ? []
          : ["No complete staff-approved answer was provided in the source document."],
      sourceType: "manager_faq",
    });
  }

  for (let index = 0; index < FAQ_BLUEPRINTS.length; index += 1) {
    if (usedBlueprints.has(index)) continue;
    const blueprint = FAQ_BLUEPRINTS[index];
    entries.push({
      id: blueprint.id,
      question: blueprint.question,
      answer: "",
      status: blueprint.status ?? "needs_review",
      contacts: [],
      relatedUrls: [],
      notes: ["The expected question could not be located in the source document."],
      sourceType: "manager_faq",
    });
  }

  return entries;
}

export async function readManagerFaqDocument(docxPath: string): Promise<FaqEntry[]> {
  const result = await mammoth.convertToHtml({ path: docxPath });
  return parseFaqParagraphs(paragraphsFromMammothHtml(result.value));
}

function entryMarkdown(entry: FaqEntry): string {
  const lines = [`## ${entry.question}`, "", `Status: ${entry.status}`];
  if (entry.answer) lines.push("", entry.answer);
  if (entry.contacts.length > 0) {
    lines.push("", `Verified contacts: ${entry.contacts.join(", ")}`);
  }
  if (entry.relatedUrls.length > 0) {
    lines.push("", "Related official pages:", ...entry.relatedUrls.map((url) => `- ${url}`));
  }
  if (entry.notes.length > 0) lines.push("", ...entry.notes.map((note) => `Note: ${note}`));
  return lines.join("\n");
}

export async function writeFaqOutputs(entries: FaqEntry[], outputDir: string) {
  await mkdir(outputDir, { recursive: true });
  const approved = entries.filter((entry) => entry.status === "approved");
  const unresolved = entries.filter((entry) => entry.status !== "approved");
  const header = "# The Place manager-provided FAQ\n\nGenerated from the staff-provided DOCX.\n";

  await Promise.all([
    writeFile(
      path.join(outputDir, "manager-faq.json"),
      `${JSON.stringify(entries, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      path.join(outputDir, "manager-faq-approved.md"),
      `${header}\n${approved.map(entryMarkdown).join("\n\n")}\n`,
      "utf8",
    ),
    writeFile(
      path.join(outputDir, "manager-faq-pending.md"),
      `${header}\n${unresolved.map(entryMarkdown).join("\n\n")}\n`,
      "utf8",
    ),
    writeFile(
      path.join(outputDir, "manager-faq-report.json"),
      `${JSON.stringify(
        {
          parsedAt: new Date().toISOString(),
          totalEntries: entries.length,
          approvedEntries: approved.map((entry) => entry.id),
          pendingEntries: unresolved.map((entry) => ({
            id: entry.id,
            question: entry.question,
            status: entry.status,
            notes: entry.notes,
          })),
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);
}

async function main() {
  const root = process.cwd();
  const docxPath = path.resolve(
    root,
    process.argv[2] || "knowledge/source/chatbot-questions.docx",
  );
  const outputDir = path.resolve(root, "knowledge/generated");
  const entries = await readManagerFaqDocument(docxPath);
  await writeFaqOutputs(entries, outputDir);

  const approved = entries.filter((entry) => entry.status === "approved").length;
  const unresolved = entries.length - approved;
  process.stdout.write(
    `Parsed ${entries.length} FAQ entries: ${approved} approved, ${unresolved} pending or needing review.\n`,
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown FAQ parsing error";
    process.stderr.write(`FAQ parsing failed: ${message}\n`);
    process.exitCode = 1;
  });
}
