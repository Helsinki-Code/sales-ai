import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getBlogIndexItems } from "@/lib/blog-content";

export const metadata: Metadata = {
  title: "Sales AI Blog | Developer GTM, BYOK, and Sales Automation Guides",
  description:
    "Long-form developer-first guides on sales automation APIs, BYOK architecture, async job workflows, and production security patterns.",
};

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

export default function BlogIndexPage() {
  const articles = getBlogIndexItems();

  return (
    <main>
      <section className="container hero hero-with-visual blog-index-hero">
        <div>
          <p className="eyebrow">Sales AI Editorial</p>
          <h1>Production-Grade Revenue Engineering Guides</h1>
          <p>
            Practical long-form documentation for teams shipping AI sales automation in real
            systems. Each post includes implementation detail, architectural context, and
            deploy-ready examples.
          </p>
        </div>
        <figure className="visual-panel">
          <Image
            src="/brand/blog-insights.svg"
            alt="Editorial analytics dashboard illustration for the Sales AI blog"
            width={900}
            height={620}
            priority
          />
        </figure>
      </section>

      <section className="container main-section blog-index-section">
        <div className="section-header-row blog-index-heading">
          <h2 className="section-title">Published Articles ({articles.length})</h2>
          <p className="muted">Markdown-native articles with technical depth and SEO metadata.</p>
        </div>

        <div className="blog-grid">
          {articles.map((article) => (
            <article key={article.slug} className="blog-card blog-card-rich">
              {article.heroImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={article.heroImage.src}
                  alt={article.heroImage.alt}
                  loading="lazy"
                  className="blog-card-image"
                />
              ) : null}

              <div className="blog-card-body">
                <div className="pill-row">
                  <span className="pill">{formatDate(article.publishedAt)}</span>
                  <span className="pill">{article.readingTimeMinutes} min read</span>
                  {article.keyword ? <span className="pill">{article.keyword}</span> : null}
                </div>
                <h3>{article.title}</h3>
                <p>{article.description}</p>
                <p className="muted small">Audience: {article.audience}</p>
                <Link className="text-link" href={`/blog/${article.slug}`}>
                  Read full article -&gt;
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
