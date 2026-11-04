import Image from "next/image";
import { Globe } from "lucide-react";
import type { ReactNode } from "react";
import { hasImage, imageUrl } from "@/sanity/image";
import type { SanityImage } from "@/lib/types";

/** 5-point star path centred at (cx, cy). */
function star(cx: number, cy: number, r: number, points = 5) {
  const inner = r * 0.42;
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    d += `${i === 0 ? "M" : "L"}${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
  }
  return d + "Z";
}

const UnionJack = () => (
  <g>
    <clipPath id="uj-c">
      <path d="M0 0v30h60V0z" />
    </clipPath>
    <clipPath id="uj-t">
      <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
    </clipPath>
    <g clipPath="url(#uj-c)">
      <path d="M0 0v30h60V0z" fill="#012169" />
      <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0l60 30m0-30L0 30" clipPath="url(#uj-t)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </g>
  </g>
);

const FLAGS: Record<string, { box: string; body: ReactNode }> = {
  DE: {
    box: "0 0 30 20",
    body: (
      <>
        <rect width="30" height="6.67" fill="#000" />
        <rect y="6.67" width="30" height="6.67" fill="#DD0000" />
        <rect y="13.33" width="30" height="6.67" fill="#FFCE00" />
      </>
    ),
  },
  PL: {
    box: "0 0 30 20",
    body: (
      <>
        <rect width="30" height="10" fill="#fff" />
        <rect y="10" width="30" height="10" fill="#DC143C" />
      </>
    ),
  },
  FR: {
    box: "0 0 30 20",
    body: (
      <>
        <rect width="10" height="20" fill="#0055A4" />
        <rect x="10" width="10" height="20" fill="#fff" />
        <rect x="20" width="10" height="20" fill="#EF4135" />
      </>
    ),
  },
  IT: {
    box: "0 0 30 20",
    body: (
      <>
        <rect width="10" height="20" fill="#009246" />
        <rect x="10" width="10" height="20" fill="#fff" />
        <rect x="20" width="10" height="20" fill="#CE2B37" />
      </>
    ),
  },
  ES: {
    box: "0 0 30 20",
    body: (
      <>
        <rect width="30" height="20" fill="#AA151B" />
        <rect y="5" width="30" height="10" fill="#F1BF00" />
      </>
    ),
  },
  JP: {
    box: "0 0 30 20",
    body: (
      <>
        <rect width="30" height="20" fill="#fff" />
        <circle cx="15" cy="10" r="6" fill="#BC002D" />
      </>
    ),
  },
  KR: {
    box: "0 0 30 20",
    body: (
      <>
        <rect width="30" height="20" fill="#fff" />
        <g transform="rotate(33.7 15 10)">
          <circle cx="15" cy="10" r="5" fill="#0047A0" />
          <path d="M10 10a5 5 0 0 1 10 0z" fill="#CD2E3A" />
          <circle cx="12.5" cy="10" r="2.5" fill="#CD2E3A" />
          <circle cx="17.5" cy="10" r="2.5" fill="#0047A0" />
        </g>
        <g stroke="#000" strokeWidth="0.7">
          <g transform="rotate(-56.3 5.5 4)">
            <path d="M3.5 3h4M3.5 4.2h4M3.5 5.4h4" />
          </g>
          <g transform="rotate(56.3 24.5 4)">
            <path d="M22.5 3h4M22.5 4.2h4M22.5 5.4h4" />
          </g>
          <g transform="rotate(-56.3 24.5 16)">
            <path d="M22.5 15h4M22.5 16.2h4M22.5 17.4h4" />
          </g>
          <g transform="rotate(56.3 5.5 16)">
            <path d="M3.5 15h4M3.5 16.2h4M3.5 17.4h4" />
          </g>
        </g>
      </>
    ),
  },
  SK: {
    box: "0 0 30 20",
    body: (
      <>
        <rect width="30" height="6.67" fill="#fff" />
        <rect y="6.67" width="30" height="6.67" fill="#0B4EA2" />
        <rect y="13.33" width="30" height="6.67" fill="#EE1C25" />
        <path d="M7 4.5h7v6.5c0 3-3.5 4.5-3.5 4.5S7 14 7 11z" fill="#EE1C25" stroke="#fff" strokeWidth="0.6" />
        <path d="M10.5 6v7.5M8.8 8h3.4M8.3 10h4.4" stroke="#fff" strokeWidth="0.8" />
      </>
    ),
  },
  CZ: {
    box: "0 0 30 20",
    body: (
      <>
        <rect width="30" height="10" fill="#fff" />
        <rect y="10" width="30" height="10" fill="#D7141A" />
        <path d="M0 0l15 10L0 20z" fill="#11457E" />
      </>
    ),
  },
  AE: {
    box: "0 0 30 20",
    body: (
      <>
        <rect width="30" height="6.67" fill="#00732F" />
        <rect y="6.67" width="30" height="6.67" fill="#fff" />
        <rect y="13.33" width="30" height="6.67" fill="#000" />
        <rect width="8" height="20" fill="#FF0000" />
      </>
    ),
  },
  TR: {
    box: "0 0 30 20",
    body: (
      <>
        <rect width="30" height="20" fill="#E30A17" />
        <circle cx="11" cy="10" r="5" fill="#fff" />
        <circle cx="12.25" cy="10" r="4" fill="#E30A17" />
        <path d={star(17.3, 10, 2.2)} fill="#fff" transform="rotate(-18 17.3 10)" />
      </>
    ),
  },
  CN: {
    box: "0 0 30 20",
    body: (
      <>
        <rect width="30" height="20" fill="#EE1C25" />
        <path d={star(5, 5, 3)} fill="#FFFF00" />
        <path d={star(10, 2, 1)} fill="#FFFF00" />
        <path d={star(12, 4, 1)} fill="#FFFF00" />
        <path d={star(12, 7, 1)} fill="#FFFF00" />
        <path d={star(10, 9, 1)} fill="#FFFF00" />
      </>
    ),
  },
  US: {
    box: "0 0 38 20",
    body: (
      <>
        {Array.from({ length: 13 }, (_, i) => (
          <rect key={i} y={(i * 20) / 13} width="38" height={20 / 13 + 0.02} fill={i % 2 ? "#fff" : "#B22234"} />
        ))}
        <rect width="15.2" height={(20 / 13) * 7} fill="#3C3B6E" />
        {Array.from({ length: 4 }, (_, r) =>
          Array.from({ length: 5 }, (_, c) => (
            <circle key={`${r}-${c}`} cx={1.6 + c * 3} cy={1.6 + r * 2.6} r="0.55" fill="#fff" />
          ))
        )}
      </>
    ),
  },
  GB: { box: "0 0 60 30", body: <UnionJack /> },
  AU: {
    box: "0 0 60 30",
    body: (
      <>
        <rect width="60" height="30" fill="#012169" />
        <g transform="scale(0.5)">
          <UnionJack />
        </g>
        <path d={star(15, 22.5, 4.2, 7)} fill="#fff" />
        <path d={star(45, 24, 2.2, 7)} fill="#fff" />
        <path d={star(37.5, 13, 2.2, 7)} fill="#fff" />
        <path d={star(45, 5.5, 2.2, 7)} fill="#fff" />
        <path d={star(51.5, 11.5, 2.2, 7)} fill="#fff" />
        <path d={star(47.5, 15.5, 1.2)} fill="#fff" />
      </>
    ),
  },
};

type Props = { code?: string; image?: SanityImage; label?: string; className?: string };

export function Flag({ code, image, label = "", className = "" }: Props) {
  const base = `relative inline-flex shrink-0 overflow-hidden rounded-[6px] ring-1 ring-black/10 ${className}`;
  if (hasImage(image)) {
    return (
      <span className={base}>
        <Image src={imageUrl(image, 96, 64)} alt={label} fill sizes="48px" className="object-cover" />
      </span>
    );
  }
  const flag = code ? FLAGS[code.toUpperCase()] : undefined;
  if (!flag) {
    return (
      <span className={`${base} items-center justify-center bg-surface text-muted`} aria-hidden={!label}>
        <Globe className="h-1/2 w-1/2" strokeWidth={1.75} />
      </span>
    );
  }
  return (
    <span className={base}>
      <svg viewBox={flag.box} preserveAspectRatio="xMidYMid slice" className="h-full w-full" role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
        {flag.body}
      </svg>
    </span>
  );
}
