"use client";

const headerAuthLink =
  "text-sm text-ink-secondary transition-colors hover:text-ink";

const headerAccountLink =
  "text-sm font-semibold text-ink transition-colors hover:text-ink-secondary";

const headerSignOutBtn =
  "inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-secondary shadow-sm transition-colors hover:bg-canvas hover:text-ink";

export type HeaderAccountProps = {
  authenticated: boolean;
  userEmail: string | null;
  loginHref: string;
  signupHref: string;
  accountHref: string;
  signOutHref: string;
};

export function HeaderAccount({
  authenticated,
  userEmail,
  loginHref,
  signupHref,
  accountHref,
  signOutHref,
}: HeaderAccountProps) {
  if (authenticated) {
    return (
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-2.5 gap-y-1 sm:gap-3">
        <a href={accountHref} className={`${headerAccountLink} shrink-0`}>
          Mein Konto
        </a>
        {userEmail ? (
          <span
            className="hidden max-w-[11rem] truncate text-xs text-ink-muted lg:inline"
            title={userEmail}
          >
            {userEmail}
          </span>
        ) : null}
        <form action={signOutHref} method="post">
          <button type="submit" className={headerSignOutBtn}>
            Abmelden
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
      <a href={loginHref} className={headerAuthLink}>
        Anmelden
      </a>
      <a href={signupHref} className={headerAuthLink}>
        Konto erstellen
      </a>
    </div>
  );
}
