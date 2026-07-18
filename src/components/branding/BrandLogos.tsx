import Image from "next/image";

interface BrandLogoProps {
  className?: string;
  decorative?: boolean;
  priority?: boolean;
}

export function ThePlaceLogo({
  className,
  decorative = false,
  priority = false,
}: BrandLogoProps) {
  return (
    <Image
      src="/branding/the-place-logo.png"
      alt={decorative ? "" : "The Place"}
      width={171}
      height={32}
      className={className}
      priority={priority}
    />
  );
}

export function LearnAILogo({
  className,
  decorative = false,
}: Omit<BrandLogoProps, "priority">) {
  return (
    <Image
      src="/branding/learnai-logo.png"
      alt={decorative ? "" : "LearnAI"}
      width={1254}
      height={1254}
      className={className}
    />
  );
}
