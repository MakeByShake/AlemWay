import Image from "next/image";

export function Logo({ variant = "color", className = "h-7 w-auto sm:h-8" }: { variant?: "color" | "white"; className?: string }) {
  return (
    <Image
      src={variant === "white" ? "/brand/alemway_wordmark_white.svg" : "/brand/alemway_wordmark.svg"}
      alt="AlemWay Visa"
      width={1346}
      height={194}
      priority
      unoptimized
      className={className}
    />
  );
}
