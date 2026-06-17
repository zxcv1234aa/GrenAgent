import { describe, expect, it } from "vitest";
import { expandTemplate, type MetaResolver } from "./rewrite.js";

const resolver: MetaResolver = {
  single: (n) => (({ A: "x", B: "y" }) as Record<string, string>)[n] ?? null,
  multi: (n) => (n === "ARGS" ? "1, 2, 3" : null),
};

describe("expandTemplate", () => {
  it("expands single metavariables", () => {
    expect(expandTemplate("logger.info($A)", resolver)).toBe("logger.info(x)");
    expect(expandTemplate("$A + $B", resolver)).toBe("x + y");
  });
  it("expands multi metavariable $$$NAME as raw slice", () => {
    expect(expandTemplate("f($$$ARGS)", resolver)).toBe("f(1, 2, 3)");
  });
  it("treats $$ as literal dollar", () => {
    expect(expandTemplate("price = $$5", resolver)).toBe("price = $5");
  });
  it("missing variable expands to empty string", () => {
    expect(expandTemplate("$Z!", resolver)).toBe("!");
  });
  it("longest-match: $$$ before $", () => {
    expect(expandTemplate("$$$ARGS|$A", resolver)).toBe("1, 2, 3|x");
  });
});
