import { describe, expect, it } from "vitest";

import {
  buildAtlasBootstrapUrl,
  buildAtlasThreadUrl,
  parseAtlasThreadId,
} from "../src/lib/atlas/thread-navigation";

describe("thread-navigation", () => {
  it("builds thread-only URLs without bootstrap q", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(buildAtlasThreadUrl(id)).toBe(`/atlas?thread=${id}`);
    expect(buildAtlasThreadUrl(` ${id} `)).toBe(`/atlas?thread=${id}`);
  });

  it("builds bootstrap URLs with thread and q", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const url = buildAtlasBootstrapUrl(id, "rail decarbonisation");
    expect(url).toContain(`thread=${id}`);
    expect(url).toContain("q=rail");
  });

  it("parses thread id from search params", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(parseAtlasThreadId(`?thread=${id}&q=hello`)).toBe(id);
    expect(parseAtlasThreadId("")).toBeNull();
  });
});
