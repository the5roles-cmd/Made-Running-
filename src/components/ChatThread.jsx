// ChatThread — reusable conversation UI.
// Used by ChatPanel (slide-over) and Assistant page (full-page).
import { useState, useRef, useEffect } from 'react'
import { Bot, Send } from 'lucide-react'
import { chat } from '../lib/api'
import { tenant } from '../lib/theme'
import { DEMO_DATA } from '../lib/demoData'
import { demoAnswer } from '../lib/demoAssistant'

// Running-club vocabulary, not CRM-template vocabulary. This greeting and
// these chips were inherited from the generic template and still said
// "accounts", "pipeline" and "deals" — words a running club does not use about
// its members. The chips matter more than they look: they are the only prompts
// most people will ever send, so they double as a statement of what the
// product is for. "What deals closed this month?" answered that question
// wrongly.
const GREETING = `Hi — I'm your ${tenant.name} assistant. Ask me about your runners, this week's sessions, turnout or volunteers.`

const SUGGESTED = [
  'Which runners are at risk of drifting?',
  "What was turnout at the last session?",
  'Who are our volunteers?',
]

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`msg ${isUser ? 'msg--user' : 'msg--ai'}`}>
      {!isUser && (
        <span
          className="avatar"
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-contrast)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bot size={14} />
        </span>
      )}
      <div className="msg__bubble">{msg.content}</div>
    </div>
  )
}

export default function ChatThread() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: GREETING },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const logRef = useRef(null)

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || busy) return

    const userMsg = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setBusy(true)

    try {
      // In the demo there is no /api to post to — see src/lib/demoAssistant.js
      // for why that must stay true, and what it answers instead. Intercepted
      // here rather than inside api.js so the real client stays a thin fetch
      // wrapper with nothing demo-shaped in it.
      if (DEMO_DATA) {
        const reply = demoAnswer(text)
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
        return
      }
      const data = await chat(nextMessages, {
        app: tenant.name,
        industry: tenant.industry,
      })
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ])
    } catch (err) {
      const errText =
        err?.message?.includes('503') || err?.message?.includes('not configured')
          ? "The assistant isn't connected yet — add ANTHROPIC_API_KEY to .env.local and restart."
          : err?.message || 'Something went wrong. Please try again.'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: errText },
      ])
    } finally {
      setBusy(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function handleChip(prompt) {
    setInput(prompt)
  }

  return (
    <div className="chat" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="chat__log" ref={logRef} style={{ flex: 1, overflowY: 'auto' }}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {busy && (
          <div className="msg msg--ai">
            <span
              className="avatar"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-contrast)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={14} />
            </span>
            <div className="msg__bubble muted" style={{ fontStyle: 'italic' }}>
              Thinking…
            </div>
          </div>
        )}
      </div>

      {/* Suggested prompts — only when just the greeting is showing */}
      {messages.length === 1 && (
        <div
          className="rowflex"
          style={{ gap: 'var(--s2)', padding: '0 var(--s4) var(--s3)', flexWrap: 'wrap' }}
        >
          {SUGGESTED.map((p) => (
            <button
              key={p}
              className="btn btn--ghost btn--sm"
              style={{ fontSize: 'var(--fs-xs)', whiteSpace: 'normal', textAlign: 'left' }}
              onClick={() => handleChip(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="chat__composer">
        <textarea
          className="textarea"
          rows={1}
          placeholder="Ask anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
          style={{ resize: 'none', flex: 1 }}
        />
        <button
          className="btn btn--primary btn--sm"
          onClick={send}
          disabled={busy || !input.trim()}
          aria-label="Send message"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
