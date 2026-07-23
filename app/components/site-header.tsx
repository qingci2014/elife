import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="生活英语重启首页">
        <span className="brand-mark">E</span>
        <span><strong>生活英语重启</strong><small>Back in Practice</small></span>
      </Link>
      <nav aria-label="主导航">
        <Link href="/books/1">第一册</Link>
        <Link href="/books/2">第二册</Link>
        <Link href="/books/3">第三册</Link>
      </nav>
    </header>
  );
}
