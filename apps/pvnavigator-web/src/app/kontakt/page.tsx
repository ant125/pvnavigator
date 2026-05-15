import Link from "next/link";
import { PlayCircle } from "lucide-react";

export default function KontaktPage() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <nav className="mb-3 text-[13px] leading-relaxed text-[#94a3b8]" aria-label="Brotkrumenpfad">
          <Link href="/" className="transition-colors hover:text-[#64748B]">
            Startseite
          </Link>
          <span className="mx-1.5 text-[#CBD5E1]" aria-hidden>
            /
          </span>
          <span className="text-[#64748B]">Kontakt</span>
        </nav>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mb-6">Kontakt</h1>
        <p className="text-[#64748B] mb-8">
          PVNavigator ist eine unabhängige Analyseplattform für Photovoltaik, Speicher und Energieanalysen.
        </p>

        <dl className="mb-8 space-y-4 text-[#64748B]">
          <div>
            <dt className="text-sm font-medium text-[#0F172A]">E-Mail</dt>
            <dd className="mt-1">
              <a
                href="mailto:info@pvnavigator.de"
                className="text-[#64748B] transition-colors hover:text-[#0F172A]"
              >
                info@pvnavigator.de
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#0F172A]">Antwortzeit</dt>
            <dd className="mt-1">In der Regel innerhalb von 1–2 Werktagen.</dd>
          </div>
        </dl>

        <div className="border-t border-[#E2E8F0] pt-8 mb-8">
          <a
            href="https://www.youtube.com/@ruden_ko"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-[#64748B] transition-colors hover:text-[#0F172A]"
          >
            <PlayCircle className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            YouTube-Kanal
          </a>
        </div>

        <Link
          href="/"
          className="inline-flex px-4 py-2 rounded-full bg-[#F59E0B] hover:bg-[#d97706] text-white font-semibold text-sm transition-colors"
        >
          ← Zurück
        </Link>
      </div>
    </div>
  );
}
