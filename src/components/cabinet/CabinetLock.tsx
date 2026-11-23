"use client";

import { AppLock, LockToggle, type LockText } from "@/components/pwa/AppLock";
import { clearOffline } from "@/components/pwa/offline-docs";
import type { CabinetLocale } from "@/lib/cabinet/i18n";

const TEXT: Record<CabinetLocale, LockText> = {
  ru: {
    offerTitle: "Защитить кабинет на телефоне?",
    offerText: "В кабинете ваш паспорт и документы. Если телефон пролежал 5 минут, AlemWay попросит PIN или отпечаток пальца.",
    enable: "Включить",
    notNow: "Не сейчас",
    setupTitle: "Придумайте PIN из 4 цифр",
    repeatTitle: "Повторите PIN",
    setupHint: "Потом телефон попросит приложить палец, если он это умеет.",
    mismatch: "PIN не совпал. Придумайте заново.",
    lockedTitle: "Кабинет заблокирован",
    enterPin: () => "Введите PIN",
    wrongPin: (left) => `Неверный PIN. Осталось попыток: ${left}`,
    bioButton: "Отпечаток пальца",
    bioPrompt: "Вход в кабинет AlemWay",
    forgot: "Забыли PIN? Выйти и войти по своей ссылке",
    cancel: "Отмена",
    erase: "Стереть",
    turnOn: "Включить PIN на этом телефоне",
    turnOff: "Выключить PIN на этом телефоне",
    isOn: "PIN включён",
    isOff: "PIN выключен",
    confirmOff: "Выключить PIN на этом телефоне?",
  },
  kk: {
    offerTitle: "Кабинетті телефонда қорғау керек пе?",
    offerText: "Кабинетте төлқұжатыңыз бен құжаттарыңыз бар. Телефон 5 минут тұрып қалса, AlemWay PIN немесе саусақ ізін сұрайды.",
    enable: "Қосу",
    notNow: "Қазір емес",
    setupTitle: "4 саннан тұратын PIN ойлап табыңыз",
    repeatTitle: "PIN-ді қайталаңыз",
    setupHint: "Содан кейін телефон саусақ ізін сұрайды, егер ол мүмкін болса.",
    mismatch: "PIN сәйкес келмеді. Қайта ойлап табыңыз.",
    lockedTitle: "Кабинет құлыпталған",
    enterPin: () => "PIN енгізіңіз",
    wrongPin: (left) => `PIN қате. Қалған әрекет: ${left}`,
    bioButton: "Саусақ ізі",
    bioPrompt: "AlemWay кабинетіне кіру",
    forgot: "PIN есіңізде жоқ па? Шығып, өз сілтемеңізбен кіріңіз",
    cancel: "Болдырмау",
    erase: "Өшіру",
    turnOn: "Осы телефонда PIN қосу",
    turnOff: "Осы телефонда PIN өшіру",
    isOn: "PIN қосулы",
    isOff: "PIN өшірулі",
    confirmOff: "Осы телефонда PIN өшірілсін бе?",
  },
};

const OWNER = "client";

/** Logging out forgets this phone's PIN too, so the next person on the phone starts clean. */
export function clearCabinetLock() {
  try {
    localStorage.removeItem(`aw-lock:${OWNER}`);
  } catch {}
}

async function logout() {
  clearCabinetLock();
  await clearOffline();
  await fetch("/api/cabinet/logout", { method: "POST" }).catch(() => null);
  window.location.reload();
}

/** The client's own lock of the cabinet (and its chat): PIN and fingerprint, only if the client turns it on. */
export function CabinetLock({ locale, offer = false }: { locale: CabinetLocale; offer?: boolean }) {
  return <AppLock login={OWNER} name="" text={TEXT[locale]} onLogout={logout} offerHere={offer} offerInline />;
}

export function CabinetLockToggle({ locale }: { locale: CabinetLocale }) {
  return <LockToggle login={OWNER} compact text={TEXT[locale]} />;
}
