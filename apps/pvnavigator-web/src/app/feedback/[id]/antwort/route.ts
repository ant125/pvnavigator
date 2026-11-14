import type { NextRequest } from "next/server";

import {
  feedbackRedirect,
  hintForRpc,
  messageFromForm,
  readFeedbackPost,
  threadIdFromPath,
} from "@/lib/feedbackRoute";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const threadId = threadIdFromPath(id);
  const nextPath = threadId ? `/feedback/${threadId}` : "/feedback";
  const post = await readFeedbackPost(request, nextPath);
  if (!post.ok) return post.response;
  if (!threadId) return feedbackRedirect("/feedback", post.setCookies, "fehler");
  const body = messageFromForm(post.formData);
  if (!body) return feedbackRedirect(nextPath, post.setCookies, "ungueltig");

  const { error } = await post.supabase.rpc("post_feedback_message", {
    p_thread_id: threadId,
    p_body: body,
  });
  if (error?.code === "P0002" || error?.message?.includes("feedback_not_found")) {
    return feedbackRedirect("/feedback", post.setCookies, "fehler");
  }
  if (error) return feedbackRedirect(nextPath, post.setCookies, hintForRpc(error));
  return feedbackRedirect(nextPath, post.setCookies);
}
