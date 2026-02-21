export default function ConfirmPage() {
  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a', color: '#888', fontFamily: 'DM Sans, sans-serif',
      fontSize: 14, flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 32 }}>✉</div>
      <div>Signing you in...</div>
    </div>
  );
}
