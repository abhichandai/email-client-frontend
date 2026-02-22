'use client';

interface KeyboardShortcutsHelpProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['J', 'K'], label: 'Next / previous email' },
  { keys: ['Enter'], label: 'Open selected email' },
  { keys: ['Escape'], label: 'Close email / dismiss' },
  { keys: ['/'], label: 'Search' },
  { keys: ['C'], label: 'Compose new email' },
  { keys: ['R'], label: 'Reply' },
  { keys: ['E'], label: 'Mark complete' },
  { keys: ['U'], label: 'Toggle read / unread' },
  { keys: ['#'], label: 'Delete email' },
  { keys: ['?'], label: 'Show this help' },
];

export default function KeyboardShortcutsHelp({ onClose }: KeyboardShortcutsHelpProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '28px 32px',
          minWidth: 360,
          boxShadow: '0 24px 64px var(--shadow)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '0.02em' }}>
            Keyboard Shortcuts
          </span>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}
          >×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SHORTCUTS.map(({ keys, label }) => (
            <div
              key={label}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {keys.map(k => (
                  <kbd
                    key={k}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 24, height: 24, padding: '0 6px',
                      background: 'rgba(212,168,83,0.1)',
                      border: '1px solid rgba(212,168,83,0.3)',
                      borderRadius: 5,
                      fontSize: 12, fontFamily: 'monospace', fontWeight: 600,
                      color: 'var(--accent)',
                    }}
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Shortcuts are disabled when typing in a text field
        </p>
      </div>
    </div>
  );
}
