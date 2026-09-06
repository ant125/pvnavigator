"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
