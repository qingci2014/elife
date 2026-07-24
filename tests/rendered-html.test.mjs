import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

async function generatedLessons() {
  const source = await readFile(new URL("../app/generated/content.ts", import.meta.url), "utf8");
  const marker = "export const lessons: Lesson[] = ";
  const start = source.indexOf(marker);
  assert.ok(start >= 0, "generated lesson data should exist");
  return JSON.parse(source.slice(start + marker.length).trim().replace(/;$/, ""));
}

async function render(pathname) {
  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function htmlFor(pathname) {
  const response = await render(pathname);
  assert.equal(response.status, 200, `${pathname} should render successfully`);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  return response.text();
}

test("renders the textbook home page and three-book navigation", async () => {
  const html = await htmlFor("/");

  assert.match(html, /<title>生活英语重启<\/title>/);
  assert.match(html, /不是重新学英语/);
  assert.match(html, /三册，一条连续的进阶路线/);
  assert.match(html, /href="\/books\/1"/);
  assert.match(html, /href="\/books\/2"/);
  assert.match(html, /href="\/books\/3"/);
});

test("renders a book directory with independent lesson links", async () => {
  const html = await htmlFor("/books/1");

  assert.match(html, /<title>第1册 重新开口｜生活英语重启<\/title>/);
  assert.match(html, /class="unit-title"><span>UNIT/);
  assert.match(html, /href="\/lessons\/01-long-time-no-see"/);
  assert.match(html, /Long Time No See/);
  assert.match(html, /可学习/);
});

test("renders a completed lesson with contents, answers, and navigation", async () => {
  const html = await htmlFor("/lessons/01-long-time-no-see");

  assert.match(html, /Lesson 1 — Long Time No See/);
  assert.match(html, /本课目录/);
  assert.match(html, /完整课文/);
  assert.match(html, /<details[^>]*class="answer-section"/);
  assert.match(html, /href="\/lessons\/02-what-have-you-been-up-to"/);
});

test("serves all 96 lesson routes and lists 32 lessons in each book", async () => {
  const lessons = await generatedLessons();
  assert.equal(lessons.length, 96);
  assert.equal(new Set(lessons.map((lesson) => lesson.slug)).size, 96);

  for (const book of [1, 2, 3]) {
    const html = await htmlFor(`/books/${book}`);
    const linkedSlugs = new Set(
      [...html.matchAll(/href="\/lessons\/([^"]+)"/g)].map((match) => match[1]),
    );
    const expectedSlugs = lessons
      .filter((lesson) => lesson.book === book)
      .map((lesson) => lesson.slug);
    assert.equal(expectedSlugs.length, 32);
    for (const slug of expectedSlugs) {
      assert.ok(linkedSlugs.has(slug), `Book ${book} should link to ${slug}`);
    }
  }

  const responses = await Promise.all(
    lessons.map((lesson) => render(`/lessons/${lesson.slug}`)),
  );
  responses.forEach((response, index) => {
    assert.equal(response.status, 200, `/lessons/${lessons[index].slug} should render`);
  });
});

test("renders unwritten lessons as honest plan pages", async (t) => {
  const plannedLesson = (await generatedLessons()).find((lesson) => !lesson.available);
  if (!plannedLesson) {
    t.skip("All 96 lessons now have complete source manuscripts.");
    return;
  }

  const html = await htmlFor(`/lessons/${plannedLesson.slug}`);

  assert.match(html, new RegExp(`Lesson ${plannedLesson.number} —`));
  assert.match(html, /内容编写中/);
  assert.match(html, /这节课已经规划，但正文尚未写入/);
  assert.match(html, /现实任务/);
  assert.match(html, /语言骨架/);
  assert.match(html, /最终证据/);
});

test("ships shared-WAV segment manifests for all published lessons", async () => {
  for (let number = 1; number <= 76; number += 1) {
    const book = Math.ceil(number / 32);
    const audioRoot = new URL(`../public/audio/book-${String(book).padStart(2, "0")}/`, import.meta.url);
    const lesson = `lesson-${String(number).padStart(2, "0")}`;
    const manifest = JSON.parse(await readFile(new URL(`${lesson}/manifest.json`, audioRoot), "utf8"));
    const dialogue = await stat(new URL(`${lesson}/dialogue.wav`, audioRoot));
    const dialogueDuration = (dialogue.size - 44) / (manifest.sampleRate * 2);

    assert.equal(manifest.formatVersion, 2, `${lesson} should use segment manifests`);
    assert.ok(manifest.lines.length > 0, `${lesson} should include line segment metadata`);
    assert.ok(dialogue.size > 44, `${lesson} should include a non-empty WAV dialogue`);
    let previousEnd = 0;
    for (const line of manifest.lines) {
      assert.equal(typeof line.start, "number", `${lesson} line ${line.id} should include a start time`);
      assert.equal(typeof line.end, "number", `${lesson} line ${line.id} should include an end time`);
      assert.ok(line.start >= previousEnd, `${lesson} line ${line.id} should not overlap the previous line`);
      assert.ok(line.end > line.start, `${lesson} line ${line.id} should have a positive segment`);
      assert.ok(Math.abs(line.end - line.start - line.duration) < 0.002, `${lesson} line ${line.id} duration should match its segment`);
      assert.equal(line.src, undefined, `${lesson} line ${line.id} should not duplicate the dialogue WAV`);
      previousEnd = line.end;
    }
    assert.ok(previousEnd <= dialogueDuration, `${lesson} final segment should stay within dialogue.wav`);
  }

  const audioRoot = new URL("../public/audio/book-03/", import.meta.url);
  const lesson76 = JSON.parse(await readFile(new URL("lesson-76/manifest.json", audioRoot), "utf8"));
  assert.equal(lesson76.transfer?.speaker, "Carla");
  assert.equal(lesson76.voiceMap?.Carla, "af_nicole");
  assert.equal(lesson76.transfer?.src, "/audio/book-03/lesson-76/transfer.wav");
  assert.ok((await readFile(new URL("lesson-76/transfer.wav", audioRoot))).length > 44);
});

test("does not ship MP3 files", async () => {
  const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
  const pending = [publicRoot];
  const mp3Files = [];

  while (pending.length) {
    const directory = pending.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(target);
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".mp3")) mp3Files.push(target);
    }
  }

  assert.deepEqual(mp3Files, []);
});
