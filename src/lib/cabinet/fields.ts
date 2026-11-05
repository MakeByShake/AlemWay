/**
 * Questionnaire of the Ferienjob personal cabinet.
 * One list drives the client form, server validation, the admin schema and the ZAV declaration PDF.
 * Shared by client and server code — keep it free of server-only imports.
 */

export type FieldKind = "text" | "date" | "number" | "email" | "url" | "tel" | "yesno";

export type CabinetField = {
  key: string;
  /** Field name in the official PDF form (src/assets/zav-declaration-blank.pdf). */
  pdf?: string;
  kind: FieldKind;
  label: { ru: string; kk: string };
  hint?: { ru: string; kk: string };
  placeholder?: string;
  /** Latin letters only — the declaration is in English and must match the passport. */
  latin?: boolean;
  optional?: boolean;
  defaultValue?: string;
  maxLength?: number;
};

export type CabinetSection = { id: string; title: { ru: string; kk: string }; fields: CabinetField[] };

export const CABINET_SECTIONS: CabinetSection[] = [
  {
    id: "student",
    title: { ru: "Студент", kk: "Студент" },
    fields: [
      {
        key: "firstName",
        pdf: "txtfPersonVorname",
        kind: "text",
        latin: true,
        maxLength: 60,
        label: { ru: "Имя (как в загранпаспорте)", kk: "Аты (шетелдік паспорттағыдай)" },
        placeholder: "Aigerim",
      },
      {
        key: "lastName",
        pdf: "txtfPersonNachname",
        kind: "text",
        latin: true,
        maxLength: 60,
        label: { ru: "Фамилия (как в загранпаспорте)", kk: "Тегі (шетелдік паспорттағыдай)" },
        placeholder: "Nurlanova",
      },
      { key: "birthDate", pdf: "datePersonGebDatum", kind: "date", label: { ru: "Дата рождения", kk: "Туған күні" } },
      {
        key: "nationality",
        pdf: "txtfPersonNationalitaet",
        kind: "text",
        latin: true,
        maxLength: 40,
        defaultValue: "Kasachstan",
        label: { ru: "Гражданство (по-немецки)", kk: "Азаматтығы (немісше)" },
        hint: { ru: "Для Казахстана — Kasachstan.", kk: "Қазақстан үшін — Kasachstan." },
      },
      { key: "phone", kind: "tel", maxLength: 20, label: { ru: "Номер телефона", kk: "Телефон нөмірі" }, placeholder: "+7 777 123 45 67" },
      {
        key: "city",
        kind: "text",
        maxLength: 60,
        label: { ru: "Город проживания", kk: "Тұратын қаласы" },
        placeholder: "Алматы",
      },
      {
        key: "driverLicense",
        kind: "text",
        optional: true,
        maxLength: 20,
        label: { ru: "Категория прав", kk: "Жүргізуші куәлігінің санаты" },
        hint: { ru: "Если прав нет — оставьте пустым.", kk: "Куәлік жоқ болса, бос қалдырыңыз." },
        placeholder: "B",
      },
    ],
  },
  {
    id: "university",
    title: { ru: "Университет", kk: "Университет" },
    fields: [
      {
        key: "uniName",
        pdf: "txtfDritteName",
        kind: "text",
        latin: true,
        maxLength: 120,
        label: { ru: "Полное название университета (на немецком)", kk: "Университеттің толық атауы (немісше)" },
        hint: {
          ru: "Не знаете немецкое название — напишите на английском, менеджер переведёт.",
          kk: "Немісше атауын білмесеңіз — ағылшынша жазыңыз, менеджер аударады.",
        },
        placeholder: "Kasachische Nationale Al-Farabi-Universität",
      },
      {
        key: "uniStreet",
        pdf: "txtfDritteStr",
        kind: "text",
        latin: true,
        maxLength: 80,
        label: { ru: "Улица университета (латиницей)", kk: "Университет көшесі (латынша)" },
        hint: { ru: "Адрес есть на сайте вуза или в справке.", kk: "Мекенжай ЖОО сайтында немесе анықтамада бар." },
        placeholder: "pr. al-Farabi",
      },
      { key: "uniHouse", pdf: "txtfDritteHausNr", kind: "text", latin: true, maxLength: 12, label: { ru: "Номер дома", kk: "Үй нөмірі" }, placeholder: "71" },
      { key: "uniPostcode", pdf: "txtfDrittePlz", kind: "text", latin: true, maxLength: 12, label: { ru: "Почтовый индекс", kk: "Пошта индексі" }, placeholder: "050040" },
      { key: "uniCity", pdf: "txtfDritteOrt", kind: "text", latin: true, maxLength: 60, label: { ru: "Город университета (латиницей)", kk: "Университет қаласы (латынша)" }, placeholder: "Almaty" },
      { key: "uniPhone", pdf: "txtfDritteTel", kind: "tel", maxLength: 25, label: { ru: "Телефон университета", kk: "Университет телефоны" }, placeholder: "+7 (727) 377-33-33" },
      { key: "uniEmail", pdf: "txtfDritteEmail", kind: "email", maxLength: 80, label: { ru: "Email университета", kk: "Университет email-і" }, placeholder: "info@kaznu.kz" },
      { key: "uniWebsite", pdf: "txtfDritteWeb", kind: "url", maxLength: 100, label: { ru: "Сайт университета", kk: "Университет сайты" }, placeholder: "https://www.kaznu.kz" },
    ],
  },
  {
    id: "study",
    title: { ru: "Учёба", kk: "Оқу" },
    fields: [
      {
        key: "subject",
        pdf: "txtfStudiumFach",
        kind: "text",
        latin: true,
        maxLength: 100,
        label: { ru: "Специальность (на английском)", kk: "Мамандық (ағылшынша)" },
        placeholder: "Computer Science",
      },
      { key: "studyYears", pdf: "txtfStudiumDauer", kind: "number", label: { ru: "Срок обучения, лет", kk: "Оқу мерзімі, жыл" }, placeholder: "4" },
      { key: "enrolledSince", pdf: "dateStudiumSeit", kind: "date", label: { ru: "Дата зачисления в вуз", kk: "ЖОО-ға қабылданған күн" } },
      { key: "studyEnd", pdf: "dateStudiumEnde", kind: "date", label: { ru: "Ожидаемая дата выпуска", kk: "Күтілетін бітіру күні" } },
    ],
  },
  {
    id: "vacation",
    title: { ru: "Летние каникулы", kk: "Жазғы демалыс" },
    fields: [
      {
        key: "breakFrom",
        pdf: "dateStudiumFerienVon",
        kind: "date",
        label: { ru: "Каникулы с", kk: "Демалыс басталуы" },
        hint: { ru: "Точные официальные даты — уточните в деканате.", kk: "Нақты ресми күндер — деканаттан нақтылаңыз." },
      },
      { key: "breakTo", pdf: "dateStudiumFerienBis", kind: "date", label: { ru: "Каникулы по", kk: "Демалыс аяқталуы" } },
      {
        key: "continueStudies",
        pdf: "rbtnStudiumFortsetzung",
        kind: "yesno",
        defaultValue: "yes",
        label: { ru: "После каникул продолжаете учёбу?", kk: "Демалыстан кейін оқуды жалғастырасыз ба?" },
      },
    ],
  },
];

