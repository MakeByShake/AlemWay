/**
 * Questionnaires of the personal cabinets (Ferienjob and K-ETA).
 * One description per service drives the client form, server validation, the admin schema and,
 * for Ferienjob, the ZAV declaration PDF. Shared by client and server code — no server-only imports.
 */

/** WhatsApp for clients' questions from the personal cabinet. */
export const CABINET_SUPPORT_WHATSAPP = "77775882949";

export type ServiceId = "ferienjob" | "keta";
export const SERVICE_IDS: ServiceId[] = ["ferienjob", "keta"];
export const serviceOf = (v: string | undefined | null): ServiceId => (v === "keta" ? "keta" : "ferienjob");

export type FieldKind = "text" | "date" | "number" | "email" | "url" | "tel" | "yesno" | "select";
export type FieldOption = { value: string; label: { ru: string; kk: string } };

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
  /** For kind "select". */
  options?: FieldOption[];
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

/**
 * K-ETA (Korea Electronic Travel Authorization), per the official k-eta.go.kr guide (checked 05.11.2026):
 * passport, e-mail, ID photo; travel information = purpose, address of stay, contact, arrival/departure
 * dates, accompanying persons. Kazakhstan: up to 30 days in a row, max 60 days within 180 days.
 * Exempt: aged 17 or younger / 65 or older on the date of entry. Validity 3 years (not beyond passport).
 */
