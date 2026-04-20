import fs from "node:fs";
import path from "node:path";
import { cache } from "react";

export type BlogImage = {
  id: string;
  index: number;
  prompt: string;
  alt: string;
  src: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type SeoMeta = {
  titleTag?: string;
  description: string;
  primaryKeyword?: string;
  secondaryKeywords: string[];
  canonicalHint?: string;
  schemaTypes: string[];
};

export type TocItem = {
  level: 2 | 3;
  text: string;
  id: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  markdown: string;
  publishedLabel: string;
  publishedAt: string;
  readingTimeMinutes: number;
  audience: string;
  keyword?: string;
  seo: SeoMeta;
  faq: FaqItem[];
  toc: TocItem[];
  images: BlogImage[];
  heroImage?: BlogImage;
  sourceFile: string;
};

export type BlogIndexItem = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readingTimeMinutes: number;
  audience: string;
  keyword?: string;
  heroImage?: BlogImage;
};

type ImageManifestItem = {
  id: string;
  index: number;
  prompt: string;
  alt: string;
  src: string;
};

type ImageManifest = Record<string, ImageManifestItem[]>;

const MARKDOWN_EXT = ".md";

function getSiteBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const fallback = "https://sales-ai-web-eta.vercel.app";
  const value = (fromEnv || fallback).trim();
  if (!value) return fallback;
  if (!/^https?:\/\//i.test(value)) return `https://${value}`;
  return value.replace(/\/+$/, "");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
    .replace(/[*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeMojibake(input: string): string {
  return input
    .replace(/â€”/g, " - ")
    .replace(/â€“/g, " - ")
    .replace(/â€˜|â€™/g, "'")
    .replace(/â€œ|â€\x9d/g, "\"")
    .replace(/â€¦/g, "...")
    .replace(/â†’/g, "->")
    .replace(/Â·/g, " - ")
    .replace(/Â/g, "");
}

function resolveBlogsDirectory(): string {
  const candidates = [
    path.join(/* turbopackIgnore: true */ process.cwd(), "blogs"),
    path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../blogs"),
    path.resolve(/* turbopackIgnore: true */ process.cwd(), "../blogs"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error("Unable to locate blogs directory. Expected monorepo blogs/*.md files.");
}

function resolveImageManifestPath(): string {
  return path.join(process.cwd(), "content", "blog-image-manifest.json");
}

function safeReadImageManifest(): ImageManifest {
  const manifestPath = resolveImageManifestPath();
  if (!fs.existsSync(manifestPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ImageManifest;
  } catch {
    return {};
  }
}

function parsePublishedInfo(raw: string): {
  publishedLabel: string;
  publishedAt: string;
  readingTimeMinutes: number;
  audience: string;
} {
  const match =
    raw.match(
      /\*\*Published:\*\*\s*([^|]+)\|\s*\*\*Reading time:\*\*\s*([^|]+)\|\s*\*\*Audience:\*\*\s*([^\n]+)/i
    ) ?? null;

  const publishedLabel = decodeMojibake(match?.[1]?.trim() || "April 2026");
  const readingRaw = match?.[2]?.trim() || "10 min";
  const audience = decodeMojibake(match?.[3]?.trim() || "Developers");

  const readingTimeMinutes = Math.max(1, Number(readingRaw.match(/\d+/)?.[0] || "10"));
  const date = new Date(`${publishedLabel.replace("|", "").trim()} 1`);
  const publishedAt = Number.isNaN(date.getTime()) ? new Date("2026-04-01").toISOString() : date.toISOString();

  return { publishedLabel, publishedAt, readingTimeMinutes, audience };
}

function parseSeoMeta(raw: string): SeoMeta {
  const seoBlock =
    raw.match(/<!--[\s\S]*?SEO METADATA[\s\S]*?-->/i)?.[0] ??
    raw.match(/<!--[\s\S]*?Title tag[\s\S]*?Meta description[\s\S]*?-->/i)?.[0] ??
    "";

  const source = seoBlock || raw;
  const descriptionMatch =
    source.match(/Meta description(?:\s*\(\d+\s*chars\))?:\s*(.+)/i) ??
    source.match(/Meta description:\s*(.+)/i);
  const titleTagMatch = source.match(/Title tag(?:\s*\(\d+\s*chars\))?:\s*(.+)/i);
  const primaryKeywordMatch = source.match(/Primary keyword:\s*(.+)/i);
  const secondaryMatch = source.match(/Secondary keywords:\s*(.+)/i);
  const canonicalMatch = source.match(/Canonical:\s*(https?:\/\/[^\s]+)/i);
  const schemaMatch = source.match(/Schema type:\s*(.+)/i);

  return {
    titleTag: titleTagMatch?.[1]?.trim() ? decodeMojibake(titleTagMatch[1].trim()) : undefined,
    description: decodeMojibake(
      descriptionMatch?.[1]?.trim() || "Developer-focused sales automation guide."
    ),
    primaryKeyword: primaryKeywordMatch?.[1]?.trim()
      ? decodeMojibake(primaryKeywordMatch[1].trim())
      : undefined,
    secondaryKeywords:
      secondaryMatch?.[1]
        ?.split(",")
        .map((item) => decodeMojibake(item.trim()))
        .filter(Boolean) ?? [],
    canonicalHint: canonicalMatch?.[1]?.trim(),
    schemaTypes:
      schemaMatch?.[1]
        ?.split("+")
        .map((item) => item.trim())
        .filter(Boolean) ?? ["TechArticle"],
  };
}

function parseSlug(raw: string, fileName: string): string {
  const match = raw.match(/URL slug:\s*\/blog\/([a-z0-9-]+)/i);
  if (match?.[1]) return match[1].trim();
  return slugify(fileName.replace(MARKDOWN_EXT, ""));
}

function removeTableOfContentsSection(markdown: string): string {
  return markdown.replace(
    /(^|\n)##\s+Table of Contents[\s\S]*?(?=\n##\s+|\n#\s+|$)/i,
    "\n"
  );
}

function extractImageBlocks(
  raw: string,
  slug: string,
  manifest: ImageManifest
): { markdown: string; images: BlogImage[] } {
  const cleanCommentValue = (value: string): string =>
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(
        (line) =>
          Boolean(line) &&
          !/^=+$/.test(line) &&
          !/^-{3,}$/.test(line) &&
          !/^FEATURED IMAGE$/i.test(line) &&
          !/^IMAGE\s+\d+/i.test(line)
      )
      .join(" ")
      .trim();

  const imageManifest = manifest[slug] ?? [];
  const images: BlogImage[] = [];
  let imageCounter = 0;

  const replaced = raw.replace(/<!--([\s\S]*?)-->/g, (_full, commentBody: string) => {
    if (!/Image gen prompt:/i.test(commentBody)) {
      return "\n";
    }

    imageCounter += 1;
    const promptMatch = commentBody.match(/Image gen prompt:\s*([\s\S]*?)\nAlt tag:/i);
    const altMatch = commentBody.match(/Alt tag:\s*([\s\S]*?)$/i);
    const prompt = decodeMojibake(cleanCommentValue(promptMatch?.[1]?.trim() || ""));
    const parsedAlt = decodeMojibake(
      cleanCommentValue(altMatch?.[1]?.trim() || `Article visual ${imageCounter}`)
    );
    const manifestImage = imageManifest.find((item) => item.index === imageCounter);
    const src = manifestImage?.src || `/blog/${slug}/img-${String(imageCounter).padStart(2, "0")}.svg`;
    const alt = manifestImage?.alt || parsedAlt;

    images.push({
      id: manifestImage?.id || `${slug}-img-${String(imageCounter).padStart(2, "0")}`,
      index: imageCounter,
      prompt: manifestImage?.prompt || prompt,
      alt,
      src,
    });

    return `\n\n![${alt}](${src})\n\n`;
  });

  return { markdown: replaced, images };
}

function normalizeBody(markdown: string, siteBaseUrl: string): string {
  const cleaned = removeTableOfContentsSection(
    decodeMojibake(markdown)
      .replace(/https?:\/\/sales-ai-web-eta\.vercel\.app/gi, siteBaseUrl)
      .replace(/^#\s+.+\n?/m, "")
      .replace(
        /\*\*Published:\*\*[^|]+\|\s*\*\*Reading time:\*\*[^|]+\|\s*\*\*Audience:\*\*[^\n]+\n?/i,
        ""
      )
      .replace(/^\s*---\s*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
  return cleaned.replace(/^\n+/, "");
}

function parseFaq(markdown: string): FaqItem[] {
  const lines = markdown.split(/\r?\n/);
  const faq: FaqItem[] = [];

  let inFaq = false;
  let currentQuestion = "";
  let currentAnswer: string[] = [];

  const flush = () => {
    if (!currentQuestion) return;
    const answer = stripMarkdown(currentAnswer.join(" ").trim());
    if (answer) {
      faq.push({ question: stripMarkdown(currentQuestion), answer });
    }
    currentQuestion = "";
    currentAnswer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+FAQ/i.test(trimmed)) {
      inFaq = true;
      flush();
      continue;
    }

    if (!inFaq) continue;

    if (/^##\s+/.test(trimmed) && !/^##\s+FAQ/i.test(trimmed)) {
      flush();
      inFaq = false;
      continue;
    }

    const questionMatch = trimmed.match(/^###\s+(.+)/);
    if (questionMatch) {
      flush();
      currentQuestion = questionMatch[1]?.trim() || "";
      continue;
    }

    if (currentQuestion) currentAnswer.push(trimmed);
  }

  flush();
  return faq;
}

function parseToc(markdown: string): TocItem[] {
  const toc: TocItem[] = [];
  const lines = markdown.split(/\r?\n/);

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    if (h2?.[1]) {
      const text = decodeMojibake(h2[1].trim());
      if (text.toLowerCase() === "faq") continue;
      toc.push({ level: 2, text, id: slugify(text) });
      continue;
    }

    const h3 = line.match(/^###\s+(.+)/);
    if (h3?.[1]) {
      const text = decodeMojibake(h3[1].trim());
      toc.push({ level: 3, text, id: slugify(text) });
    }
  }

  return toc;
}

function parseTitle(raw: string, fallback: string): string {
  const match = raw.match(/^#\s+(.+)$/m);
  return decodeMojibake(match?.[1]?.trim() || fallback);
}

function parseBlogFile(filePath: string, manifest: ImageManifest): BlogPost {
  const fileName = path.basename(filePath);
  const raw = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  const siteBaseUrl = getSiteBaseUrl();
  const slug = parseSlug(raw, fileName);
  const title = parseTitle(raw, fileName.replace(MARKDOWN_EXT, ""));
  const publishedInfo = parsePublishedInfo(raw);
  const seo = parseSeoMeta(raw);

  const extracted = extractImageBlocks(raw, slug, manifest);
  const markdown = normalizeBody(extracted.markdown, siteBaseUrl);
  const faq = parseFaq(markdown);
  const toc = parseToc(markdown);

  return {
    slug,
    title,
    description: seo.description,
    markdown,
    publishedLabel: publishedInfo.publishedLabel,
    publishedAt: publishedInfo.publishedAt,
    readingTimeMinutes: publishedInfo.readingTimeMinutes,
    audience: publishedInfo.audience,
    keyword: seo.primaryKeyword,
    seo,
    faq,
    toc,
    images: extracted.images,
    heroImage: extracted.images[0],
    sourceFile: fileName,
  };
}

const loadBlogPosts = cache((): BlogPost[] => {
  const blogDir = resolveBlogsDirectory();
  const manifest = safeReadImageManifest();
  const files = fs
    .readdirSync(blogDir)
    .filter((file) => file.toLowerCase().endsWith(MARKDOWN_EXT))
    .map((file) => path.join(blogDir, file))
    .sort((a, b) => a.localeCompare(b));

  const posts = files.map((filePath) => parseBlogFile(filePath, manifest));

  return posts.sort((a, b) => {
    const dateDiff = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.title.localeCompare(b.title);
  });
});

export function getAllBlogPosts(): BlogPost[] {
  return loadBlogPosts();
}

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return loadBlogPosts().find((post) => post.slug === slug);
}

export function getBlogIndexItems(): BlogIndexItem[] {
  return loadBlogPosts().map((post) => ({
    slug: post.slug,
    title: post.title,
    description: post.description,
    publishedAt: post.publishedAt,
    readingTimeMinutes: post.readingTimeMinutes,
    audience: post.audience,
    keyword: post.keyword,
    heroImage: post.heroImage,
  }));
}

export function buildBlogCanonicalPath(slug: string): string {
  const siteBaseUrl = getSiteBaseUrl();
  return `${siteBaseUrl}/blog/${slug}`;
}

export function buildBlogJsonLd(post: BlogPost): Array<Record<string, unknown>> {
  const pageUrl = buildBlogCanonicalPath(post.slug);
  const graph: Array<Record<string, unknown>> = [];

  if (post.seo.schemaTypes.some((type) => /techarticle/i.test(type))) {
    graph.push({
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.publishedAt,
      author: { "@type": "Organization", name: "Sales AI" },
      publisher: { "@type": "Organization", name: "Sales AI" },
      mainEntityOfPage: pageUrl,
      url: pageUrl,
      image: post.heroImage?.src ? [post.heroImage.src] : undefined,
      keywords: [post.keyword, ...post.seo.secondaryKeywords].filter(Boolean),
    });
  }

  if (post.faq.length > 0 && post.seo.schemaTypes.some((type) => /faq/i.test(type))) {
    graph.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: post.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  if (post.seo.schemaTypes.some((type) => /howto/i.test(type))) {
    const howToSteps = post.toc
      .filter((item) => item.level === 2)
      .slice(0, 8)
      .map((item) => ({
        "@type": "HowToStep",
        name: item.text,
        text: item.text,
      }));

    if (howToSteps.length > 0) {
      graph.push({
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: post.title,
        totalTime: `PT${Math.max(1, post.readingTimeMinutes)}M`,
        step: howToSteps,
      });
    }
  }

  return graph;
}
