"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { ItineraryDto } from "@/src/core/itinerary-types";
import {
  loadChatDraft,
  saveChatDraft,
  type ChatDraftMessage,
} from "@/src/chat/local-storage";
import { resolveErrorKey } from "@/src/i18n/error-key";
import { useT } from "@/src/i18n/use-t";
import { authNdjsonEvents, AuthApiError } from "@/src/ui/auth-api";

type Props = {
  itinerary: ItineraryDto | null;
  onItineraryUpdate: (next: ItineraryDto) => void;
};

type StreamEvent =
  | { type: "token"; text: string }
  | { type: "done"; reply: string; itinerary?: ItineraryDto }
  | { type: "error"; key: string };

export function PlanChatPanel({ itinerary, onItineraryUpdate }: Props) {
  const t = useT();
  const [messages, setMessages] = useState<ChatDraftMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [streaming, setStreaming] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    setMessages(loadChatDraft());
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    saveChatDraft(messages);
  }, [messages]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!itinerary || sending) return;
    const text = input.trim();
    if (!text) return;

    setErrorKey(null);
    setInput("");
    const nextMessages: ChatDraftMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setSending(true);
    setStreaming("");

    let streamBuf = "";
    try {
      await authNdjsonEvents<StreamEvent>(
        "/api/chat",
        {
          method: "POST",
          body: JSON.stringify({
            messages: nextMessages,
            itinerary,
          }),
        },
        (event) => {
          if (event.type === "token") {
            streamBuf += event.text;
            setStreaming(streamBuf);
          } else if (event.type === "done") {
            const reply = event.reply || streamBuf;
            setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
            setStreaming("");
            if (event.itinerary) onItineraryUpdate(event.itinerary);
          } else if (event.type === "error") {
            setErrorKey(resolveErrorKey(event.key));
            setStreaming("");
          }
        },
      );
    } catch (err) {
      const key =
        err instanceof AuthApiError ? resolveErrorKey(err.key) : "play.errors.chat_failed";
      setErrorKey(key);
      setStreaming("");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="chat-title" data-testid="plan-chat">
      <div className="panel__head">
        <h2 id="chat-title">{t("play.chat.title")}</h2>
      </div>
      <div className="panel__body" style={{ paddingTop: 0, paddingBottom: "0.5rem" }}>
        {!itinerary ? (
          <p className="mute" data-testid="chat-need-itinerary">
            {t("play.chat.need_itinerary")}
          </p>
        ) : (
          <>
            <p
              className="mute"
              style={{ marginBottom: "0.5rem" }}
              data-testid="chat-draft-hint"
            >
              {t("play.chat.draft_hint")}
            </p>
            <div className="chat-shell" data-testid="chat-shell">
              <div className="chat-panel">
                <div
                  className="chat-transcript"
                  data-testid="chat-transcript"
                  ref={transcriptRef}
                >
                  {messages.length === 0 && !streaming ? (
                    <div className="bubble bubble--agent">{t("play.chat.intro")}</div>
                  ) : null}
                  {messages.map((m, i) => (
                    <div
                      key={`${m.role}-${i}`}
                      className={`bubble bubble--${m.role === "user" ? "user" : "agent"}`}
                    >
                      {m.content}
                    </div>
                  ))}
                  {streaming ? (
                    <div className="bubble bubble--agent" data-testid="chat-streaming">
                      {streaming}
                    </div>
                  ) : null}
                </div>
                <form className="chat-composer" onSubmit={onSubmit}>
                  <label className="sr-only" htmlFor="chat-input">
                    {t("play.chat.input_label")}
                  </label>
                  <input
                    id="chat-input"
                    name="q"
                    value={input}
                    onChange={(ev) => setInput(ev.target.value)}
                    placeholder={t("play.chat.placeholder")}
                    data-testid="chat-input"
                    disabled={sending}
                    autoComplete="off"
                  />
                  <button
                    className="btn"
                    type="submit"
                    data-testid="chat-send"
                    disabled={sending || !input.trim()}
                  >
                    {t("play.chat.send")}
                  </button>
                </form>
              </div>
              <button
                type="button"
                className="chat-resize"
                data-testid="chat-resize"
                aria-label={t("play.chat.resize")}
                title={t("play.chat.resize")}
              />
            </div>
            {errorKey ? (
              <p className="error" role="alert" data-testid="chat-error">
                {t(errorKey)}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
