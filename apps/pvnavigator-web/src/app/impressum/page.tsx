import Link from "next/link";

export default function ImpressumPage() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-6">Impressum</h1>
        <p className="text-slate-400 mb-8">Impressum folgt.</p>
        <Link
          href="/"
          className="inline-flex px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm transition-colors"
        >
          ← Zurück
        </Link>
      </div>
    </div>
  );
}
