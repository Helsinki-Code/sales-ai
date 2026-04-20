import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { blogArticles } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Sales AI Blog | Developer GTM, BYOK, and Sales Automation Guides",
  description:
    "Actionable developer-first articles on sales automation APIs, BYOK architecture, async workflows, and production security patterns.",
};

export default function BlogIndexPage() {
  return (
    <main>
      <section className="container hero hero-with-visual">
        <div>
          <p className="eyebrow">Sales AI Blog</p>
          <h1>SEO-Driven Articles For Builders Shipping Revenue Workflows</h1>
          <p>
            Every article in this library is generated from your strategy sheet and aligned to
            high-intent GTM keywords. Use them for organic growth, technical onboarding, and sales
            enablement.
          </p>
        </div>
        <figure className="visual-panel">
          <Image
            src="/brand/blog-insights.svg"
            alt="Minimal analytics illustration showing content strategy insights and organic growth trends"
            width={900}
            height={620}
            priority
          />
        </figure>
      </section>

      <section className="container main-section">
        <div className="section-header-row">
          <h2 className="section-title">Article Library ({blogArticles.length})</h2>
          <p className="muted">Sorted by strategic opportunity score and search intent value.</p>
        </div>

        <div className="blog-grid">
          {blogArticles.map((article) => (
            <article key={article.slug} className="blog-card">
              <Image
                src={article.heroImage}
                alt={`Brand illustration for ${article.keyword} article`}
                width={900}
                height={620}
              />
              <div className="blog-card-body">
                <div className="pill-row">
                  <span className="pill">KD {article.kd}</span>
                  <span className="pill">Vol {article.volume}</span>
                  <span className="pill">Score {article.opportunityScore}/10</span>
                </div>
                <h3>{article.title}</h3>
                <p>{article.description}</p>
                <p className="muted small">{article.category}</p>
                <Link className="text-link" href={`/blog/${article.slug}`}>
                  Read article -&gt;
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

