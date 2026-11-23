import clsx from "clsx";

const SOFT = ["bg-brand-soft text-brand", "bg-accent-soft text-[#0a7a42]", "bg-warn-soft text-warn", "bg-[#f3e8ff] text-[#7c3aed]", "bg-[#ffe4e6] text-[#be123c]", "bg-[#e0f2fe] text-[#0369a1]"];

/** Round badge with the client's initials; the colour depends on the name, so the same client always looks the same. */
export function Avatar({ name, size = "md", className }: { name: string; size?: "md" | "lg"; className?: string }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = (words.length > 1 ? `${words[0][0]}${words[1][0]}` : (words[0] ?? "?").slice(0, 2)).toUpperCase();
  let sum = 0;
  for (const ch of name) sum = (sum + ch.charCodeAt(0)) % 997;
  return (
    <span aria-hidden className={clsx("flex shrink-0 items-center justify-center rounded-full font-bold", SOFT[sum % SOFT.length], size === "lg" ? "h-16 w-16 text-[22px]" : "h-11 w-11 text-[15px]", className)}>
      {letters}
    </span>
  );
}
