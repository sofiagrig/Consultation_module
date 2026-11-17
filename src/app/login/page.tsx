"use client";

import { useActionState } from "react";
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
            <span className="label">שם משתמש</span>
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

function Logo() {
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-brand">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 3c-2.5 0-4 2-4 4.5 0 3 1.5 4.5 2 7 .5 3 1 6.5 3 6.5 1.5 0 1.5-4 4-4s2.5 4 4 4c2 0 2.5-3.5 3-6.5.5-2.5 2-4 2-7C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z" />
      </svg>
    </div>
  );
}
