import { useEffect, useRef, useState, useCallback } from "react";
import { useFetcher } from "react-router";

interface Message {
  id: string;
  threadId: string;
  sender: "shop" | "admin" | "system" | "bot" | "BOT";
  body: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
  createdAt: string;
}

interface Thread {
  id: string;
  shop: string;
  shopUnreadCount: number;
  adminUnreadCount: number;
  closedAt: string | null;
  adminTypingAt: string | null;
  lastResetAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type MessagesLoaderData = { thread: Thread; messages: Message[] };

const POLL_MS = 4000;
const TYPING_THROTTLE_MS = 3000;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function dateKey(iso: string) {
  return new Date(iso).toDateString();
}

function isAdminTyping(thread: Thread | null): boolean {
  if (!thread?.adminTypingAt) return false;
  return Date.now() - new Date(thread.adminTypingAt).getTime() < 10000;
}

const css = `
.cpsc-bubble{position:fixed;bottom:24px;right:24px;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.cpsc-toggle{width:52px;height:52px;border-radius:50%;background:#4f46e5;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.22);transition:background .2s}
.cpsc-toggle:hover{background:#4338ca}
.cpsc-badge{position:absolute;top:-3px;right:-3px;background:#dc2626;color:#fff;font-size:10px;font-weight:700;min-width:17px;height:17px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px}
.cpsc-panel{position:fixed;bottom:88px;right:24px;width:340px;max-height:520px;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);display:flex;flex-direction:column;z-index:9999;overflow:hidden}
.cpsc-header{background:#4f46e5;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.cpsc-header-title{font-weight:700;font-size:15px}
.cpsc-header-sub{font-size:11px;opacity:.82;margin-top:2px}
.cpsc-header-close{background:none;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;opacity:.8;padding:0}
.cpsc-header-close:hover{opacity:1}
.cpsc-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:6px;min-height:220px}
.cpsc-date-divider{text-align:center;font-size:11px;color:#9ca3af;margin:6px 0;position:relative}
.cpsc-date-divider span{background:#fff;padding:0 8px;position:relative;z-index:1}
.cpsc-date-divider::before{content:"";position:absolute;top:50%;left:0;right:0;height:1px;background:#e5e7eb}
.cpsc-row{display:flex;flex-direction:column}
.cpsc-row.shop{align-items:flex-end}
.cpsc-row.admin{align-items:flex-start}
.cpsc-bubble-msg{max-width:80%;padding:8px 12px;border-radius:16px;font-size:13px;line-height:1.45;word-break:break-word}
.cpsc-row.shop .cpsc-bubble-msg{background:#4f46e5;color:#fff;border-bottom-right-radius:4px}
.cpsc-row.admin .cpsc-bubble-msg{background:#f3f4f6;color:#111827;border-bottom-left-radius:4px}
.cpsc-time{font-size:10px;color:#9ca3af;margin-top:2px;padding:0 2px}
.cpsc-attach{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.3);margin-top:4px;text-decoration:none;font-size:12px;color:inherit}
.cpsc-row.admin .cpsc-attach{border-color:#d1d5db;color:#374151}
.cpsc-system{text-align:center;font-size:11.5px;color:#9ca3af;padding:2px 0}
.cpsc-typing{display:flex;gap:3px;align-items:center;padding:8px 12px;background:#f3f4f6;border-radius:16px;width:fit-content}
.cpsc-typing span{width:6px;height:6px;border-radius:50%;background:#9ca3af;animation:cpsc-bounce .9s infinite}
.cpsc-typing span:nth-child(2){animation-delay:.15s}
.cpsc-typing span:nth-child(3){animation-delay:.3s}
@keyframes cpsc-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
.cpsc-closed-bar{background:#fef3c7;color:#92400e;font-size:12px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.cpsc-reopen-btn{background:#4f46e5;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer}
.cpsc-footer{padding:8px;border-top:1px solid #e5e7eb;display:flex;gap:6px;align-items:flex-end;flex-shrink:0}
.cpsc-input{flex:1;border:1px solid #d1d5db;border-radius:10px;padding:8px 10px;font-size:13px;resize:none;outline:none;max-height:80px;font-family:inherit}
.cpsc-input:focus{border-color:#4f46e5}
.cpsc-send{background:#4f46e5;color:#fff;border:none;border-radius:10px;padding:8px 12px;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap}
.cpsc-send:disabled{opacity:.5;cursor:default}
.cpsc-send:hover:not(:disabled){background:#4338ca}
.cpsc-file-btn{background:none;border:1px solid #d1d5db;border-radius:10px;padding:7px 9px;cursor:pointer;font-size:14px;color:#6b7280}
.cpsc-file-btn:hover{border-color:#4f46e5;color:#4f46e5}
@media(max-width:400px){.cpsc-panel{width:calc(100vw - 16px);right:8px;bottom:80px}}
.cpsc-prechat{padding:16px;display:flex;flex-direction:column;gap:10px;flex:1;overflow-y:auto}
.cpsc-prechat-title{font-weight:700;font-size:14px;color:#111827}
.cpsc-prechat-sub{font-size:12px;color:#6b7280;margin-top:-4px}
.cpsc-prechat input,.cpsc-prechat textarea{border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;font-family:inherit;width:100%;box-sizing:border-box}
.cpsc-prechat input:focus,.cpsc-prechat textarea:focus{border-color:#4f46e5;box-shadow:0 0 0 2px rgba(79,70,229,.15)}
.cpsc-prechat textarea{resize:none;height:68px}
.cpsc-prechat-btn{background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;width:100%;margin-top:2px}
.cpsc-prechat-btn:disabled{opacity:.5;cursor:default}
.cpsc-prechat-btn:hover:not(:disabled){background:#4338ca}
`;

export default function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const [contactName, setContactName] = useState<string>(() => {
    try { return localStorage.getItem("cpsc-contact-name") ?? ""; } catch { return ""; }
  });
  const [prechatName, setPrechatName] = useState("");
  const [prechatEmail, setPrechatEmail] = useState("");
  const [prechatMsg, setPrechatMsg] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetcher = useFetcher<MessagesLoaderData>();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchMessages = useCallback(() => {
    fetcher.load("/app/support/messages");
  }, [fetcher]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (fetcher.data) {
      setMessages(fetcher.data.messages);
      setThread(fetcher.data.thread);
      if (!open) {
        setUnread(fetcher.data.thread.shopUnreadCount);
      } else {
        setUnread(0);
      }
    }
  }, [fetcher.data, open]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      scrollToBottom();
    }
  }, [open, messages]);

  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    fetch("/app/support/typing", { method: "POST" }).catch(() => {});
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    sendTyping();
  };

  const handleSend = async () => {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    setInput("");
    try {
      await fetch("/app/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      fetchMessages();
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (input.trim()) fd.append("body", input.trim());
      await fetch("/app/support/messages", { method: "POST", body: fd });
      setInput("");
      fetchMessages();
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClose = async () => {
    await fetch("/app/support/close", { method: "POST" });
    fetchMessages();
  };

  const handleReopen = async () => {
    await fetch("/app/support/reopen", { method: "POST" });
    setMessages([]);
    setContactName("");
    try { localStorage.removeItem("cpsc-contact-name"); } catch {}
    setPrechatName(""); setPrechatEmail(""); setPrechatMsg("");
    setThread((t) => t ? { ...t, closedAt: null, lastResetAt: new Date().toISOString() } : t);
    fetchMessages();
  };

  const handlePrechatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = prechatName.trim();
    const email = prechatEmail.trim();
    const body = prechatMsg.trim();
    if (!name || !email || !body || sending) return;
    setSending(true);
    try {
      await fetch("/app/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, name, email }),
      });
      setContactName(name);
      try { localStorage.setItem("cpsc-contact-name", name); } catch {}
      fetchMessages();
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isClosed = !!thread?.closedAt;
  const adminTyping = isAdminTyping(thread);
  const showPreChat = !!thread && messages.length === 0 && !contactName && !isClosed;

  return (
    <>
      <style>{css}</style>

      {open && (
        <div className="cpsc-panel">
          <div className="cpsc-header">
            <div>
              <div className="cpsc-header-title">CartPulse Support</div>
              <div className="cpsc-header-sub">We typically reply within a few hours</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!isClosed && (
                <button
                  onClick={handleClose}
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 6, fontSize: 11, color: "#fff", cursor: "pointer", padding: "3px 8px", whiteSpace: "nowrap" }}
                >
                  End Chat
                </button>
              )}
              <button className="cpsc-header-close" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
            </div>
          </div>

          {isClosed && (
            <div className="cpsc-closed-bar">
              <span>This conversation is closed.</span>
              <button className="cpsc-reopen-btn" onClick={handleReopen}>New Chat</button>
            </div>
          )}

          {showPreChat ? (
            <form className="cpsc-prechat" onSubmit={handlePrechatSubmit}>
              <div className="cpsc-prechat-title">How can we help?</div>
              <div className="cpsc-prechat-sub">Fill in your details and we'll get back to you shortly.</div>
              <input
                placeholder="Your name *"
                value={prechatName}
                onChange={(e) => setPrechatName(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="Email address *"
                value={prechatEmail}
                onChange={(e) => setPrechatEmail(e.target.value)}
                required
              />
              <textarea
                placeholder="Describe your issue *"
                value={prechatMsg}
                onChange={(e) => setPrechatMsg(e.target.value)}
                required
              />
              <button className="cpsc-prechat-btn" type="submit" disabled={sending || !prechatName.trim() || !prechatEmail.trim() || !prechatMsg.trim()}>
                {sending ? "Sending…" : "Start Chat"}
              </button>
            </form>
          ) : (
            <>
            <div className="cpsc-msgs">
            {messages.map((m, i) => {
              const prevMsg = i > 0 ? messages[i - 1] : null;
              const showDateDivider =
                i === 0 ||
                dateKey(m.createdAt) !== dateKey(prevMsg!.createdAt) ||
                prevMsg?.sender === "system";

              if (m.sender === "system") {
                return (
                  <div key={m.id}>
                    {showDateDivider && (
                      <div className="cpsc-date-divider"><span>{formatDateLabel(m.createdAt)}</span></div>
                    )}
                    <div className="cpsc-system">{m.body}</div>
                  </div>
                );
              }

              const isShop = m.sender === "shop";
              const isBot = m.sender === "bot" || m.sender === "BOT";
              const side = isShop ? "shop" : "admin";

              return (
                <div key={m.id}>
                  {showDateDivider && (
                    <div className="cpsc-date-divider"><span>{formatDateLabel(m.createdAt)}</span></div>
                  )}
                  <div className={`cpsc-row ${side}`}>
                    <div className="cpsc-bubble-msg">
                      {isBot && <span style={{ fontSize: 11, opacity: 0.7, display: "block", marginBottom: 2 }}>Bot</span>}
                      {m.body && <span>{m.body}</span>}
                      {m.attachmentUrl && (
                        m.attachmentType?.startsWith("image/") ? (
                          <a href={m.attachmentUrl} target="_blank" rel="noreferrer">
                            <img src={m.attachmentUrl} alt={m.attachmentName ?? "Image"} style={{ maxWidth: "100%", borderRadius: 8, marginTop: m.body ? 6 : 0, display: "block" }} />
                          </a>
                        ) : (
                          <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="cpsc-attach">
                            📎 {m.attachmentName ?? "Attachment"}
                          </a>
                        )
                      )}
                    </div>
                    <div className="cpsc-time">{formatTime(m.createdAt)}</div>
                  </div>
                </div>
              );
            })}

            {adminTyping && (
              <div className="cpsc-row admin">
                <div className="cpsc-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {!isClosed && (
            <div className="cpsc-footer">
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
              />
              <button className="cpsc-file-btn" onClick={() => fileInputRef.current?.click()} title="Attach file">📎</button>
              <textarea
                className="cpsc-input"
                placeholder="Type a message…"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button className="cpsc-send" onClick={handleSend} disabled={sending || !input.trim()}>
                Send
              </button>
            </div>
          )}
            </>
          )}
        </div>
      )}

      <div className="cpsc-bubble">
        <button className="cpsc-toggle" onClick={() => setOpen((v) => !v)} aria-label="Open support chat">
          {open ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          )}
        </button>
        {unread > 0 && !open && (
          <div className="cpsc-badge">{unread > 9 ? "9+" : unread}</div>
        )}
      </div>
    </>
  );
}
