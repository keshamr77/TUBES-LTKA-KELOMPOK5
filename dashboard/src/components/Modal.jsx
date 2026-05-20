import { useTheme } from '../context/ThemeContext';

export default function Modal({ title, message, onConfirm, onCancel, confirmLabel = 'Ya', confirmDanger = false }) {
  const { dark } = useTheme();
  const bg = dark ? '#1e1e1e' : '#fff';
  const overlay = 'rgba(0,0,0,0.5)';

  return (
    <div style={{ position: 'fixed', inset: 0, background: overlay, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: bg, borderRadius: '14px', padding: '28px', width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>{title}</h3>
        <p style={{ fontSize: '14px', color: dark ? '#aaa' : '#666', marginBottom: '24px', lineHeight: '1.5' }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', borderRadius: '8px', border: '0.5px solid #ddd', background: 'transparent', fontSize: '13px', cursor: 'pointer', color: dark ? '#ccc' : '#444' }}>
            Batal
          </button>
          <button onClick={onConfirm} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: confirmDanger ? '#c62828' : '#1a73e8', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}