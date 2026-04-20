import seoRows from "@/content/blog-seo-strategy.json";

export type SeoRow = {
  Keyword: string;
  KD: string;
  Volume: string;
  Category: string;
  "CTR Title": string;
  "Meta Description": string;
  "Content Strategy": string;
  "Internal Links": string;
  "Snippet Target": string;
  "SERP Analysis": string;
  "AI Overview": string;
  "Top Competitors": string;
  "People Also Ask": string;
  Intent: string;
  "Opportunity Score": string;
  "Strategic Insight": string;
};

export type BlogArticle = {
  slug: string;
  keyword: string;
  kd: number;
  volume: number;
  category: string;
  title: string;
  description: string;
  contentStrategy: string;
  internalLinks: string[];
  snippetTarget: string;
  serpAnalysis: string;
  aiOverview: string;
  topCompetitors: string[];
  peopleAlsoAsk: string[];
  intent: string;
  opportunityScore: number;
  strategicInsight: string;
  readTimeMinutes: number;
  publishedAt: string;
  heroImage: string;
};

const HERO_IMAGES = [
  "/brand/blog-insights.svg",
  "/brand/hero-platform.svg",
  "/brand/product-endpoints.svg",
  "/brand/security-encryption.svg",
  "/brand/docs-quickstart.svg",
  "/brand/pricing-value.svg",
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function splitPipe(value: string): string[] {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitLinks(value: string): string[] {
  const clean = value.replace(/^Link to\s*/i, "").replace(/^Link\s*/i, "");
  return clean
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function estimateReadTime(contentStrategy: string): number {
  const match = contentStrategy.match(/(\d{3,4})-word/i);
  const wordCount = match ? Number(match[1]) : 1400;
  return Math.max(4, Math.round(wordCount / 220));
}

function publishedDate(index: number): string {
  const date = new Date("2026-04-20T00:00:00.000Z");
  date.setDate(date.getDate() - index);
  return date.toISOString();
}

const rows = seoRows as SeoRow[];

export const blogArticles: BlogArticle[] = rows.map((row, index) => ({
  slug: slugify(row.Keyword),
  keyword: row.Keyword,
  kd: Number(row.KD),
  volume: Number(row.Volume),
  category: row.Category,
  title: row["CTR Title"],
  description: row["Meta Description"],
  contentStrategy: row["Content Strategy"],
  internalLinks: splitLinks(row["Internal Links"]),
  snippetTarget: row["Snippet Target"],
  serpAnalysis: row["SERP Analysis"],
  aiOverview: row["AI Overview"],
  topCompetitors: splitPipe(row["Top Competitors"]),
  peopleAlsoAsk: splitPipe(row["People Also Ask"]),
  intent: row.Intent,
  opportunityScore: Number(row["Opportunity Score"]),
  strategicInsight: row["Strategic Insight"],
  readTimeMinutes: estimateReadTime(row["Content Strategy"]),
  publishedAt: publishedDate(index),
  heroImage: HERO_IMAGES[index % HERO_IMAGES.length] ?? HERO_IMAGES[0] ?? "/brand/blog-insights.svg",
}));

export function getBlogArticle(slug: string): BlogArticle | undefined {
  return blogArticles.find((article) => article.slug === slug);
}
