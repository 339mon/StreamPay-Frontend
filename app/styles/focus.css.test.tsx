/**
 * @jest-environment jsdom
 */

import "./focus.css";

describe("shared focus-visible layer", () => {
  it("declares a keyboard-visible focus ring for interactive elements", () => {
    const styleText = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join("\n");
        } catch {
          return "";
        }
      })
      .join("\n");

    expect(styleText).toContain(":focus-visible");
    expect(styleText).toContain("outline: 2px solid var(--accent);");
    expect(styleText).toContain("box-shadow: 0 0 0 2px var(--background);");
  });
});
