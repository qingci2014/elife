import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDir, "..");
const manuscriptRoot = path.resolve(siteRoot, "..");
const mapPath = path.join(manuscriptRoot, "curriculum-map.md");
const biblePath = path.join(manuscriptRoot, "series-bible.md");
const lessonsRoot = path.join(manuscriptRoot, "lessons");
const outputPath = path.join(siteRoot, "app", "generated", "content.ts");

const numberWords = { 一: 1, 二: 2, 三: 3 };

function slugify(title, number) {
  const words = title
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${String(number).padStart(2, "0")}-${words}`;
}

async function listMarkdownFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listMarkdownFiles(fullPath));
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(fullPath);
  }
  return files;
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function splitLessonMarkdown(raw) {
  const parts = raw.split(/^##\s+/m);
  const intro = parts.shift() ?? "";
  return {
    introHtml: marked.parse(intro, { gfm: true }),
    sections: parts.map((part, index) => {
      const newline = part.indexOf("\n");
      const title = (newline === -1 ? part : part.slice(0, newline)).trim();
      const body = newline === -1 ? "" : part.slice(newline + 1);
      return {
        id: `section-${index + 1}`,
        title,
        html: marked.parse(body, { gfm: true }),
      };
    }),
  };
}

const manuscriptAvailable = (await Promise.all([
  pathExists(mapPath),
  pathExists(biblePath),
  pathExists(lessonsRoot),
])).every(Boolean);

if (!manuscriptAvailable) {
  if (await pathExists(outputPath)) {
    console.log("Manuscript sources are unavailable; using the committed generated content snapshot.");
    process.exit(0);
  }
  throw new Error("Manuscript sources and app/generated/content.ts are both unavailable.");
}

const [mapText, bibleText] = await Promise.all([
  fs.readFile(mapPath, "utf8"),
  fs.readFile(biblePath, "utf8"),
]);
const bookDetails = [];

for (const line of bibleText.split(/\r?\n/)) {
  const row = line.match(
    /^\| 第([一二三])册《([^》]+)》 \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \|$/,
  );
  if (!row) continue;
  const number = numberWords[row[1]];
  bookDetails.push({
    number,
    title: row[2].trim(),
    level: row[4].trim().split("；")[0],
    promise: row[5].trim(),
  });
}

if (bookDetails.length !== 3 || bookDetails.some((book, index) => book.number !== index + 1)) {
  throw new Error("series-bible.md must contain one ordered CEFR summary row for each of the three books.");
}

const lessonFiles = await listMarkdownFiles(lessonsRoot);
const lessonFilesByNumber = new Map();

for (const file of lessonFiles) {
  const match = path.basename(file).match(/^lesson-(\d{2})-.+\.md$/);
  if (!match) {
    throw new Error(`Lesson source has an invalid filename: ${path.relative(manuscriptRoot, file)}`);
  }

  const number = Number(match[1]);
  if (lessonFilesByNumber.has(number)) {
    throw new Error(`More than one Markdown source claims Lesson ${number}.`);
  }
  lessonFilesByNumber.set(number, file);
}

let currentBook = 0;
let currentUnit = 0;
let currentUnitTitle = "";
const lessons = [];
const usedLessonFiles = new Set();

for (const line of mapText.split(/\r?\n/)) {
  const bookMatch = line.match(/^## 第([一二三])册《(.+)》/);
  if (bookMatch) {
    currentBook = numberWords[bookMatch[1]];
    continue;
  }
  const unitMatch = line.match(/^### Unit (\d+)\s+(.+)/);
  if (unitMatch) {
    currentUnit = Number(unitMatch[1]);
    currentUnitTitle = unitMatch[2].trim();
    continue;
  }
  const row = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
  if (!row || currentBook === 0) continue;

  const number = Number(row[1]);
  const title = row[2].trim();
  const slug = slugify(title, number);
  const file = lessonFilesByNumber.get(number);
  let available = false;
  let content = { introHtml: "", sections: [] };
  if (file) {
    const raw = await fs.readFile(file, "utf8");
    const heading = raw.match(/^# Lesson (\d+) — (.+)$/m);
    if (!heading || Number(heading[1]) !== number || heading[2].trim() !== title) {
      throw new Error(
        `${path.relative(manuscriptRoot, file)} must begin with "# Lesson ${number} — ${title}".`,
      );
    }

    const statusMatches = [...raw.matchAll(/<!--\s*lesson-status:\s*(draft|complete)\s*-->/gi)];
    if (statusMatches.length !== 1) {
      throw new Error(
        `${path.relative(manuscriptRoot, file)} must declare exactly one <!-- lesson-status: draft|complete --> marker.`,
      );
    }
    const statusMatch = statusMatches[0];

    available = statusMatch[1].toLowerCase() === "complete";
    if (available) {
      content = splitLessonMarkdown(raw.replace(statusMatch[0], ""));
      const sectionNumbers = content.sections.map((section) => {
        const match = section.title.match(/^(\d+)\./);
        return match ? Number(match[1]) : null;
      });
      // Translation migration is published four lessons at a time. During the
      // migration, legacy lessons have ten sections and migrated lessons have
      // the final eleven-section structure. Once all 96 lessons are migrated,
      // this compatibility branch is removed and eleven becomes mandatory.
      const sectionCountIsSupported = content.sections.length === 10 || content.sections.length === 11;
      const expectedSections = Array.from({ length: content.sections.length }, (_, index) => index + 1);
      const migratedHeadingsAreValid =
        content.sections.length !== 11 ||
        (content.sections[2]?.title === "3. 中文译文" &&
          content.sections[3]?.title === "4. Read, Notice, Understand");
      if (
        !sectionCountIsSupported ||
        sectionNumbers.some((value, index) => value !== expectedSections[index]) ||
        !migratedHeadingsAreValid
      ) {
        throw new Error(
          `${path.relative(manuscriptRoot, file)} is marked complete but does not contain a supported numbered H2 sequence. Eleven-section lessons must use 3. 中文译文 and 4. Read, Notice, Understand.`,
        );
      }
    }
    usedLessonFiles.add(file);
  }

  lessons.push({
    number,
    slug,
    title,
    book: currentBook,
    unit: currentUnit,
    unitTitle: currentUnitTitle,
    goal: row[3].trim(),
    language: row[4].trim(),
    evidence: row[5].trim(),
    available,
    ...content,
  });
}

if (lessons.length !== 96) {
  throw new Error(`Expected 96 lessons in curriculum-map.md, found ${lessons.length}.`);
}

const expectedNumbers = Array.from({ length: 96 }, (_, index) => index + 1);
if (lessons.some((lesson, index) => lesson.number !== expectedNumbers[index])) {
  throw new Error("Lesson numbers in curriculum-map.md must run once, in order, from 1 through 96.");
}

if (new Set(lessons.map((lesson) => lesson.slug)).size !== lessons.length) {
  throw new Error("Two curriculum entries generated the same lesson URL slug.");
}

const unusedLessonFiles = lessonFiles.filter((file) => !usedLessonFiles.has(file));
if (unusedLessonFiles.length > 0) {
  throw new Error(
    `Lesson Markdown is not represented in curriculum-map.md: ${unusedLessonFiles
      .map((file) => path.relative(manuscriptRoot, file))
      .join(", ")}`,
  );
}

const source = `// Generated by scripts/generate-content.mjs. Do not edit directly.\n\n` +
`export type LessonSection = { id: string; title: string; html: string };\n` +
`export type Lesson = { number: number; slug: string; title: string; book: number; unit: number; unitTitle: string; goal: string; language: string; evidence: string; available: boolean; introHtml: string; sections: LessonSection[] };\n` +
`export type Book = { number: number; title: string; level: string; promise: string };\n\n` +
`export const books: Book[] = ${JSON.stringify(bookDetails, null, 2)};\n\n` +
`export const lessons: Lesson[] = ${JSON.stringify(lessons, null, 2)};\n`;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, source, "utf8");
console.log(`Generated ${lessons.length} lesson routes (${lessons.filter((lesson) => lesson.available).length} with full content).`);
