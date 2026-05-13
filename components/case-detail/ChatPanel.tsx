"use client";

import { useState } from "react";
import { SHAILESH_BHATT_CASE } from "@/lib/fixtures/shailesh-bhatt-case";
import { Panel, Send, X } from "@/components/chrome/Icons";

/* Read-only chat panel UI shell. Pre-baked Q+A from the fixture. The input
 * field is non-functional in slice 1; functional read-only chat lands in
 * slice 6. Collapsed by default per the approved orientation. */

export function ChatPanel() {
  const [collapsed, setCollapsed] = useState(true);

  if (collapsed) {
    return (
      <aside className="chat-panel-collapsed">
        <button
          type="button"
          className="w-[30px] h-[30px] inline-flex items-center justify-center rounded-1 text-ink-3 hover:text-ink-1 hover:bg-paper-hover transition-colors"
          onClick={() => setCollapsed(false)}
          aria-label="Open chat"
        >
          <Panel size={14} />
        </button>
        <div className="vrt">Ask the case</div>
      </aside>
    );
  }

  return (
    <aside className="chat-panel">
      <div className="chat-head">
        <div className="chat-title">
          Ask the case <span className="read-only-tag">Read-only</span>
        </div>
        <button
          type="button"
          className="w-[30px] h-[30px] inline-flex items-center justify-center rounded-1 text-ink-3 hover:text-ink-1 hover:bg-paper-hover transition-colors"
          onClick={() => setCollapsed(true)}
          aria-label="Close chat"
        >
          <X size={14} />
        </button>
      </div>
      <div className="chat-body">
        {SHAILESH_BHATT_CASE.chatMessages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.who}`}>
            <span className="who">{msg.name}</span>
            <div className="chat-bubble">
              {"bubble" in msg && msg.bubble ? msg.bubble : null}
              {"bubbleParts" in msg && msg.bubbleParts
                ? msg.bubbleParts.map((part, j) =>
                    part.kind === "cite" ? (
                      <span key={j} className="cite">
                        {part.value}
                      </span>
                    ) : (
                      <span key={j}>{part.value}</span>
                    )
                  )
                : null}
            </div>
          </div>
        ))}
      </div>
      <div className="chat-input">
        <div className="chat-input-row">
          <input placeholder="Ask about anything in this case…" disabled />
          <button
            type="button"
            className="w-[28px] h-[28px] inline-flex items-center justify-center rounded-1 text-ink-3 hover:text-ink-1 hover:bg-paper-hover transition-colors"
            disabled
            aria-label="Send"
          >
            <Send size={14} />
          </button>
        </div>
        <div className="chat-foot-note">Functional in slice 6. Answers cite case sections.</div>
      </div>
    </aside>
  );
}
