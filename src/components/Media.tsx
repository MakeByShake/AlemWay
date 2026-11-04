import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { hasImage, urlFor } from "@/sanity/image";
import { l } from "@/lib/i18n-content";
import type { SanityImage } from "@/lib/types";

type Props = {
  image?: SanityImage | null;
  locale: string;
  placeholder: string;
  alt?: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  width?: number;
};

/** Photo from Sanity, or a neutral placeholder block with a caption ("Фото офиса"). */
export function Media({ image, locale, placeholder, alt, sizes, className = "", priority, width = 1600 }: Props) {
  if (hasImage(image)) {
    return (
      <div className={`relative overflow-hidden bg-surface ${className}`}>
        <Image
          src={urlFor(image).width(width).url()}
          alt={alt ?? l(image.alt, locale)}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      </div>
    );
  }
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(135deg,#eef0f5_0,#eef0f5_12px,#f5f6fa_12px,#f5f6fa_24px)] text-muted ${className}`}
      role="img"
      aria-label={placeholder}
    >
      <ImageIcon className="h-6 w-6" strokeWidth={1.5} />
      <span className="text-[13px] font-medium">{placeholder}</span>
    </div>
  );
}
