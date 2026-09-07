"use server";

import { redirect } from "next/navigation";

import {
  getEmailConfirmationRedirectUrl,
  mapSupabaseAuthErrorToUserMessage,
} from "@/lib/auth";
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

  const supabase = await createServerSupabaseClient({ persistCookies: true });
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getEmailConfirmationRedirectUrl(),
    },
  });

  if (error) {
    return { ...initialSignUpState, error: mapSupabaseAuthErrorToUserMessage(error) };
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
