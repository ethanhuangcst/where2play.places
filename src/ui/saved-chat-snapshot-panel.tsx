"use client";

import type { ChatMessageDto } from "@/src/core/saved-itinerary";
import { useT } from "@/src/i18n/use-t";

type Props = {
  messages: ChatMessageDto[];
};

export function SavedChatSnapshotPanel({ messages }: Props) {
  const t = useT();
  if (!messages.length) return null;

  return (
    <section
      className="panel saved-chat-snapshot"
      data-testid="saved-chat-snapshot"
      aria-labelledby="saved-chat-title"
    >
      <div className="panel__head">
        <h2 id="saved-chat-title">{t("play.saved.chat_title")}</h2>
      </div>
      <div className="panel__body">
        <p className="page-meta" data-testid="saved-chat-snapshot-note">
          {t("play.saved.chat_snapshot_note")}
        </p>
        <p className="page-meta" data-testid="saved-chat-continue-note">
          {t("play.saved.chat_continue_note")}
        </p>
        <div className="saved-chat-snapshot__thread" role="log" aria-readonly="true">
          {messages.map((m, i) => {
            const roleClass =
              m.role === "user"
                ? "bubble bubble--user"
                : m.role === "system"
                  ? "bubble bubble--agent bubble--agent-notice"
                  : "bubble bubble--agent";
            return (
              <div
                key={`${m.role}-${i}-${m.createdAt ?? ""}`}
                className={roleClass}
                data-testid="saved-chat-message"
                data-role={m.role}
              >
                {m.content}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
