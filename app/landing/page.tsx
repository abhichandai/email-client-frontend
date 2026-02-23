import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'FocusKeep — AI Priority Inbox',
  description: 'Stop drowning in email. FocusKeep uses AI to surface what actually matters.',
};

export default function LandingPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:         #191919;
          --bg-2:       #202020;
          --bg-3:       #2f2f2f;
          --border:     #2a2a28;
          --text:       #e3e3e0;
          --text-muted: #7a7a75;
          --accent:     #d4a853;
          --accent-dim: rgba(212,168,83,0.10);
          --accent-glow:rgba(212,168,83,0.06);
        }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }

        .grain {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.035;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-size: 256px 256px;
        }

        .glow {
          position: fixed;
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: 900px;
          height: 600px;
          background: radial-gradient(ellipse at center, rgba(212,168,83,0.07) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        .wrap {
          position: relative;
          z-index: 1;
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* NAV */
        nav {
          padding: 24px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .logo {
          font-family: 'Instrument Serif', serif;
          font-size: 24px;
          letter-spacing: 0px;
          text-decoration: none;
        }
        .logo-focus { color: var(--text); }
        .logo-keep  { color: var(--accent); }

        .nav-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: 6px;
          border: 1px solid rgba(212,168,83,0.3);
          color: var(--accent);
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s;
          background: var(--accent-dim);
        }
        .nav-cta:hover {
          border-color: rgba(212,168,83,0.6);
          background: rgba(212,168,83,0.15);
        }

        /* HERO */
        .hero {
          padding: 120px 0 100px;
          text-align: center;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 14px;
          border-radius: 100px;
          border: 1px solid var(--border);
          background: var(--bg-2);
          font-size: 11.5px;
          font-family: 'DM Mono', monospace;
          color: var(--text-muted);
          letter-spacing: 0.05em;
          margin-bottom: 40px;
        }
        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 6px var(--accent);
        }

        .hero h1 {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(48px, 7vw, 84px);
          line-height: 1.05;
          letter-spacing: -2px;
          font-weight: 400;
          max-width: 800px;
          margin: 0 auto 28px;
          color: var(--text);
        }

        .hero h1 em {
          font-style: italic;
          color: var(--accent);
        }

        .hero p {
          font-size: 17px;
          color: var(--text-muted);
          max-width: 480px;
          margin: 0 auto 48px;
          line-height: 1.65;
          font-weight: 300;
        }

        .cta-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 13px 28px;
          border-radius: 8px;
          background: var(--accent);
          color: #111;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
          letter-spacing: -0.1px;
        }
        .cta-primary:hover {
          background: #e0b560;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(212,168,83,0.25);
        }

        .cta-secondary {
          color: var(--text-muted);
          font-size: 13px;
          text-decoration: none;
          transition: color 0.2s;
        }
        .cta-secondary:hover { color: var(--text); }

        /* PREVIEW */
        .preview-wrap {
          margin: 80px auto 0;
          max-width: 860px;
          position: relative;
        }
        .preview-glow {
          position: absolute;
          bottom: -60px;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 200px;
          background: radial-gradient(ellipse, rgba(212,168,83,0.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .preview-frame {
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--bg-2);
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03);
          text-align: left;
        }
        .preview-bar {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-3);
        }
        .dot { width: 10px; height: 10px; border-radius: 50%; }
        .dot-r { background: #e05c5c; }
        .dot-y { background: #d4a853; }
        .dot-g { background: #4caf82; }

        .preview-body {
          display: flex;
          height: 320px;
        }
        .preview-sidebar {
          width: 180px;
          min-width: 180px;
          border-right: 1px solid var(--border);
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .preview-nav-item {
          padding: 6px 10px;
          border-radius: 5px;
          font-size: 11.5px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .preview-nav-item.active {
          background: var(--accent-dim);
          color: var(--accent);
        }
        .preview-nav-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
        }
        .preview-emails {
          flex: 1;
          overflow: hidden;
        }
        .preview-email {
          padding: 11px 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: default;
        }
        .preview-email:hover { background: var(--bg-3); }
        .email-priority { width: 6px; height: 6px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
        .email-body { flex: 1; min-width: 0; }
        .email-from { font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 2px; display: flex; justify-content: space-between; }
        .email-subject { font-size: 11.5px; color: var(--text); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .email-snippet { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .email-time { font-size: 10.5px; color: var(--text-muted); flex-shrink: 0; font-family: 'DM Mono', monospace; }

        /* FEATURES */
        .features {
          padding: 120px 0;
        }

        .section-label {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.12em;
          color: var(--accent);
          text-transform: uppercase;
          margin-bottom: 20px;
        }

        .features-header {
          max-width: 560px;
          margin-bottom: 64px;
        }

        .features-header h2 {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(36px, 4vw, 52px);
          letter-spacing: -1.5px;
          line-height: 1.1;
          font-weight: 400;
          margin-bottom: 16px;
        }

        .features-header p {
          color: var(--text-muted);
          font-size: 15px;
          line-height: 1.6;
          font-weight: 300;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }

        .feature-card {
          background: var(--bg-2);
          padding: 36px 32px;
          transition: background 0.2s;
        }
        .feature-card:hover { background: var(--bg-3); }

        .feature-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: var(--accent-dim);
          border: 1px solid rgba(212,168,83,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          margin-bottom: 20px;
        }

        .feature-card h3 {
          font-family: 'Instrument Serif', serif;
          font-size: 20px;
          font-weight: 400;
          letter-spacing: -0.3px;
          margin-bottom: 10px;
          color: var(--text);
        }

        .feature-card p {
          font-size: 13.5px;
          color: var(--text-muted);
          line-height: 1.6;
          font-weight: 300;
        }

        /* HOW IT WORKS */
        .how {
          padding: 0 0 120px;
        }

        .how-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: center;
        }

        .how-steps {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .how-step {
          display: flex;
          gap: 20px;
          padding: 28px 0;
          border-bottom: 1px solid var(--border);
        }
        .how-step:first-child { border-top: 1px solid var(--border); }

        .step-num {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: var(--accent);
          letter-spacing: 0.05em;
          padding-top: 3px;
          min-width: 24px;
        }

        .step-content h4 {
          font-size: 15px;
          font-weight: 500;
          margin-bottom: 6px;
          color: var(--text);
        }

        .step-content p {
          font-size: 13.5px;
          color: var(--text-muted);
          line-height: 1.55;
          font-weight: 300;
        }

        .how-visual {
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--bg-2);
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .priority-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-3);
        }
        .priority-row.high { border-color: rgba(224,92,92,0.2); background: rgba(224,92,92,0.04); }
        .priority-row.med  { border-color: rgba(212,168,83,0.2); background: rgba(212,168,83,0.04); }
        .priority-row.low  { background: var(--bg-3); }

        .p-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
        .p-high { background: #e05c5c; }
        .p-med  { background: #d4a853; }
        .p-low  { background: #555; }

        .p-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          padding: 2px 7px;
          border-radius: 4px;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .p-label.high { background: rgba(224,92,92,0.15); color: #e05c5c; }
        .p-label.med  { background: rgba(212,168,83,0.15); color: #d4a853; }
        .p-label.low  { background: rgba(100,100,100,0.15); color: #666; }

        .p-info { flex: 1; min-width: 0; }
        .p-from { font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
        .p-subject { font-size: 11.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* PRICING / CTA */
        .bottom-cta {
          padding: 100px 0;
          text-align: center;
          position: relative;
        }
        .bottom-cta::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(212,168,83,0.06) 0%, transparent 60%);
          pointer-events: none;
        }

        .bottom-cta h2 {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(40px, 5vw, 64px);
          letter-spacing: -2px;
          line-height: 1.05;
          font-weight: 400;
          margin-bottom: 20px;
        }

        .bottom-cta p {
          color: var(--text-muted);
          font-size: 15px;
          margin-bottom: 40px;
          font-weight: 300;
        }

        /* FOOTER */
        footer {
          border-top: 1px solid var(--border);
          padding: 32px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .footer-note {
          font-size: 12px;
          color: var(--text-muted);
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .features-grid { grid-template-columns: 1fr; }
          .how-grid { grid-template-columns: 1fr; }
          .how-visual { display: none; }
          .hero { padding: 80px 0 60px; }
          footer { flex-direction: column; gap: 12px; text-align: center; }
        }
      `}</style>

      <div className="grain" />
      <div className="glow" />

      {/* NAV */}
      <div className="wrap">
        <nav>
          <a href="/" className="logo">
            <span className="logo-focus">Focus</span>
            <span className="logo-keep">Keep</span>
          </a>
          <a href="https://app.tryfocuskeep.com/login" className="nav-cta">
            Get started →
          </a>
        </nav>
      </div>

      {/* HERO */}
      <div className="wrap">
        <section className="hero">
          <div className="badge">
            <span className="badge-dot" />
            AI-powered · Gmail
          </div>

          <h1>
            Email that knows<br />
            what <em>actually</em> matters
          </h1>

          <p>
            FocusKeep uses AI to triage your inbox in real time —
            surfacing what's urgent, burying what's noise.
          </p>

          <div className="cta-group">
            <a href="https://app.tryfocuskeep.com/login" className="cta-primary">
              Start for free
            </a>
            <a href="#how" className="cta-secondary">See how it works ↓</a>
          </div>

          {/* APP PREVIEW */}
          <div className="preview-wrap">
            <div className="preview-frame">
              <div className="preview-bar">
                <span className="dot dot-r" />
                <span className="dot dot-y" />
                <span className="dot dot-g" />
              </div>
              <div className="preview-body">
                <div className="preview-sidebar">
                  {[
                    { label: 'All Mail', icon: '✉', active: false },
                    { label: 'Priority', icon: '●', active: true, color: '#e05c5c' },
                    { label: 'Important', icon: '●', active: false, color: '#d4a853' },
                    { label: 'Marketing', icon: '📣', active: false },
                    { label: 'Snoozed', icon: '🔕', active: false },
                    { label: 'Sent', icon: '↗', active: false },
                  ].map((item) => (
                    <div key={item.label} className={`preview-nav-item${item.active ? ' active' : ''}`}>
                      <span style={{ color: item.color, fontSize: 7 }}>●</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="preview-emails">
                  {[
                    { from: 'Stripe', subject: 'Your $3,995.00 payout is on the way', snippet: "It's expected to arrive in your bank account by...", priority: '#e05c5c', time: '11:28 AM', bold: true },
                    { from: 'Sarah Chen', subject: 'Re: Q4 contract — need your sign-off today', snippet: 'Hey, legal is waiting on this before EOD Friday...', priority: '#e05c5c', time: '10:47 AM', bold: true },
                    { from: 'Marcus Webb', subject: 'Re: Series A — investor call moved up', snippet: 'The lead investor wants to move the call to Thursday...', priority: '#d4a853', time: '9:31 AM', bold: true },
                    { from: 'John Doe', subject: 'Accepted: Team Sync @ Wed Feb 25 10am', snippet: 'John Doe has accepted this invitation.', priority: '#555', time: '8:14 AM', bold: false },
                    { from: 'Substack', subject: 'New post: The AI tools reshaping how founders work', snippet: 'This week in your inbox — 5 tools worth trying...', priority: '#555', time: 'Yesterday', bold: false },
                  ].map((email) => (
                    <div key={email.subject} className="preview-email">
                      <div className="email-priority" style={{ background: email.priority }} />
                      <div className="email-body">
                        <div className="email-from">
                          <span style={{ fontWeight: email.bold ? 700 : 400 }}>{email.from}</span>
                          <span className="email-time">{email.time}</span>
                        </div>
                        <div className="email-subject" style={{ fontWeight: email.bold ? 600 : 400 }}>{email.subject}</div>
                        <div className="email-snippet">{email.snippet}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="preview-glow" />
          </div>
        </section>
      </div>

      {/* FEATURES */}
      <div className="wrap">
        <section className="features">
          <div className="section-label">What it does</div>
          <div className="features-header">
            <h2>Built for people<br />who get too much email</h2>
            <p>Every feature is designed to get you out of your inbox faster, not keep you in it longer.</p>
          </div>
          <div className="features-grid">
            {[
              { icon: '⬥', title: 'AI Priority Inbox', desc: 'Claude reads every email and classifies it HIGH, MEDIUM, or LOW based on sender, context, and your personal rules. Nothing important gets buried.' },
              { icon: '✦', title: 'Learns Your World', desc: 'Tell FocusKeep which senders, domains, and keywords matter. Rules apply instantly across your entire inbox — no re-training required.' },
              { icon: '↩', title: 'Quick Replies', desc: 'One-click AI-suggested replies appear below every email. Open, click, edit if needed, send. The whole loop in under 30 seconds.' },
              { icon: '🔕', title: 'Snooze Anything', desc: 'Hide emails until you\'re ready for them. Later today, tomorrow morning, next week — or pick a custom time. They come back when you want them.' },
              { icon: '⌨', title: 'Keyboard First', desc: 'J/K to navigate, R to reply, E to archive, # to delete. Full Superhuman-style shortcuts for people who never want to touch the mouse.' },
              { icon: '⚡', title: 'Instant Load', desc: 'Your inbox appears in ~200ms from Supabase cache while Gmail syncs in the background. No spinners. No waiting. Just email.' },
            ].map((f) => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* HOW IT WORKS */}
      <div className="wrap" id="how">
        <section className="how">
          <div className="section-label">How it works</div>
          <div className="how-grid">
            <div className="how-steps">
              {[
                { n: '01', title: 'Connect your Gmail', body: 'One click Google sign-in. FocusKeep requests read and send access — nothing else. Your emails never leave your own infrastructure.' },
                { n: '02', title: 'AI classifies your inbox', body: 'Claude reads your last 30 days of email and assigns each one a priority. The first sync takes seconds. Every sync after that is instant from cache.' },
                { n: '03', title: 'Teach it your rules', body: 'Mark a sender as always HIGH or always LOW. FocusKeep updates every email from them immediately — and remembers for every future sync.' },
                { n: '04', title: 'Stay in the zone', body: 'Open the Priority tab. Everything that needs your attention is there. Everything that doesn\'t is out of your way.' },
              ].map((s) => (
                <div key={s.n} className="how-step">
                  <span className="step-num">{s.n}</span>
                  <div className="step-content">
                    <h4>{s.title}</h4>
                    <p>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="how-visual">
              {[
                { from: 'Sarah Chen', subject: 'Contract needs sign-off today', label: 'HIGH', cls: 'high' },
                { from: 'Marcus Webb', subject: 'Re: Series A — investor call', label: 'HIGH', cls: 'high' },
                { from: 'James Liu', subject: 'Design review notes', label: 'MED', cls: 'med' },
                { from: 'Stripe', subject: 'Your invoice is ready', label: 'MED', cls: 'med' },
                { from: 'LinkedIn', subject: 'You have 12 new notifications', label: 'LOW', cls: 'low' },
              ].map((r) => (
                <div key={r.subject} className={`priority-row ${r.cls}`}>
                  <div className={`p-dot p-${r.cls}`} />
                  <div className="p-info">
                    <div className="p-from">{r.from}</div>
                    <div className="p-subject">{r.subject}</div>
                  </div>
                  <span className={`p-label ${r.cls}`}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* BOTTOM CTA */}
      <div className="wrap">
        <section className="bottom-cta">
          <h2>Your inbox.<br />Finally under control.</h2>
          <p>Free to use. Connects in 30 seconds. No credit card required.</p>
          <a href="https://app.tryfocuskeep.com/login" className="cta-primary" style={{ fontSize: 15, padding: '14px 32px' }}>
            Start for free →
          </a>
        </section>
      </div>

      {/* FOOTER */}
      <div className="wrap">
        <footer>
          <a href="/" className="logo" style={{ fontSize: 16 }}>
            <span className="logo-focus">Focus</span>
            <span className="logo-keep">Keep</span>
          </a>
          <span className="footer-note">AI-powered email · tryfocuskeep.com</span>
        </footer>
      </div>
    </>
  );
}
