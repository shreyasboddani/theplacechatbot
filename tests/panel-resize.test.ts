import { describe, expect, it } from "vitest";

import {
  constrainChatPanelSize,
  dragChatPanelSize,
} from "@/lib/chat/panel-resize";

describe("chat panel resizing", () => {
  const viewport = { width: 1200, height: 1000 };

  it("keeps requested sizes within usable viewport bounds", () => {
    expect(constrainChatPanelSize({ width: 100, height: 100 }, viewport)).toEqual({
      width: 300,
      height: 420,
    });
    expect(
      constrainChatPanelSize({ width: 2000, height: 2000 }, viewport),
    ).toEqual({ width: 720, height: 860 });
  });

  it("grows inward from either anchored corner", () => {
    expect(
      dragChatPanelSize(
        { width: 390, height: 650 },
        { x: -80, y: -50 },
        "bottom-right",
        viewport,
      ),
    ).toEqual({ width: 470, height: 700 });
    expect(
      dragChatPanelSize(
        { width: 390, height: 650 },
        { x: 80, y: -50 },
        "bottom-left",
        viewport,
      ),
    ).toEqual({ width: 470, height: 700 });
  });

  it("adapts its minimum when the viewport is smaller", () => {
    expect(
      constrainChatPanelSize(
        { width: 390, height: 650 },
        { width: 320, height: 500 },
      ),
    ).toEqual({ width: 292, height: 406 });
  });
});
