import Link from "next/link";

import { formatListingKwh, formatListingKwP } from "@/lib/calculationsList";
import {
  accountKindLabel,
  formatAdminCount,
  formatAdminDateTime,
  formatAdminDay,
  formatAdminKwh,
  formatAdminRate,
  formatAdminYesNo,
  pageCount,
  userListHref,
  type AdminDashboard,
  type AdminUserCard,
  type AdminUserList,
  type UserListQuery,
} from "@/lib/adminOverview";

const MISSING = "Nicht verfügbar";

export function AdminLoadError() {
  return (
    <section className="hub-panel hub-account" role="alert">
      <h2 className="hub-kicker">Administration</h2>
      <p>Die Angaben konnten nicht geladen werden.</p>
    </section>
  );
}

export function AdminIntro({ title, text }: { title: string; text: string }) {
  return (
    <header className="hub-intro">
      <div>
        <p className="hub-kicker">PVNAVIGATOR_ / Administration</p>
        <h1>{title}</h1>
        <p className="hub-subtitle">{text}</p>
      </div>
      <Link href="/konto" className="hub-text-link">Zu Mein Konto →</Link>
    </header>
  );
}

function Metric({ label, value, href }: { label: string; value: number; href?: string }) {
  const formatted = formatAdminCount(value);
  return (
    <div>
      <dt>{label}</dt>
      <dd>{href ? <Link href={href}>{formatted}</Link> : formatted}</dd>
    </div>
  );
}

export function AdminDashboardView({ data }: { data: AdminDashboard }) {
  const max = Math.max(...data.series.map((point) => point.count), 1);
  return (
    <>
      <section aria-labelledby="admin-totals-heading">
        <h2 id="admin-totals-heading" className="admin-sr">Kennzahlen</h2>
        <dl className="admin-stats">
          <Metric label="Nutzer" value={data.users} href="/admin/nutzer" />
          <Metric label="Unternehmen" value={data.unternehmen} href="/admin/nutzer?art=unternehmen" />
          <Metric label="Berechnungen" value={data.calculations} />
        </dl>
      </section>
      <section className="hub-panel admin-block" aria-labelledby="admin-trustpilot-heading">
        <div className="hub-panel-heading">
          <h2 id="admin-trustpilot-heading">Trustpilot</h2>
        </div>
        <p className="hub-section-note">
          Gezählt wird, wem die Einladung angezeigt wurde und wer den Link geöffnet hat.
          Eine veröffentlichte Bewertung wird nicht erfasst.
        </p>
        <dl className="admin-activity">
          <div>
            <dt>Einladung angezeigt</dt>
            <dd>{formatAdminCount(data.trustpilotShown)}</dd>
          </div>
          <div>
            <dt>Link geöffnet</dt>
            <dd>{formatAdminCount(data.trustpilotClicked)}</dd>
          </div>
          <div>
            <dt>Klickrate</dt>
            <dd>{formatAdminRate(data.trustpilotShown, data.trustpilotClicked)}</dd>
          </div>
        </dl>
      </section>
      <section className="hub-panel admin-block" aria-labelledby="admin-activity-heading">
        <div className="hub-panel-heading">
          <h2 id="admin-activity-heading">Berechnungsaktivität</h2>
        </div>
        <p className="hub-section-note">Europe/Berlin. Die Woche beginnt am Montag.</p>
        <dl className="admin-activity">
          <div><dt>Heute</dt><dd>{formatAdminCount(data.today)}</dd></div>
          <div><dt>Diese Woche</dt><dd>{formatAdminCount(data.week)}</dd></div>
          <div><dt>Dieser Monat</dt><dd>{formatAdminCount(data.month)}</dd></div>
        </dl>
        <figure className="admin-figure">
          <figcaption>Gespeicherte Berechnungen, letzte 30 Tage</figcaption>
          <div className="admin-chart" role="list">
            {data.series.map((point) => (
              <span
                key={point.day}
                role="listitem"
                className="admin-bar"
                data-empty={point.count === 0 ? "true" : "false"}
                style={point.count === 0 ? undefined : { height: `${Math.max(8, (point.count / max) * 100)}%` }}
                aria-label={`${formatAdminDay(point.day)}: ${formatAdminCount(point.count)}`}
              />
            ))}
          </div>
          <ol className="admin-chart-axis">
            <li>{formatAdminDay(data.series[0].day)}</li>
            <li>{formatAdminDay(data.series[14].day)}</li>
            <li>{formatAdminDay(data.series[29].day)}</li>
          </ol>
        </figure>
      </section>
    </>
  );
}