export const CABINET_FIELDS: CabinetField[] = CABINET_SECTIONS.flatMap((s) => s.fields);

export type CabinetData = Partial<Record<string, string>>;

/** Files the client uploads. */
export const UPLOAD_KINDS = ["passport", "enrollment", "signed"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];
/** Every file kept for a cabinet (the declaration is generated by the server, ZAV is uploaded by the manager). */
export const FILE_KINDS = ["passport", "enrollment", "declaration", "signed", "zav"] as const;
export type FileKind = (typeof FILE_KINDS)[number];
/** Files the manager can upload or replace from the admin panel. */
export const MANAGER_UPLOAD_KINDS = ["zav", "declaration", "signed", "passport", "enrollment"] as const satisfies readonly FileKind[];
export type ManagerUploadKind = (typeof MANAGER_UPLOAD_KINDS)[number];

export const FILE_LABELS: Record<FileKind, { ru: string; kk: string }> = {
  passport: { ru: "Скан загранпаспорта (разворот с фото)", kk: "Шетелдік паспорт сканы (фотосы бар бет)" },
  enrollment: { ru: "Справка с места учёбы на английском с печатью", kk: "Оқу орнынан ағылшынша анықтама, мөрімен" },
  declaration: { ru: "Декларация ZAV", kk: "ZAV декларациясы" },
  signed: { ru: "Декларация с подписью и печатью деканата", kk: "Деканат қолы мен мөрі қойылған декларация" },
  zav: { ru: "Разрешение ZAV (Zustimmung)", kk: "ZAV рұқсаты (Zustimmung)" },
};

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel functions accept ~4.5 MB per request.

