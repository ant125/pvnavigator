export function AuthEnvMissing() {
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p className="font-semibold">Konfiguration unvollständig</p>
      <p className="mt-1 leading-relaxed text-amber-900/90">
        Die Umgebungsvariablen{" "}
        <code className="rounded bg-white/80 px-1 py-0.5 text-[13px]">NEXT_PUBLIC_SUPABASE_URL</code> und{" "}
        <code className="rounded bg-white/80 px-1 py-0.5 text-[13px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
        sind nicht gesetzt. Bitte konfigurieren Sie Supabase gemäß README.
      </p>
    </div>
  );
}
