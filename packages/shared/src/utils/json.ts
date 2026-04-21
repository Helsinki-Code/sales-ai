export function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

function normalizeCommonJsonIssues(input: string): string {
  return input
    .replace(/^\uFEFF/, "")
    .replace(/\u00A0/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function removeTrailingCommas(input: string): string {
  let previous = "";
  let current = input;
  while (current !== previous) {
    previous = current;
    current = current.replace(/,\s*([}\]])/g, "$1");
  }
  return current;
}

function normalizeJsLikeObject(input: string): string {
  return input
    .replace(/([{,]\s*)([A-Za-z_][\w-]*)(\s*:)/g, '$1"$2"$3')
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, value: string) => {
      const escaped = value.replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
}

function parseNdjsonArray<T>(input: string): T | null {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/,\s*$/, ""));

  if (lines.length < 2 || !lines.every((line) => line.startsWith("{") && line.endsWith("}"))) {
    return null;
  }

  return safeJsonParse<T>(`[${lines.join(",")}]`);
}

function isJsonContainer(input: string): boolean {
  const trimmed = input.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

function extractFirstBalancedJson(input: string): string | null {
  const start = input.search(/[\{\[]/);
  if (start === -1) return null;

  const opening = input[start];
  const closing = opening === "{" ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (ch === "\\") {
        escaping = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === opening) {
      depth += 1;
      continue;
    }

    if (ch === closing) {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, i + 1).trim();
      }
    }
  }

  return null;
}

export function extractJsonObject(input: string): string {
  const trimmed = input.trim();
  if (isJsonContainer(trimmed)) return trimmed;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    const maybe = fenceMatch[1].trim();
    if (isJsonContainer(maybe)) return maybe;
    const fencedBalanced = extractFirstBalancedJson(maybe);
    if (fencedBalanced) return fencedBalanced;
  }

  const balanced = extractFirstBalancedJson(trimmed);
  if (balanced) return balanced;

  return trimmed;
}

export function parseJsonPayload<T>(input: string): T | null {
  const normalized = normalizeCommonJsonIssues(input).trim();
  const extracted = extractJsonObject(normalized);

  const attempts = [
    extracted,
    removeTrailingCommas(extracted),
    normalizeJsLikeObject(removeTrailingCommas(extracted))
  ];

  for (const candidate of attempts) {
    const parsed = safeJsonParse<T>(candidate);
    if (parsed) return parsed;
  }

  return parseNdjsonArray<T>(normalized);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
