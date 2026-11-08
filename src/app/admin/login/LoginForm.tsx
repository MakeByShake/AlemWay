"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";
import { SubmitButton } from "@/components/admin/ui";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="mt-6 grid gap-4">
      <label className="grid gap-1.5 text-[14px] font-medium">
        Логин
        <input name="login" defaultValue={state?.login} autoComplete="username" autoCapitalize="none" required className="field" />
      </label>
      <label className="grid gap-1.5 text-[14px] font-medium">
        Пароль
        <input name="password" type="password" autoComplete="current-password" required className="field" />
      </label>
      {state?.error && <p className="rounded-lg bg-warn-soft px-3 py-2 text-[14px] text-warn">{state.error}</p>}
      <SubmitButton className="btn-primary mt-1 w-full" pendingText="Входим…">
        Войти
      </SubmitButton>
    </form>
  );
}
