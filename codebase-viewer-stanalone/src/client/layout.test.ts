import { describe, expect, it } from "vitest";

import { sidebarWidthForFunctionDrawer } from "./layout";

describe("Function drawer layout", () => {
  it("keeps a shallow hierarchy unchanged when names already have readable width", () => {
    expect(sidebarWidthForFunctionDrawer(320, 240, 480)).toBe(320);
  });

  it("widens for a deeply nested entity by exactly the missing readable width", () => {
    expect(sidebarWidthForFunctionDrawer(320, 120, 480)).toBe(410);
  });

  it("respects the code viewport when the sidebar cannot grow enough", () => {
    expect(sidebarWidthForFunctionDrawer(300, 80, 360)).toBe(360);
  });

  it("never shrinks a user-resized sidebar", () => {
    expect(sidebarWidthForFunctionDrawer(440, 260, 480)).toBe(440);
  });
});
