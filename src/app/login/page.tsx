"use client";

import { useActionState } from "react";
import { Logo } from "@/components/Logo";
import { login, type LoginState } from "./actions";

const initial: LoginState = { error: null };

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-xl font-bold">התייעצות מומחים</h1>
            <p className="text-sm text-muted">כניסה עם המשתמש של מודול קשרי מרפאות</p>
          </div>
        </div>

        <form action={action} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="label">שם משתמש או מייל</span>
            <input
              className="input"
              type="text"
              name="username"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="username"
              dir="ltr"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">סיסמה</span>
            <input
              className="input"
              type="password"
              name="password"
              autoComplete="current-password"
              dir="ltr"
              required
            />
          </label>

          {state.error && (
            <p role="alert" className="alert-error">
              {state.error}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "נכנסים…" : "כניסה"}
          </button>
        </form>
      </div>
    </main>
  );
}
