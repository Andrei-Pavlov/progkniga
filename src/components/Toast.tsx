import { useToastStore } from '../store-toast';

const COLORS: Record<string, { bg: string; border: string }> = {
  success: { bg: 'var(--success)', border: 'var(--success)' },
  error: { bg: 'var(--error)', border: 'var(--error)' },
  info: { bg: 'var(--accent)', border: 'var(--accent)' },
};

export function ToastContainer() {
  const { toasts, remove } = useToastStore();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => remove(t.id)}
          style={{
            padding: '12px 20px',
            background: 'var(--bg-secondary)',
            borderLeft: `4px solid ${COLORS[t.type]?.border ?? 'var(--accent)'}`,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            color: 'var(--text-primary)',
            fontSize: 14,
            pointerEvents: 'auto',
            cursor: 'pointer',
            animation: 'toast-in 0.25s ease-out',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
