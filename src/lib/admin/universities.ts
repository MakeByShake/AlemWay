/** One short name per university, so «КазНу», «Al-Farabi Kazakh National University» and so on count as one. */
const UNIS: [RegExp, string][] = [
  [/IITU|information technologies|МУИТ/i, "МУИТ (IITU)"],
  [/narxoz|нархоз/i, "Narxoz"],
  [/\bSDU\b|СДУ|Сулейман/i, "SDU"],
  [/satpayev|satbayev|сатпаев|сатбаев|КазНИТУ/i, "Satbayev University"],
  [/al-?\s?farabi|аль-?\s?фараби|kaznu|казну/i, "КазНУ им. аль-Фараби"],
  [/saginov|сагинов|karaganda technical|карагандинский техн/i, "КарТУ им. Сагинова"],
  [/karaganda medical|медицинский университет караганд/i, "Медуниверситет Караганды"],
  [/abai|абай/i, "КазНПУ им. Абая"],
  [/zhubanov|жубанов/i, "Актюбинский им. Жубанова"],
  [/civil aviation|гражданской\s*авиации/i, "Академия гражданской авиации"],
  [/ablai|абылай/i, "КазУМОиМЯ им. Абылай хана"],
  [/kimep|кимэп/i, "KIMEP"],
  [/sagadiyev|international business|\bUIB\b/i, "UIB (Сагадиев)"],
  [/kulazhanov|кулажанов|казутб|kazutb|technology and business/i, "КазУТБ"],
  [/gumil|гумил|\bENU\b|\bЕНУ\b/i, "ЕНУ им. Гумилёва"],
  [/seifullin|сейфуллин/i, "КАТУ им. Сейфуллина"],
  [/asfendiyarov|асфендияров/i, "КазНМУ им. Асфендиярова"],
  [/semey|семей/i, "Медуниверситет Семей"],
  [/АУЭС|AUES|energy and communication|энергетики и связи/i, "АУЭС"],
  [/south kazakhstan medical|южно-казахстанская медицинская/i, "ЮКМА (Шымкент)"],
  [/auezov|ауэзов/i, "ЮКУ им. Ауэзова"],
  [/tashenev|ташенев|ташенов/i, "Tashenev University"],
  [/utemisov|утемисов/i, "ЗКУ им. Утемисова"],
  [/zhangir|жангир|ЗКАТУ/i, "ЗКАТУ им. Жангир хана"],
  [/atyrau|атырау/i, "Атырауский им. Досмухамедова"],
  [/nazarbayev university|назарбаев университет/i, "Nazarbayev University"],
  [/astana international|\bAIU\b|\bАМУ\b/i, "AIU (Астана)"],
  [/almaty technological|алматинский технологический/i, "Алматинский технологический"],
  [/kazakh[- ]american|казахстанско-американ|казахско-американ/i, "KAU (Казахско-Американский)"],
  [/miras|мирас/i, "Miras"],
];

export const NO_UNI = "—";

/** Known universities (short names) — hints in the «new client» form. */
export const UNI_NAMES = [...new Set(UNIS.map(([, name]) => name))].sort((a, b) => a.localeCompare(b, "ru"));

/** Short university name for lists and filters; unknown names are shown cleaned up, empty ones as «—». */
export function uniShort(raw?: string | null): string {
  const s = (raw ?? "").trim();
  if (!s) return NO_UNI;
  for (const [re, name] of UNIS) if (re.test(s)) return name;
  return s
    .replace(/\b(Non-Profit|NCJSC|NJSC|NPJSC|NLC|JSC|LLP|АО|НАО|ТОО)\b/gi, "")
    .replace(/["«»<>]/g, "")
    .replace(/\s+/g, " ")
    .trim() || NO_UNI;
}
