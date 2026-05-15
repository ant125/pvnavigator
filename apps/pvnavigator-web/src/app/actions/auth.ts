"use server";

import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type SignUpFormState = {
  error: string;
  success: boolean;
  needsConfirmation: boolean;
};

const initialSignUpState: SignUpFormState = {
  error: "",
  success: false,
  needsConfirmation: false,
};

function germanAuthMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-Mail-Adresse oder Passwort ist ungültig.";
  if (m.includes("email not confirmed")) return "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.";
  if (m.includes("user already registered")) return "Es existiert bereits ein Konto mit dieser E-Mail-Adresse.";
  return message;
}

export async function signUpAction(
  _prev: SignUpFormState,
  formData: FormData,
): Promise<SignUpFormState> {
  if (!isSupabaseConfigured()) {
    return { ...initialSignUpState, error: "Anmeldung ist nicht konfiguriert." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");

  if (!email || !password) {
    return { ...initialSignUpState, error: "Bitte E-Mail und Passwort eingeben." };
  }

  if (password !== passwordConfirm) {
    return { ...initialSignUpState, error: "Die Passwörter stimmen nicht überein." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { ...initialSignUpState, error: germanAuthMessage(error.message) };
  }

  if (data.session) {
    redirect("/konto");
  }

  return {
    error: "",
    success: true,
    needsConfirmation: true,
  };
}

export type SignInFormState = {
  error: string;
};

export async function signInAction(_prev: SignInFormState, formData: FormData): Promise<SignInFormState> {
  if (!isSupabaseConfigured()) {
    return { error: "Anmeldung ist nicht konfiguriert." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextRaw = formData.get("next");
  const next = sanitizeNextPath(nextRaw, "/konto");

  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: germanAuthMessage(error.message) };
  }

  redirect(next);
}

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
