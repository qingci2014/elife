import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { books, lessons } from "../../generated/content";

type PageProps = { params: Promise<{ book: string }> };

export function generateStaticParams() {
  return books.map((book) => ({ book: String(book.number) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { book: value } = await params;
  const book = books.find((entry) => entry.number === Number(value));
  return book ? { title: `第${book.number}册 ${book.title}` } : {};
}

export default async function BookPage({ params }: PageProps) {
  const { book: value } = await params;
  const book = books.find((entry) => entry.number === Number(value));
  if (!book) notFound();

  const bookLessons = lessons.filter((lesson) => lesson.book === book.number);
  const units = Array.from(new Map(bookLessons.map((lesson) => [lesson.unit, lesson.unitTitle])).entries());
  const ready = bookLessons.filter((lesson) => lesson.available).length;

  return (
    <main className="book-page">
      <header className={`book-hero book-${book.number}`}>
        <div>
          <p className="eyebrow">BOOK {book.number} · {book.level}</p>
          <h1>{book.title}</h1>
          <p>{book.promise}</p>
        </div>
        <div className="book-count"><strong>{ready}</strong><span>/ 32课已完成</span></div>
      </header>

      <div className="unit-list">
        {units.map(([unit, unitTitle]) => (
          <section className="unit" key={unit}>
            <div className="unit-title">
              <span>UNIT {unit}</span>
              <h2>{unitTitle}</h2>
            </div>
            <div className="lesson-list">
              {bookLessons.filter((lesson) => lesson.unit === unit).map((lesson) => (
                <Link className="lesson-row" href={`/lessons/${lesson.slug}`} key={lesson.number}>
                  <span className="lesson-index">{String(lesson.number).padStart(2, "0")}</span>
                  <span className="lesson-name"><strong>{lesson.title}</strong><small>{lesson.goal}</small></span>
                  <span className={`status ${lesson.available ? "ready" : "planned"}`}>
                    {lesson.available ? "可学习" : "已规划"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
