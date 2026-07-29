export interface ChatPanelSize {
  width: number;
  height: number;
}

export interface ChatViewportSize {
  width: number;
  height: number;
}

export const DEFAULT_CHAT_PANEL_SIZE: ChatPanelSize = {
  width: 390,
  height: 650,
};

const MIN_PANEL_WIDTH = 300;
const MIN_PANEL_HEIGHT = 420;
const MAX_PANEL_WIDTH = 720;
const MAX_PANEL_HEIGHT = 860;
const VIEWPORT_HORIZONTAL_MARGIN = 28;
const VIEWPORT_VERTICAL_MARGIN = 94;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function constrainChatPanelSize(
  size: ChatPanelSize,
  viewport: ChatViewportSize,
): ChatPanelSize {
  const maximumWidth = Math.max(
    280,
    Math.min(MAX_PANEL_WIDTH, viewport.width - VIEWPORT_HORIZONTAL_MARGIN),
  );
  const maximumHeight = Math.max(
    360,
    Math.min(MAX_PANEL_HEIGHT, viewport.height - VIEWPORT_VERTICAL_MARGIN),
  );

  return {
    width: Math.round(
      clamp(size.width, Math.min(MIN_PANEL_WIDTH, maximumWidth), maximumWidth),
    ),
    height: Math.round(
      clamp(
        size.height,
        Math.min(MIN_PANEL_HEIGHT, maximumHeight),
        maximumHeight,
      ),
    ),
  };
}

export function dragChatPanelSize(
  startSize: ChatPanelSize,
  pointerDelta: { x: number; y: number },
  position: "bottom-left" | "bottom-right",
  viewport: ChatViewportSize,
): ChatPanelSize {
  const widthDelta =
    position === "bottom-right" ? -pointerDelta.x : pointerDelta.x;
  return constrainChatPanelSize(
    {
      width: startSize.width + widthDelta,
      height: startSize.height - pointerDelta.y,
    },
    viewport,
  );
}
