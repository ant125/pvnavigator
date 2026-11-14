import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { session } = vi.hoisted(() => ({
  session: { user: null as { id: string; email: string } | null },
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  useRouter: () => ({ refresh: () => undefined }),
}));

vi.mock("@/lib/auth", () => ({
  getServerUser: async () => session.user,
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createServerSupabaseClient: async () => {
    throw new Error("feedback page must not query before the session check");
  },
}));

vi.mock("@/lib/feedbackServer", () => ({
  loadOwnFeedback: async () => ({ status: "ok", data: { threads: [], unread: 0 } }),
  loadFeedbackCalculations: async () => [],
  loadOwnFeedbackThread: async () => {
    throw new Error("not used");
  },
}));

import FeedbackPage from "./page";
import FeedbackThreadPage from "./[id]/page";

const threadId = "00000000-0000-4000-8000-000000000010";

beforeEach(() => {
  session.user = null;
});

describe("/feedback", () => {
  it("sends a guest back to Hub sign-in for this page", async () => {
    await expect(FeedbackPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "REDIRECT:/anmelden?next=/feedback",
    );
  });

  it("shows the shared form to a signed-in account", async () => {
    session.user = { id: "00000000-0000-4000-8000-0000000000aa", email: "person@example.com" };
    const html = renderToStaticMarkup(await FeedbackPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Feedback &amp; Support");
    expect(html).toContain("Haben Sie einen Fehler entdeckt oder eine Idee für unsere Produkte?");
    expect(html).toContain("Meine Anfragen");
    expect(html).toContain('action="/feedback/neu"');
    expect(html).not.toContain("RENDITEGUIDE");
    expect(html).not.toContain("wirtschaftlichkeit");
  });

  it("sends a guest back to the same request", async () => {
    await expect(FeedbackThreadPage({
      params: Promise.resolve({ id: threadId }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow(`REDIRECT:/anmelden?next=${encodeURIComponent(`/feedback/${threadId}`)}`);
  });

  it("does not open a malformed request id", async () => {
    await expect(FeedbackThreadPage({
      params: Promise.resolve({ id: "not-a-request" }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("REDIRECT:/feedback");
  });
});
