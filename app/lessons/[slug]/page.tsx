import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lessons } from "../../generated/content";
import { LessonAudioPlayer } from "../../components/lesson-audio-player";

type PageProps = { params: Promise<{ slug: string }> };
const audioLessons = new Set(Array.from({ length: 40 }, (_, index) => index + 1));

export function generateStaticParams() {
  return lessons.map((lesson) => ({ slug: lesson.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const lesson = lessons.find((entry) => entry.slug === slug);
  return lesson ? { title: `Lesson ${lesson.number} — ${lesson.title}` } : {};
}

export default async function LessonPage({ params }: PageProps) {
  const { slug } = await params;
  const lesson = lessons.find((entry) => entry.slug === slug);
  if (!lesson) notFound();

  const previous = lessons.find((entry) => entry.number === lesson.number - 1);
  const next = lessons.find((entry) => entry.number === lesson.number + 1);

  return (
    <main className="lesson-page">
      <div className="breadcrumbs">
        <Link href="/">首页</Link><span>/</span>
        <Link href={`/books/${lesson.book}`}>第{lesson.book}册</Link><span>/</span>
        <span>Lesson {lesson.number}</span>
      </div>

      <header className="lesson-hero">
        <div>
          <p className="eyebrow">BOOK {lesson.book} · UNIT {lesson.unit}</p>
          <h1>Lesson {lesson.number} — {lesson.title}</h1>
          <p className="lesson-goal">{lesson.goal}</p>
        </div>
        <span className={`status large ${lesson.available ? "ready" : "planned"}`}>
          {lesson.available ? "完整课文" : "内容编写中"}
        </span>
      </header>

      {lesson.available ? (
        <div className="lesson-shell">
          <aside className="lesson-toc" aria-label="本课目录">
            <strong>本课目录</strong>
            {lesson.sections.map((section) => (
              <a href={`#${section.id}`} key={section.id}>{section.title}</a>
            ))}
          </aside>
          <article className="lesson-article">
            {audioLessons.has(lesson.number) ? <LessonAudioPlayer key={`${lesson.book}-${lesson.number}`} lessonNumber={lesson.number} bookNumber={lesson.book} /> : null}
            <div className="lesson-intro" dangerouslySetInnerHTML={{ __html: lesson.introHtml }} />
            {lesson.sections.map((section) => {
              const isAnswer = /Answer Key|参考答案|答案/.test(section.title);
              if (isAnswer) {
                return (
                  <details className="answer-section" id={section.id} key={section.id}>
                    <summary>{section.title}<span>点击展开</span></summary>
                    <div className="markdown-body" dangerouslySetInnerHTML={{ __html: section.html }} />
                  </details>
                );
              }
              return (
                <section className="lesson-section" id={section.id} key={section.id}>
                  <h2>{section.title}</h2>
                  <div className="markdown-body" dangerouslySetInnerHTML={{ __html: section.html }} />
                </section>
              );
            })}
          </article>
        </div>
      ) : (
        <section className="planned-lesson">
          <p className="eyebrow">FROZEN IN THE MASTER PLAN</p>
          <h2>这节课已经规划，但正文尚未写入。</h2>
          <dl>
            <div><dt>现实任务</dt><dd>{lesson.goal}</dd></div>
            <div><dt>语言骨架</dt><dd>{lesson.language}</dd></div>
            <div><dt>最终证据</dt><dd>{lesson.evidence}</dd></div>
          </dl>
        </section>
      )}

      <nav className="lesson-pagination" aria-label="课次导航">
        {previous ? <Link href={`/lessons/${previous.slug}`}>← 第{previous.number}课<br /><strong>{previous.title}</strong></Link> : <span />}
        {next ? <Link className="next" href={`/lessons/${next.slug}`}>第{next.number}课 →<br /><strong>{next.title}</strong></Link> : <span />}
      </nav>
    </main>
  );
}
