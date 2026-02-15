import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-950 text-slate-50">
      <h1 className="text-2xl font-bold mb-4">PV Speicher</h1>
      <Link
        href="/speicher"
        className="text-amber-400 hover:text-amber-300 underline"
      >
        Zum Speicher-Rechner
      </Link>
    </main>
  );
}
