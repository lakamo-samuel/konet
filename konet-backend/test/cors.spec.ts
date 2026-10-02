import { resolveCorsOrigins } from "../src/config/cors";
describe("shared browser origin allowlist", () => {
  it("defaults to the frontend origin", () =>
    expect(resolveCorsOrigins("https://konet.example")).toEqual([
      "https://konet.example",
    ]));
  it("allows localhost alongside production without wildcard", () =>
    expect(
      resolveCorsOrigins(
        "https://konet.example",
        "https://konet.example,http://localhost:3000,http://localhost:3000",
      ),
    ).toEqual(["https://konet.example", "http://localhost:3000"]));
  it.each([
    "*",
    "null",
    "https://user:password@example.com",
    "https://example.com/path",
    "https://example.com?key=value",
    "https://example.com#fragment",
  ])("rejects invalid origin %s", (value) =>
    expect(() => resolveCorsOrigins("https://konet.example", value)).toThrow(),
  );
});