export const KETA_SECTIONS: CabinetSection[] = [
  {
    id: "keta_passport",
    title: { ru: "Паспорт", kk: "Паспорт" },
    fields: [
      { key: "lastName", kind: "text", latin: true, maxLength: 60, label: { ru: "Фамилия (как в загранпаспорте)", kk: "Тегі (шетелдік паспорттағыдай)" }, placeholder: "NURLANOVA" },
      { key: "firstName", kind: "text", latin: true, maxLength: 60, label: { ru: "Имя (как в загранпаспорте)", kk: "Аты (шетелдік паспорттағыдай)" }, placeholder: "AIGERIM" },
      {
        key: "sex",
        kind: "select",
        label: { ru: "Пол", kk: "Жынысы" },
        options: [
          { value: "F", label: { ru: "Женский", kk: "Әйел" } },
          { value: "M", label: { ru: "Мужской", kk: "Ер" } },
        ],
      },
      { key: "birthDate", kind: "date", label: { ru: "Дата рождения", kk: "Туған күні" } },
      { key: "passportNumber", kind: "text", latin: true, maxLength: 20, label: { ru: "Номер загранпаспорта", kk: "Шетелдік паспорт нөмірі" }, placeholder: "N12345678" },
      {
        key: "passportExpiry",
        kind: "date",
        label: { ru: "Паспорт действует до", kk: "Паспорт жарамды" },
        hint: { ru: "K-ETA действует 3 года, но не дольше паспорта.", kk: "K-ETA 3 жыл жарамды, бірақ паспорттан ұзақ емес." },
      },
    ],
  },
  {
    id: "keta_contacts",
    title: { ru: "Контакты", kk: "Байланыс" },
    fields: [
      {
        key: "email",
        kind: "email",
        maxLength: 80,
        label: { ru: "Email", kk: "Email" },
        hint: {
          ru: "Сюда K-ETA пришлёт результат. Сейчас K-ETA предупреждает о задержках писем на Gmail — если есть другая почта, лучше укажите её.",
          kk: "K-ETA нәтижесі осы поштаға келеді. Қазір K-ETA Gmail-ге хаттар кешігуі мүмкін деп ескертеді — басқа пошта болса, соны жазыңыз.",
        },
        placeholder: "name@mail.ru",
      },
      { key: "phone", kind: "tel", maxLength: 20, label: { ru: "Номер телефона", kk: "Телефон нөмірі" }, placeholder: "+7 777 123 45 67" },
    ],
  },
  {
    id: "keta_job",
    title: { ru: "Работа или учёба", kk: "Жұмыс немесе оқу" },
    fields: [
      {
        key: "occupation",
        kind: "select",
        label: { ru: "Кем вы сейчас являетесь", kk: "Қазір кімсіз" },
        options: [
          { value: "employee", label: { ru: "Работаю по найму", kk: "Жалдамалы жұмыс" } },
          { value: "business", label: { ru: "Свой бизнес / ИП", kk: "Өз бизнесім / ЖК" } },
          { value: "student", label: { ru: "Студент / школьник", kk: "Студент / оқушы" } },
          { value: "homemaker", label: { ru: "Домохозяйка", kk: "Үй шаруасындағы" } },
          { value: "unemployed", label: { ru: "Не работаю", kk: "Жұмыссыз" } },
          { value: "retired", label: { ru: "Пенсионер", kk: "Зейнеткер" } },
        ],
      },
      {
        key: "employer",
        kind: "text",
        latin: true,
        optional: true,
        maxLength: 100,
        label: { ru: "Место работы или учёбы (латиницей)", kk: "Жұмыс немесе оқу орны (латынша)" },
        hint: { ru: "Если не работаете и не учитесь — оставьте пустым.", kk: "Жұмыс істемесеңіз және оқымасаңыз — бос қалдырыңыз." },
        placeholder: "Kaspi Bank",
      },
      { key: "jobTitle", kind: "text", latin: true, optional: true, maxLength: 60, label: { ru: "Должность (латиницей)", kk: "Лауазымы (латынша)" }, placeholder: "Manager" },
    ],
  },
  {
    id: "keta_trip",
    title: { ru: "Поездка в Корею", kk: "Кореяға сапар" },
    fields: [
      {
        key: "purpose",
        kind: "select",
        label: { ru: "Цель поездки", kk: "Сапар мақсаты" },
        hint: {
          ru: "По K-ETA нельзя работать за деньги — только туризм, гости, деловые встречи, мероприятия.",
          kk: "K-ETA бойынша ақылы жұмыс істеуге болмайды — тек туризм, қонаққа бару, іскерлік кездесу, іс-шара.",
        },
        options: [
          { value: "tourism", label: { ru: "Туризм", kk: "Туризм" } },
          { value: "family", label: { ru: "Навестить родственников или друзей", kk: "Туыстарға немесе достарға бару" } },
          { value: "business", label: { ru: "Деловая поездка (без работы за деньги)", kk: "Іскерлік сапар (ақылы жұмыссыз)" } },
          { value: "event", label: { ru: "Мероприятие или конференция", kk: "Іс-шара немесе конференция" } },
          { value: "medical", label: { ru: "Лечение", kk: "Емделу" } },
          { value: "other", label: { ru: "Другое", kk: "Басқа" } },
        ],
      },
      { key: "arrivalDate", kind: "date", label: { ru: "Дата въезда в Корею", kk: "Кореяға келу күні" } },
      {
        key: "departureDate",
        kind: "date",
        label: { ru: "Дата выезда из Кореи", kk: "Кореядан кету күні" },
        hint: { ru: "Без визы — до 30 дней подряд и не больше 60 дней за 180 дней.", kk: "Визасыз — қатарынан 30 күнге дейін және 180 күнде 60 күннен аспайды." },
      },
      {
        key: "stayAddress",
        kind: "text",
        latin: true,
        maxLength: 160,
        label: { ru: "Где будете жить в Корее (название и адрес латиницей)", kk: "Кореяда қайда тұрасыз (атауы мен мекенжайы латынша)" },
        hint: { ru: "Отель или адрес родственников. Можно скопировать из брони.", kk: "Қонақүй немесе туыстардың мекенжайы. Броньдан көшіруге болады." },
        placeholder: "Lotte Hotel Seoul, 30 Eulji-ro, Jung-gu, Seoul",
      },
      { key: "stayPhone", kind: "tel", optional: true, maxLength: 25, label: { ru: "Телефон отеля или принимающей стороны", kk: "Қонақүйдің немесе қабылдаушының телефоны" }, placeholder: "+82 2 771 1000" },
      {
        key: "companions",
        kind: "text",
        latin: true,
        optional: true,
        maxLength: 200,
        label: { ru: "С кем едете (ФИО латиницей)", kk: "Кіммен барасыз (аты-жөні латынша)" },
        hint: { ru: "Если едете один — оставьте пустым.", kk: "Жалғыз барсаңыз — бос қалдырыңыз." },
      },
    ],
  },
  {
    id: "keta_questions",
    title: { ru: "Вопросы анкеты K-ETA", kk: "K-ETA сауалнамасының сұрақтары" },
    fields: [
      { key: "visitedKorea", kind: "yesno", defaultValue: "no", label: { ru: "Вы уже были в Корее?", kk: "Кореяда болдыңыз ба?" } },
      { key: "criminalRecord", kind: "yesno", defaultValue: "no", label: { ru: "Есть ли у вас судимость в какой-либо стране?", kk: "Қандай да бір елде сотталғансыз ба?" } },
      {
        key: "infectiousDisease",
        kind: "yesno",
        defaultValue: "no",
        label: { ru: "Есть ли у вас сейчас инфекционное заболевание (например, туберкулёз)?", kk: "Қазір жұқпалы ауруыңыз бар ма (мысалы, туберкулез)?" },
      },
    ],
  },
];

