import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { blogArticles, getBlogArticle } from "@/lib/blog";

type BlogArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return blogArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getBlogArticle(slug);

  if (!article) {
    return {
      title: "Article Not Found | Sales AI Blog",
      description: "The requested article could not be found.",
    };
  }

  return {
    title: article.title,
    description: article.description,
    keywords: [article.keyword, "sales ai api", "byok", "sales automation"],
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const article = getBlogArticle(slug);

  if (!article) {
    notFound();
  }

  return (
    <main>
      <section className="container hero hero-with-visual blog-hero">
        <div>
          <p className="eyebrow">Sales AI Insights</p>
          <h1>{article.title}</h1>
          <p>{article.description}</p>
          <div className="pill-row" style={{ marginTop: "1rem" }}>
            <span className="pill">Keyword: {article.keyword}</span>
            <span className="pill">KD {article.kd}</span>
            <span className="pill">Volume {article.volume}</span>
            <span className="pill">{article.readTimeMinutes} min read</span>
          </div>
        </div>
        <figure className="visual-panel">
          <Image
            src={article.heroImage}
            alt={`Professional brand visual for the article topic ${article.keyword}`}
            width={900}
            height={620}
            priority
          />
        </figure>
      </section>

      <article className="container article-shell">
        <section className="article-section">
          <h2>Strategic Context</h2>
          <p>{article.strategicInsight}</p>
          <p>
            Intent profile: <strong>{article.intent}</strong>. This topic is grouped under
            <strong> {article.category}</strong> and is designed to earn decision-stage organic
            demand.
          </p>
        </section>

        <section className="article-section">
          <h2>Suggested Content Blueprint</h2>
          <p>{article.contentStrategy}</p>
          <p>
            Snippet target: <strong>{article.snippetTarget}</strong>
          </p>
        </section>

        <section className="article-section">
          <h2>SERP And AI Overview Gap</h2>
          <p>{article.serpAnalysis}</p>
          <p>{article.aiOverview}</p>
          <h3>Top competitors appearing today</h3>
          <ul>
            {article.topCompetitors.map((competitor) => (
              <li key={competitor}>{competitor}</li>
            ))}
          </ul>
        </section>

        <section className="article-section">
          <h2>People Also Ask Targets</h2>
          <ul>
            {article.peopleAlsoAsk.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>

        <section className="article-section">
          <h2>Internal Linking Checklist</h2>
          <p>Wire this article into your product journey with the following links:</p>
          <ul>
            {article.internalLinks.map((linkText) => (
              <li key={linkText}>{linkText}</li>
            ))}
          </ul>
        </section>

        <section className="article-cta card">
          <h2>Ship This Topic Live</h2>
          <p>
            Want this article fully expanded with production copy, code examples, and conversion
            CTAs? Start from the playground and wire the endpoint sequence directly into your content
            workflow.
          </p>
          <div className="inline-actions">
            <Link className="cta" href="/playground">
              Open Playground
            </Link>
            <Link className="text-link" href="/docs/quickstart">
              Read quickstart -&gt;
            </Link>
          </div>
        </section>

        <div className="article-footer-nav">
          <Link className="text-link" href="/blog">
            &lt;- Back to Blog
          </Link>
        </div>
      </article>
    </main>
  );
}

