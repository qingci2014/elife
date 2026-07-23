import Link from "next/link";
import { books, lessons } from "./generated/content";

export default function Home() {
  const availableCount = lessons.filter((lesson) => lesson.available).length;

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">EVERYDAY ENGLISH · BACK IN PRACTICE</p>
          <h1>不是重新学英语，<br />是把学过的英语重新用起来。</h1>
          <p className="hero-lead">
            一套为非零基础成年人编写的生活英语自学教材。每课一个真实任务，
            一段原创对话，一组真正能说出口的表达。
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/books/1">从第一册开始</Link>
            <Link className="button button-quiet" href="/lessons/01-long-time-no-see">阅读第1课</Link>
          </div>
        </div>
        <aside className="hero-note" aria-label="课程进度">
          <span className="note-label">当前书稿</span>
          <strong>{availableCount}<small> / 96课</small></strong>
          <p>已完成的课文可以直接进入独立页面学习；其余课次显示已冻结的课程目标。</p>
        </aside>
      </section>

      <section className="home-section" aria-labelledby="books-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THREE-BOOK PATH</p>
            <h2 id="books-heading">三册，一条连续的进阶路线</h2>
          </div>
          <p>从熟悉任务中的短交流，逐步走向较长表达、协商和观点说明。</p>
        </div>
        <div className="book-grid">
          {books.map((book) => {
            const ready = lessons.filter((lesson) => lesson.book === book.number && lesson.available).length;
            return (
              <Link className={`book-card book-${book.number}`} href={`/books/${book.number}`} key={book.number}>
                <span className="book-number">BOOK {book.number}</span>
                <h3>{book.title}</h3>
                <p className="book-level">{book.level}</p>
                <p>{book.promise}</p>
                <span className="book-progress">{ready} / 32课已完成 <b>查看目录 →</b></span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="method-strip" aria-label="每课结构">
        <div><span>01</span><strong>先理解</strong><p>原创对话与自然中文</p></div>
        <div><span>02</span><strong>再激活</strong><p>词块、语法与语音</p></div>
        <div><span>03</span><strong>真正用</strong><p>随机互动与个人输出</p></div>
        <div><span>04</span><strong>隔天取回</strong><p>答案、自查与复现</p></div>
      </section>
    </main>
  );
}
