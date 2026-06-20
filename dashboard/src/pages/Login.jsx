import { useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // F1: Validasi role — hanya dosen yang boleh masuk
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'dosen') {
        await signOut(auth);
        setError('Akses ditolak. Hanya dosen yang bisa login ke dashboard.');
        setLoading(false);
        return;
      }
    } catch (err) {
      setError('Email atau password salah.');
    }
    setLoading(false);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>📍</div>
        <h1 style={styles.title}>Absensi GPS</h1>
        <p style={styles.sub}>Dashboard Dosen</p>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.field}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            placeholder="email@itb.ac.id"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        <button
          style={{...styles.btn, opacity: loading ? 0.7 : 1}}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Memuat...' : 'Masuk'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '380px',
    border: '0.5px solid #e0e0e0',
  },
  iconWrap: { fontSize: '32px', marginBottom: '12px' },
  title: { fontSize: '22px', fontWeight: '600', marginBottom: '4px' },
  sub: { fontSize: '14px', color: '#666', marginBottom: '28px' },
  error: { fontSize: '13px', color: '#c0392b', background: '#fdecea', padding: '10px 12px', borderRadius: '8px', marginBottom: '16px' },
  field: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#444' },
  input: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' },
  btn: { width: '100%', padding: '11px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginTop: '8px' },
};