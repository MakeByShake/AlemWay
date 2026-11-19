/**
 * Cyrillic (Russian + Kazakh) → Latin, the way names are written in Kazakh passports
 * (Ерлан → Yerlan, Жанель → Zhanel, Қуаныш → Kuanysh). No server-only imports: used by forms too.
 */
const MAP: Record<string, string> = {
  а: "a", ә: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "i",
  к: "k", қ: "k", л: "l", м: "m", н: "n", ң: "n", о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ұ: "u", ү: "u", ф: "f", х: "kh", һ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", і: "i",
  ь: "", э: "e", ю: "yu", я: "ya",
  // Latin schwa sometimes typed instead of Cyrillic «ә».
  ə: "a",
};

export const hasCyrillic = (s: string | undefined | null) => /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІіƏə]/.test(s ?? "");

const titleWord = (w: string) => w.split("-").map((p) => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p)).join("-");

/** One word: «ЕСИМОВ» → «Yesimov». Latin words only get Title Case. */
function latinWord(word: string) {
  if (!hasCyrillic(word)) return titleWord(word);
  const lower = word.toLowerCase();
  let out = "";
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    // Е at the start of a word is «Ye» in passports (Ерлан → Yerlan).
    if (ch === "е" && (i === 0 || lower[i - 1] === "-")) out += "ye";
    else out += MAP[ch] ?? ch;
  }
  return titleWord(out);
}

// Patronymics: «…ұлы / …улы / …қызы / …кызы / …ович / …овна» as the 3rd word.
const PATRONYMIC = /(ұлы|улы|uly|ulu|uulu|қызы|кызы|kyzy|qyzy|ович|евич|ич|овна|евна|ична|ovich|evich|ovna|evna)$/i;

/** «ЕСИМОВ ОРАЛХАН МУРАТҰЛЫ» → «Yesimov Oralkhan» (word order kept, patronymic dropped). */
export function latinName(name: string | undefined | null) {
  const words = (name ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  // «… ASHIRBAY KIZI» — a patronymic written as two words.
  if (words.length >= 4 && /^(kizi|kyzy|qyzy|uly|ulu|uulu|қызы|кызы|ұлы|улы)$/i.test(words[words.length - 1])) words.splice(-2);
  else if (words.length >= 3 && PATRONYMIC.test(words[words.length - 1])) words.pop();
  return words.map(latinWord).join(" ");
}

/** Only Latin letters, spaces, hyphens and apostrophes — what the team must type for a new client. */
export const LATIN_NAME_RE = /^[A-Za-z][A-Za-z' -]*[A-Za-z]$/;
