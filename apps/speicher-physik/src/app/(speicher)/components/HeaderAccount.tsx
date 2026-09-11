"use client";

const headerAuthLink =
  "inline-flex min-h-11 items-center whitespace-nowrap text-sm text-ink-secondary transition-colors hover:text-ink sm:min-h-0";

const headerAccountLink =
  "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-sm font-semibold text-ink transition-colors hover:text-ink-secondary sm:min-h-0";

const headerSignOutBtn =
  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-1 py-2 text-sm font-medium text-ink-secondary transition-colors hover:text-ink sm:min-h-0 sm:border sm:border-line sm:bg-surface sm:px-3 sm:shadow-sm sm:hover:bg-canvas";

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
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-3">
        <a href={accountHref} className={headerAccountLink}>
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
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-3">
      <a href={loginHref} className={headerAuthLink}>
        Anmelden
      </a>
      <a href={signupHref} className={headerAuthLink}>
        Konto erstellen
      </a>
    </div>
  );
}