export const CABINET_STATUSES = [
  { value: "waiting_data", title: "Ждём данные клиента" },
  { value: "declaration_ready", title: "Декларация готова — ждём подпись" },
  // Value kept for existing cabinets: the signed declaration is in, the team now waits for ZAV.
  { value: "signed_uploaded", title: "Ждём ZAV (декларация подписана)" },
  { value: "zav_received", title: "ZAV получен — контракт есть" },
  { value: "done", title: "Завершено" },
] as const;
export type CabinetStatus = (typeof CABINET_STATUSES)[number]["value"];

// Latin letters incl. German ones (ä ö ü ß) and other Latin-1 accents — the form font supports them.
const LATIN = /^[A-Za-z0-9À-ÖØ-öø-ÿ .,'’\-/&()+:#№]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(iso: string) {
  if (!ISO_DATE.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export type FieldError = "required" | "latin" | "date" | "email" | "url" | "number" | "phone" | "order";

/** Validates one value. Returns null when it is fine. */
export function validateField(f: CabinetField, raw: string | undefined): FieldError | null {
  const v = (raw ?? "").trim();
  if (!v) return f.optional ? null : "required";
  if (f.latin && !LATIN.test(v)) return "latin";
  switch (f.kind) {
    case "date":
      return isRealDate(v) ? null : "date";
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "email";
    case "url":
      return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+[^\s]*$/i.test(v) ? null : "url";
    case "number":
      return /^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 10 ? null : "number";
    case "tel":
      return /^\+?[\d\s()-]{7,25}$/.test(v) ? null : "phone";
    case "yesno":
      return v === "yes" || v === "no" ? null : "required";
    default:
      return null;
  }
}

/** Validates the whole questionnaire, including date order. */
export function validateCabinetData(data: CabinetData): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {};
  for (const f of CABINET_FIELDS) {
    const e = validateField(f, data[f.key]);
    if (e) errors[f.key] = e;
  }
  const before = (a: string, b: string) => !errors[a] && !errors[b] && data[a] && data[b] && data[a]! >= data[b]!;
  if (before("breakFrom", "breakTo")) errors.breakTo = "order";
  if (before("enrolledSince", "studyEnd")) errors.studyEnd = "order";
  return errors;
}

/** Keeps only known fields, trimmed and length-limited. */
export function sanitizeCabinetData(input: unknown): CabinetData {
  const src = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const out: CabinetData = {};
  for (const f of CABINET_FIELDS) {
    const v = src[f.key];
    if (typeof v === "string") out[f.key] = v.trim().slice(0, f.maxLength ?? 120);
  }
  return out;
}

/** 2027-06-01 → 01.06.2027 (format used by the German form). */
export function toGermanDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export const FIELD_ERROR_TEXT: Record<FieldError, { ru: string; kk: string }> = {
  required: { ru: "Заполните поле", kk: "Өрісті толтырыңыз" },
  latin: { ru: "Только латиница (можно ä, ö, ü, ß), как в загранпаспорте", kk: "Тек латын әріптері (ä, ö, ü, ß болады), шетелдік паспорттағыдай" },
  date: { ru: "Укажите дату", kk: "Күнді көрсетіңіз" },
  email: { ru: "Проверьте email", kk: "Email-ді тексеріңіз" },
  url: { ru: "Проверьте адрес сайта", kk: "Сайт мекенжайын тексеріңіз" },
  number: { ru: "Число от 1 до 10", kk: "1-ден 10-ға дейінгі сан" },
  phone: { ru: "Проверьте номер", kk: "Нөмірді тексеріңіз" },
  order: { ru: "Дата должна быть позже предыдущей", kk: "Күн алдыңғысынан кейін болуы керек" },
};
