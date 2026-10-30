"use client";

import { MessageCircleQuestion } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  faqFor,
  localFallbackReply,
  sendAssistantMessage,
  type AssistantMessage,
  type AssistantMode,
} from "../lib/assistant";
import { isApiFailure } from "../lib/ai";
import { useLocale } from "./locale-provider";

export function VerasJurisAssistant() {
  const { locale, t } = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>("support");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "disclaimer",
      role: "system",
      content: t("assistant.disclaimer"),
    },
  ]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    setPending(true);
    setInput("");
    const userMsg: AssistantMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);

    const res = await sendAssistantMessage({
      mode,
      message: text,
      conversationId,
      locale,
      path: pathname,
    });

    let reply: string;
    let available = false;
    if (isApiFailure(res)) {
      reply = localFallbackReply(locale, mode, text);
      available = false;
    } else {
      reply = res.reply;
      available = Boolean(res.aiAvailable);
      setConversationId(res.conversationId);
    }
    setAiAvailable(available);
    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
    setPending(false);
  }

  const faq = faqFor(locale, mode);

  return (
    <>
      <button
        type="button"
        className="vj-fab vj-fab-assistant"
        aria-label={t("assistant.open")}
        aria-expanded={open}
        aria-controls="vj-assistant-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <MessageCircleQuestion size={22} aria-hidden="true" />
      </button>
      {open ? (
        <div
          id="vj-assistant-panel"
          className="vj-assistant-panel"
          role="dialog"
          aria-modal="false"
          aria-label={t("assistant.title")}
        >
          <div className="vj-a11y-panel-header">
            <h2 className="vj-section-title">{t("assistant.title")}</h2>
            <button
              type="button"
              className="vj-button vj-button-secondary"
              onClick={() => setOpen(false)}
            >
              {t("common.close")}
            </button>
          </div>
          <p className="vj-hint" role="note">
            {t("assistant.disclaimer")}
          </p>
          {!aiAvailable ? (
            <p className="vj-meta" role="status">
              {t("assistant.fallback")}
            </p>
          ) : null}
          <div className="vj-view-toggle" role="tablist" aria-label="Modo do assistente">
            {(
              [
                ["support", "assistant.mode.support"],
                ["product", "assistant.mode.product"],
                ["legal", "assistant.mode.legal"],
              ] as const
            ).map(([id, labelKey]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => setMode(id)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
          <div className="vj-assistant-messages" aria-live="polite">
            {messages.map((message) => (
              <p
                key={message.id}
                className={
                  message.role === "user"
                    ? "vj-assistant-bubble vj-assistant-bubble-user"
                    : "vj-assistant-bubble"
                }
              >
                {message.content}
              </p>
            ))}
          </div>
          <details className="vj-card vj-card-calm">
            <summary>FAQ</summary>
            <ul>
              {faq.map((item) => (
                <li key={item.q}>
                  <button
                    type="button"
                    className="vj-link-button"
                    onClick={() => {
                      setInput(item.q);
                    }}
                  >
                    {item.q}
                  </button>
                </li>
              ))}
            </ul>
          </details>
          <form
            className="vj-assistant-compose"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label className="vj-visually-hidden" htmlFor="vj-assistant-input">
              {t("assistant.placeholder")}
            </label>
            <input
              id="vj-assistant-input"
              className="vj-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("assistant.placeholder")}
              autoComplete="off"
            />
            <button type="submit" className="vj-button" disabled={pending}>
              {t("assistant.send")}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
