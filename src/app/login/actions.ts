"use server";

import { redirect } from "next/navigation";
import { loginEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "יש למלא שם משתמש וסיסמה" };
  }

  // Same accounts as the clinic contacts module: username → <username>@<AUTH_USERNAME_DOMAIN>.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: loginEmail(username),
    password,
  });

  if (error) {
    return { error: "שם המשתמש או הסיסמה לא נכונים" };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
