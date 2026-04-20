import type { ReactNode } from "react";

type MarkdownRendererProps = {
  markdown: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(`[^`]+`)|(\[([^\]]+)]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null = regex.exec(text);
  let index = 0;

  while (match) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    if (match[1]) {
      nodes.push(
        <code className="inline-code" key={`${keyPrefix}-code-${index}`}>
          {match[1].slice(1, -1)}
        </code>
      );
    } else if (match[2]) {
      const label = match[3] || "";
      const href = match[4] || "#";
      const external = /^https?:\/\//i.test(href);
      nodes.push(
        <a
          key={`${keyPrefix}-link-${index}`}
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer noopener" : undefined}
        >
          {label}
        </a>
      );
    } else if (match[5]) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${index}`}>{match[6]}</strong>
      );
    } else if (match[7]) {
      nodes.push(<em key={`${keyPrefix}-em-${index}`}>{match[8]}</em>);
    }

    cursor = match.index + match[0].length;
    index += 1;
    match = regex.exec(text);
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes.length > 0 ? nodes : [text];
}

function isBlockBoundary(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return (
    /^#{1,6}\s+/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^```/.test(trimmed) ||
    /^[-*]\s+/.test(trimmed) ||
    /^\d+\.\s+/.test(trimmed) ||
    /^\|/.test(trimmed) ||
    /^---+$/.test(trimmed) ||
    /^\*\*\*+$/.test(trimmed)
  );
}

export function MarkdownRenderer({ markdown }: MarkdownRendererProps) {
  const lines = markdown.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i] || "";
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const language = trimmed.replace(/^```/, "").trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test((lines[i] || "").trim())) {
        codeLines.push(lines[i] || "");
        i += 1;
      }
      if (i < lines.length) i += 1;
      nodes.push(
        <pre key={`code-${i}`} className="article-code">
          <code className={language ? `language-${language}` : undefined}>
            {codeLines.join("\n")}
          </code>
        </pre>
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const marker = headingMatch[1] || "##";
      const headingText = headingMatch[2] || "";
      const level = marker.length;
      const text = headingText.trim();
      const id = slugify(text);
      const content = parseInline(text, `h-${i}`);
      if (level <= 2) {
        nodes.push(
          <h2 id={id} key={`h2-${i}`}>
            {content}
          </h2>
        );
      } else if (level === 3) {
        nodes.push(
          <h3 id={id} key={`h3-${i}`}>
            {content}
          </h3>
        );
      } else {
        nodes.push(
          <h4 id={id} key={`h4-${i}`}>
            {content}
          </h4>
        );
      }
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      nodes.push(<hr key={`hr-${i}`} />);
      i += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test((lines[i] || "").trim())) {
        quoteLines.push((lines[i] || "").trim().replace(/^>\s?/, ""));
        i += 1;
      }
      nodes.push(
        <blockquote key={`q-${i}`}>
          <p>{parseInline(quoteLines.join(" "), `q-${i}`)}</p>
        </blockquote>
      );
      continue;
    }

    const tableStart = /^\|.*\|$/.test(trimmed);
    const separatorLine = /^\|\s*[-:| ]+\|$/.test((lines[i + 1] || "").trim());
    if (tableStart && separatorLine) {
      const headCells = trimmed
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim());
      i += 2;

      const bodyRows: string[][] = [];
      while (i < lines.length) {
        const rowLine = (lines[i] || "").trim();
        if (!/^\|.*\|$/.test(rowLine)) break;
        bodyRows.push(
          rowLine
            .slice(1, -1)
            .split("|")
            .map((cell) => cell.trim())
        );
        i += 1;
      }

      nodes.push(
        <div className="article-table-wrap" key={`table-${i}`}>
          <table>
            <thead>
              <tr>
                {headCells.map((cell, idx) => (
                  <th key={`th-${idx}`}>{parseInline(cell, `th-${idx}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIdx) => (
                <tr key={`tr-${rowIdx}`}>
                  {row.map((cell, cellIdx) => (
                    <td key={`td-${rowIdx}-${cellIdx}`}>
                      {parseInline(cell, `td-${rowIdx}-${cellIdx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test((lines[i] || "").trim())) {
        items.push((lines[i] || "").trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      nodes.push(
        <ol key={`ol-${i}`}>
          {items.map((item, idx) => (
            <li key={`oli-${idx}`}>{parseInline(item, `oli-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test((lines[i] || "").trim())) {
        items.push((lines[i] || "").trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      nodes.push(
        <ul key={`ul-${i}`}>
          {items.map((item, idx) => (
            <li key={`uli-${idx}`}>{parseInline(item, `uli-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)]\(([^)]+)\)$/);
    if (imageMatch) {
      const alt = imageMatch[1] || "Blog illustration";
      const src = imageMatch[2] || "";
      nodes.push(
        <figure className="article-image" key={`img-${i}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} loading="lazy" />
        </figure>
      );
      i += 1;
      continue;
    }

    const paragraphLines: string[] = [trimmed];
    i += 1;
    while (i < lines.length && !isBlockBoundary(lines[i] || "")) {
      paragraphLines.push((lines[i] || "").trim());
      i += 1;
    }

    nodes.push(
      <p key={`p-${i}`}>
        {parseInline(paragraphLines.join(" "), `p-${i}`)}
      </p>
    );
  }

  return <div className="article-markdown">{nodes}</div>;
}