export const CABINET_FIELDS: CabinetField[] = CABINET_SECTIONS.flatMap((s) => s.fields);
export const KETA_FIELDS: CabinetField[] = KETA_SECTIONS.flatMap((s) => s.fields);

export const sectionsFor = (service: ServiceId) => (service === "keta" ? KETA_SECTIONS : CABINET_SECTIONS);
export const fieldsFor = (service: ServiceId) => (service === "keta" ? KETA_FIELDS : CABINET_FIELDS);
/** Every field of every service, once (for the admin schema). */
export const ALL_FIELDS: CabinetField[] = [...CABINET_FIELDS, ...KETA_FIELDS].filter((f, i, all) => all.findIndex((x) => x.key === f.key) === i);
export const SERVICE_TITLES: Record<ServiceId, { ru: string; kk: string }> = {
  ferienjob: { ru: "Летняя работа в Германии (Ferienjob)", kk: "Германиядағы жазғы жұмыс (Ferienjob)" },
  keta: { ru: "K-ETA в Южную Корею", kk: "Оңтүстік Кореяға K-ETA" },
};

export type CabinetData = Partial<Record<string, string>>;

/** Files the client uploads (any service). */
export const UPLOAD_KINDS = ["passport", "enrollment", "signed", "photo"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];
/** Every file kept for a cabinet (ZAV declaration is generated by the server; ZAV and K-ETA approval come from the manager). */
export const FILE_KINDS = ["passport", "enrollment", "declaration", "signed", "zav", "photo", "keta"] as const;
export type FileKind = (typeof FILE_KINDS)[number];
/** Files the manager can upload or replace from the admin panel. */
export const MANAGER_UPLOAD_KINDS = ["zav", "declaration", "signed", "passport", "enrollment", "keta", "photo"] as const satisfies readonly FileKind[];
export type ManagerUploadKind = (typeof MANAGER_UPLOAD_KINDS)[number];

/** Which files belong to each service, in the order the manager sees them (first = the one the manager adds). */
export const SERVICE_FILES: Record<ServiceId, { all: FileKind[]; client: UploadKind[]; requiredBeforeSubmit: UploadKind[] }> = {
  ferienjob: { all: ["zav", "passport", "enrollment", "declaration", "signed"], client: ["passport", "enrollment", "signed"], requiredBeforeSubmit: ["passport", "enrollment"] },
  keta: { all: ["keta", "passport", "photo"], client: ["passport", "photo"], requiredBeforeSubmit: ["passport", "photo"] },
};

export const FILE_LABELS: Record<FileKind, { ru: string; kk: string }> = {
  passport: { ru: "Скан загранпаспорта (разворот с фото)", kk: "Шетелдік паспорт сканы (фотосы бар бет)" },
  enrollment: { ru: "Справка с места учёбы на английском с печатью", kk: "Оқу орнынан ағылшынша анықтама, мөрімен" },
  declaration: { ru: "Декларация ZAV", kk: "ZAV декларациясы" },
  signed: { ru: "Декларация с подписью и печатью деканата", kk: "Деканат қолы мен мөрі қойылған декларация" },
  zav: { ru: "Разрешение ZAV (Zustimmung)", kk: "ZAV рұқсаты (Zustimmung)" },
  photo: { ru: "Фото лица, как на документы", kk: "Құжатқа арналған бет суреті" },
  keta: { ru: "Одобренный K-ETA", kk: "Мақұлданған K-ETA" },
};

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel functions accept ~4.5 MB per request.

