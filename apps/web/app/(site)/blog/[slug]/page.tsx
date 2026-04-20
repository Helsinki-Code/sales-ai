import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownRenderer } from "@/components/blog/markdown-renderer";
import { ReadingProgress } from "@/components/blog/reading-progress";
import {
  buildBlogCanonicalPath,
  buildBlogJsonLd,
  getAllBlogPosts,
  getBlogPostBySlug,
} from "@/lib/blog-content";

type BlogArticlePageProps = {
  params: Promise<{ slug: string }>;
};

function toAbsoluteUrl(src: string | undefined, slug: string): string | undefined {
  if (!src) return undefined;
  if (/^https?:\/\//i.test(src)) return src;
  const canonical = buildBlogCanonicalPath(slug);
  const origin = canonical.replace(/\/blog\/[^/]+$/, "");
  return `${origin}${src.startsWith("/") ? src : `/${src}`}`;
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(isoDate));
}

export function generateStaticParams() {
  return getAllBlogPosts().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Article Not Found | Sales AI Blog",
      description: "The requested article could not be found.",
    };
  }

  const canonical = buildBlogCanonicalPath(post.slug);
  const imageUrl = toAbsoluteUrl(post.heroImage?.src, post.slug);
  const keywords = [post.keyword, ...post.seo.secondaryKeywords].filter(
    (value): value is string => Boolean(value)
  );

  return {
    title: post.seo.titleTag || post.title,
    description: post.description,
    keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "article",
      title: post.seo.titleTag || post.title,
      description: post.description,
      url: canonical,
      publishedTime: post.publishedAt,
      images: imageUrl ? [{ url: imageUrl, alt: post.heroImage?.alt || post.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.seo.titleTag || post.title,
      description: post.description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) notFound();

  const jsonLd = buildBlogJsonLd(post);

  return (
    <>
      <ReadingProgress />
      <main>
        <section className="container hero hero-with-visual blog-article-hero">
          <div>
            <p className="eyebrow">Sales AI Journal</p>
            <h1>{post.title}</h1>
            <p>{post.description}</p>
            <div className="pill-row blog-meta-row">
              <span className="pill">{formatDate(post.publishedAt)}</span>
              <span className="pill">{post.readingTimeMinutes} min read</span>
              <span className="pill">{post.audience}</span>
              {post.keyword ? <span className="pill">{post.keyword}</span> : null}
            </div>
          </div>
          {post.heroImage ? (
            <figure className="visual-panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.heroImage.src} alt={post.heroImage.alt} className="article-hero-image" />
            </figure>
          ) : null}
        </section>

        <section className="container blog-content-layout">
          <aside className="blog-toc" aria-label="Table of contents">
            <p className="blog-toc-label">On this page</p>
            <ul>
              {post.toc.map((item) => (
                <li key={`${item.level}-${item.id}`} className={`level-${item.level}`}>
                  <a href={`#${item.id}`}>{item.text}</a>
                </li>
              ))}
            </ul>
          </aside>

          <article className="article-section blog-article-body">
            <MarkdownRenderer markdown={post.markdown} />

            <section className="article-cta card">
              <h2>Ship These Workflows In Your Product</h2>
              <p>
                Use the same endpoint patterns from this guide in your workspace, then validate
                behavior in the playground and production API reference.
              </p>
              <div className="inline-actions">
                <Link className="cta" href="/playground">
                  Open Playground
                </Link>
                <Link className="text-link" href="/api-reference">
                  Open API Reference -&gt;
                </Link>
              </div>
            </section>

            <div className="article-footer-nav">
              <Link className="text-link" href="/blog">
                &lt;- Back to Blog
              </Link>
            </div>
          </article>
        </section>
      </main>

      {jsonLd.map((item, idx) => (
        <script
          key={`jsonld-${idx}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