const filters: { art: UserListQuery["art"]; label: string }[] = [
  { art: "alle", label: "Alle" },
  { art: "privat", label: "Privat" },
  { art: "unternehmen", label: "Unternehmen" },
  { art: "nicht_angegeben", label: "Nicht angegeben" },
];

export function AdminUserListView({ query, data }: { query: UserListQuery; data: AdminUserList }) {
  const pages = pageCount(data.total, data.pageSize);
  const formKey = userListHref(query);
  return (
    <section className="hub-panel" aria-labelledby="admin-users-heading">
      <div className="hub-panel-heading">
        <h2 id="admin-users-heading">Nutzer</h2>
        <span className="hub-count">{formatAdminCount(data.total)}</span>
      </div>
      <form key={formKey} className="admin-filters" method="get" action="/admin/nutzer">
        {query.art !== "alle" ? <input type="hidden" name="art" value={query.art} /> : null}
        <label>
          Suche
          <input className="hub-input" type="search" name="q" defaultValue={query.q} maxLength={200} placeholder="Name, Firmenname oder E-Mail" />
        </label>
        <label>
          Sortierung
          <select className="hub-input" name="sort" defaultValue={query.sort}>
            <option value="registrierung">Registrierung</option>
            <option value="aktivitaet">Letzte Aktivität</option>
          </select>
        </label>
        <label>
          Richtung
          <select className="hub-input" name="richtung" defaultValue={query.richtung}>
            <option value="ab">Absteigend</option>
            <option value="auf">Aufsteigend</option>
          </select>
        </label>
        <button className="hub-secondary" type="submit">Suchen</button>
      </form>
      <div className="admin-filter-row" role="group" aria-label="Kontotyp">
        {filters.map((filter) => (
          <Link
            key={filter.art}
            href={userListHref(query, { art: filter.art, seite: 1 })}
            aria-current={query.art === filter.art ? "page" : undefined}
          >
            {filter.label}
          </Link>
        ))}
      </div>
      {data.users.length === 0 ? (
        <div className="hub-empty">
          <p>{data.total === 0 ? "Keine Nutzer für diese Auswahl." : "Keine Einträge auf dieser Seite."}</p>
          {data.page > 1 ? <Link href={userListHref(query, { seite: 1 })} className="hub-text-link">Zur ersten Seite</Link> : null}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">E-Mail</th>
                <th scope="col">Kontotyp</th>
                <th scope="col">Registrierung</th>
                <th scope="col">Berechnungen</th>
                <th scope="col">Letzte Berechnung</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id}>
                  <td data-label="Name">
                    <Link href={`/admin/nutzer/${user.id}`}>{user.displayName ?? "Nicht angegeben"}</Link>
                  </td>
                  <td data-label="E-Mail">{user.email ?? "Nicht angegeben"}</td>
                  <td data-label="Kontotyp">{accountKindLabel(user.accountKind)}</td>
                  <td data-label="Registrierung">{formatAdminDateTime(user.registeredAt)}</td>
                  <td data-label="Berechnungen">{formatAdminCount(user.calculationCount)}</td>
                  <td data-label="Letzte Berechnung">
                    {user.lastCalculationAt ? formatAdminDateTime(user.lastCalculationAt) : "Keine"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.total > data.pageSize ? (
        <nav className="admin-pager" aria-label="Seiten">
          {data.page > 1 ? (
            <Link href={userListHref(query, { seite: data.page - 1 })}>Zurück</Link>
          ) : <span>Zurück</span>}
          <p>Seite {formatAdminCount(data.page)} von {formatAdminCount(pages)}</p>
          {data.page < pages ? (
            <Link href={userListHref(query, { seite: data.page + 1 })}>Weiter</Link>
          ) : <span>Weiter</span>}
        </nav>
      ) : null}
    </section>
  );
}

export function AdminUserCardView({ data }: { data: AdminUserCard }) {
  const pages = pageCount(data.user.calculationCount, data.pageSize);
  const href = (seite: number) => (seite > 1 ? `/admin/nutzer/${data.user.id}?seite=${seite}` : `/admin/nutzer/${data.user.id}`);
  return (
    <>
      <p className="hub-crumb">
        <Link href="/admin/nutzer">Nutzer</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{data.user.displayName ?? data.user.email ?? "Nicht angegeben"}</span>
      </p>
      <section className="hub-panel hub-account" aria-labelledby="admin-user-heading">
        <h2 id="admin-user-heading">{data.user.displayName ?? "Nicht angegeben"}</h2>
        <p className="hub-email">{data.user.email ?? "Nicht angegeben"}</p>
        <dl className="admin-user-meta">
          {data.user.contactName ? <div><dt>Ansprechpartner</dt><dd>{data.user.contactName}</dd></div> : null}
          <div><dt>Kontotyp</dt><dd>{accountKindLabel(data.user.accountKind)}</dd></div>
          <div><dt>Registrierung</dt><dd>{formatAdminDateTime(data.user.registeredAt)}</dd></div>
          <div><dt>Berechnungen</dt><dd>{formatAdminCount(data.user.calculationCount)}</dd></div>
        </dl>
      </section>
      <section className="hub-panel admin-block" aria-labelledby="admin-calculations-heading">
        <div className="hub-panel-heading">
          <h2 id="admin-calculations-heading">Gespeicherte Berechnungen</h2>
          <span className="hub-count">{formatAdminCount(data.user.calculationCount)}</span>
        </div>
        {data.calculations.length === 0 ? (
          <div className="hub-empty">
            <p>{data.user.calculationCount === 0 ? "Keine gespeicherten Berechnungen." : "Keine Einträge auf dieser Seite."}</p>
            {data.page > 1 ? <Link href={href(1)} className="hub-text-link">Zur ersten Seite</Link> : null}
          </div>
        ) : (
          <ol className="admin-calculations">
            {data.calculations.map((calculation) => (
              <li key={calculation.id} data-calculation-id={calculation.id}>
                <h3>{formatAdminDateTime(calculation.createdAt)}</h3>
                <dl className="admin-calc-address">
                  <div><dt>Adresse</dt><dd>{calculation.address ?? MISSING}</dd></div>
                </dl>
                <div className="admin-calc-groups">
                  <section aria-labelledby={`anlage-${calculation.id}`}>
                    <h4 id={`anlage-${calculation.id}`}>Anlage</h4>
                    <dl>
                      <div><dt>PV-Leistung</dt><dd>{formatListingKwP(calculation.pvKwp) ?? MISSING}</dd></div>
                      <div><dt>PV-Jahreserzeugung</dt><dd>{formatListingKwh(calculation.pvYieldKwh) ?? MISSING}</dd></div>
                    </dl>
                  </section>
                  <section aria-labelledby={`verbrauch-${calculation.id}`}>
                    <h4 id={`verbrauch-${calculation.id}`}>Verbrauch</h4>
                    <dl>
                      <div><dt>Jahresstromverbrauch</dt><dd>{formatListingKwh(calculation.consumptionKwh) ?? MISSING}</dd></div>
                      <div><dt>Wärmepumpe</dt><dd>{formatAdminYesNo(calculation.heatPump)}</dd></div>
                      <div><dt>Elektroauto</dt><dd>{formatAdminYesNo(calculation.ev)}</dd></div>
                    </dl>
                  </section>
                  <section aria-labelledby={`speicher-${calculation.id}`}>
                    <h4 id={`speicher-${calculation.id}`}>Speicher</h4>
                    <dl>
                      <div><dt>Technische Speichergrenze</dt><dd>{formatAdminKwh(calculation.speichergrenzeKwh) ?? MISSING}</dd></div>
                      <div><dt>Planerische Anfangskapazität</dt><dd>{formatAdminKwh(calculation.planningKwh) ?? MISSING}</dd></div>
                    </dl>
                  </section>
                  <section aria-labelledby={`technik-${calculation.id}`}>
                    <h4 id={`technik-${calculation.id}`}>Technische Angaben</h4>
                    <dl>
                      <div><dt>Batteriemodell-Version</dt><dd>{calculation.batteryModelVersion ?? MISSING}</dd></div>
                    </dl>
                  </section>
                </div>
              </li>
            ))}
          </ol>
        )}
        {data.user.calculationCount > data.pageSize ? (
          <nav className="admin-pager" aria-label="Seiten">
            {data.page > 1 ? <Link href={href(data.page - 1)}>Zurück</Link> : <span>Zurück</span>}
            <p>Seite {formatAdminCount(data.page)} von {formatAdminCount(pages)}</p>
            {data.page < pages ? <Link href={href(data.page + 1)}>Weiter</Link> : <span>Weiter</span>}
          </nav>
        ) : null}
      </section>
    </>
  );
}
