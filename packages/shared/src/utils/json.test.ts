import { describe, expect, it } from "vitest";
import { extractJsonObject, parseJsonPayload, safeJsonParse } from "./json.js";

describe("extractJsonObject", () => {
  it("extracts fenced JSON", () => {
    const raw = "```json\n{\"ok\":true}\n```";
    expect(extractJsonObject(raw)).toBe('{"ok":true}');
  });

  it("extracts first object from prose", () => {
    const raw = "Result: {\"score\":82,\"grade\":\"A\"} done";
    expect(safeJsonParse<{ score: number }>(extractJsonObject(raw))?.score).toBe(82);
  });
});

describe("parseJsonPayload", () => {
  it("parses JSON-like payload with single quotes and trailing comma", () => {
    const raw = "{ 'score': 82, 'grade': 'A', }";
    const parsed = parseJsonPayload<{ score: number; grade: string }>(raw);
    expect(parsed).toEqual({ score: 82, grade: "A" });
  });

  it("parses line-delimited JSON objects as array", () => {
    const raw = "{\"name\":\"Acme\"}\n{\"name\":\"Beta\"}";
    const parsed = parseJsonPayload<Array<{ name: string }>>(raw);
    expect(parsed?.length).toBe(2);
    expect(parsed?.[1]?.name).toBe("Beta");
  });
});
