import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { hasImage, imageUrl } from "@/sanity/image";
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
  /** Hide the small author caption (e.g. when the photo is a background with its own caption). */
  hideCredit?: boolean;
};

/** Small author/license caption required by free photo licenses. */
export function PhotoCredit({ credit, className = "" }: { credit?: string; className?: string }) {
  if (!credit) return null;
  return (
    <span className={`pointer-events-none absolute right-2 bottom-2 z-10 max-w-[80%] truncate rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] leading-tight text-white/85 ${className}`}>
      {credit}
    </span>
  );
}

/** Photo from Sanity (or /public), or a neutral placeholder block with a caption ("Фото офиса"). */
export function Media({ image, locale, placeholder, alt, sizes, className = "", priority, width = 1600, hideCredit }: Props) {
  if (hasImage(image)) {
    return (
      <div className={`relative overflow-hidden bg-surface ${className}`}>
        <Image
          src={imageUrl(image, width)}
          alt={alt ?? l(image.alt, locale)}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
        {!hideCredit && <PhotoCredit credit={image.credit} />}
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
