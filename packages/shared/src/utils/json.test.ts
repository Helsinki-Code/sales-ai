import { describe, expect, it } from "vitest";
import { extractJsonObject, safeJsonParse } from "./json.js";

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