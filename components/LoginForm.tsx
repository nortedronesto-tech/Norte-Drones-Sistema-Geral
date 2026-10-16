"use client";

import { useActionState } from "react";
import { signIn } from "@/app/login/actions";
import { btn, FormError, inputClass, labelClass } from "./ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label htmlFor="email" className={labelClass}>E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state?.email} required className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </div>
      <FormError message={state?.error} />
      <button type="submit" disabled={pending} className={`${btn.primary} w-full`}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
