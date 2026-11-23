"use client";

import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/admin/actions";
import { AppLock, LockToggle, type LockText } from "@/components/pwa/AppLock";

const TEXT: LockText = {
  offerTitle: "Защитить админку на телефоне?",
  offerText: "Если телефон пролежал без дела 5 минут, AlemWay попросит PIN или отпечаток пальца.",
  enable: "Включить",
  notNow: "Не сейчас",
  setupTitle: "Придумайте PIN из 4 цифр",
  repeatTitle: "Повторите PIN",
  setupHint: "Потом телефон попросит приложить палец, если он это умеет.",
  mismatch: "PIN не совпал. Придумайте заново.",
  lockedTitle: "AlemWay заблокирован",
  enterPin: (name) => `${name}, введите PIN`,
  wrongPin: (left) => `Неверный PIN. Осталось попыток: ${left}`,
  bioButton: "Отпечаток пальца",
  bioPrompt: "Вход в AlemWay",
  forgot: "Забыли PIN? Выйти и войти паролем",
  cancel: "Отмена",
  erase: "Стереть",
  turnOn: "Включить блокировку (PIN, отпечаток)",
  turnOff: "Выключить блокировку на этом телефоне",
  isOn: "Блокировка включена",
  isOff: "Блокировка выключена",
  confirmOff: "Выключить блокировку на этом телефоне?",
};

/** The team's lock: offered on the admin's main page and in «Чаты» (where the app opens). */
export function StaffLock({ login, name }: { login: string; name: string }) {
  const path = usePathname();
  return <AppLock login={login} name={name} text={TEXT} onLogout={() => logoutAction()} offerHere={path === "/admin" || path === "/admin/chats"} />;
}

export function StaffLockToggle({ login, compact }: { login: string; compact?: boolean }) {
  return <LockToggle login={login} compact={compact} text={TEXT} />;
}
