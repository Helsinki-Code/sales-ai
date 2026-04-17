import { describe, expect, it } from "vitest";
import { salesBodySchemaByEndpoint } from "./sales.schemas.js";

describe("sales schemas", () => {
  it("validates leads count range", () => {
    expect(() => salesBodySchemaByEndpoint.leads.parse({ url: "https://example.com", count: 10 })).not.toThrow();
    expect(() => salesBodySchemaByEndpoint.leads.parse({ url: "https://example.com", count: 1 })).toThrow();
  });

  it("validates qualify URL", () => {
    expect(() => salesBodySchemaByEndpoint.qualify.parse({ url: "https://statsig.com" })).not.toThrow();
  });
});