export const CABINET_STATUSES = [
  { value: "waiting_data", title: "Ждём данные клиента" },
  { value: "declaration_ready", title: "Декларация готова — ждём подпись" },
  // Value kept for existing cabinets: the signed declaration is in, the team now waits for ZAV.
  { value: "signed_uploaded", title: "✅ Готово — подписанная декларация получена" },
  { value: "zav_received", title: "ZAV получен — контракт есть" },
  { value: "keta_applying", title: "K-ETA: данные получены — подаём заявку" },
  { value: "keta_applied", title: "K-ETA: подано — ждём решения (до 72 ч)" },
  { value: "keta_approved", title: "K-ETA: одобрено" },
  { value: "keta_rejected", title: "K-ETA: отказ" },
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

export type FieldError = "required" | "latin" | "date" | "email" | "url" | "number" | "phone" | "order" | "stay30" | "passportExpiry";

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
    case "select":
      return f.options?.some((o) => o.value === v) ? null : "required";
    default:
      return null;
  }
}

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/** Validates the whole questionnaire of a service, including date order and K-ETA stay rules. */
export function validateCabinetData(data: CabinetData, service: ServiceId = "ferienjob"): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {};
  for (const f of fieldsFor(service)) {
    const e = validateField(f, data[f.key]);
    if (e) errors[f.key] = e;
  }
  const ok = (...keys: string[]) => keys.every((k) => !errors[k] && data[k]);
  const before = (a: string, b: string) => ok(a, b) && data[a]! >= data[b]!;
  if (service === "ferienjob") {
    if (before("breakFrom", "breakTo")) errors.breakTo = "order";
    if (before("enrolledSince", "studyEnd")) errors.studyEnd = "order";
  } else {
    if (before("arrivalDate", "departureDate")) errors.departureDate = "order";
    // Kazakhstan: visa-free stay up to 30 days in a row (the day of arrival counts).
    else if (ok("arrivalDate", "departureDate") && daysBetween(data.arrivalDate!, data.departureDate!) + 1 > 30) errors.departureDate = "stay30";
    if (ok("passportExpiry", "departureDate") && data.passportExpiry! <= data.departureDate!) errors.passportExpiry = "passportExpiry";
  }
  return errors;
}

export type KetaNotice = "ageExempt" | "tooSoon";

/** Soft K-ETA warnings that don't block sending: exempt by age, too close to the trip for the 72-hour review. */
export function ketaNotices(data: CabinetData, todayIso: string): KetaNotice[] {
  const out: KetaNotice[] = [];
  const birth = data.birthDate;
  const arrival = data.arrivalDate;
  if (birth && arrival && isRealDate(birth) && isRealDate(arrival)) {
    const [by, bm, bd] = birth.split("-").map(Number);
    const [ay, am, ad] = arrival.split("-").map(Number);
    const age = ay - by - (am < bm || (am === bm && ad < bd) ? 1 : 0);
    if (age <= 17 || age >= 65) out.push("ageExempt");
  }
  if (arrival && isRealDate(arrival) && daysBetween(todayIso, arrival) < 4) out.push("tooSoon");
  return out;
}

/** Keeps only known fields, trimmed and length-limited. */
export function sanitizeCabinetData(input: unknown, service: ServiceId = "ferienjob"): CabinetData {
  const src = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const out: CabinetData = {};
  for (const f of fieldsFor(service)) {
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
  stay30: { ru: "Без визы можно не больше 30 дней подряд", kk: "Визасыз қатарынан 30 күннен аспауы керек" },
  passportExpiry: { ru: "Паспорт должен действовать дольше поездки", kk: "Паспорт сапардан ұзағырақ жарамды болуы керек" },
};
