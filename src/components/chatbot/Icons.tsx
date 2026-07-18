interface IconProps {
  size?: number;
  className?: string;
}

const svgProps = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
  "aria-hidden": true,
});

export function ChatIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M20.2 14.4a3.2 3.2 0 0 1-3.2 3.2H9l-4.6 3v-3.8a3.2 3.2 0 0 1-1.6-2.8V7.2A3.2 3.2 0 0 1 6 4h11a3.2 3.2 0 0 1 3.2 3.2z" />
      <path d="M7.3 9.1h9.4M7.3 12.6h6.4" />
    </svg>
  );
}

export function SendIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="m3.5 3.5 17 8.5-17 8.5 2.2-7.1L15 12l-9.3-1.4z" />
    </svg>
  );
}

export function CloseIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function MinimizeIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function RestartIcon({ size = 19, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M4.5 8.5A8 8 0 1 1 4 14" />
      <path d="M4.5 4.5v4h4" />
    </svg>
  );
}

export function ArrowIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

export function ExternalIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

export function ShieldIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M12 3 5.5 5.7v5.5c0 4.2 2.7 7.7 6.5 9.8 3.8-2.1 6.5-5.6 6.5-9.8V5.7z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

