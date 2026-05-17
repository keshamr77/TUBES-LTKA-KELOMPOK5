import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import TabelAbsensi from '../components/TabelAbsensi';

export default function Dashboard() {
  const user = auth.currentUser;

  return (
    <div style={styles.wrapper}>
      <nav style={styles.nav}>
        <div style={styles.navLogo}>📍 Absensi GPS — Dashboard Dosen</div>
        <div style={styles.navRight}>
          <span style={styles.email}>{user?.email}</span>
          <button style={styles.logoutBtn} onClick={() => signOut(auth)}>
            Keluar
          </button>
        </div>
      </nav>

      <div style={styles.main}>
        <h1 style={styles.pageTitle}>Rekap Kehadiran</h1>
        <p style={styles.pageSub}>Data absensi mahasiswa secara realtime</p>
        <TabelAbsensi />
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: '100vh', background: '#f5f5f5' },
  nav: { background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' },
  navLogo: { fontSize: '15px', fontWeight: '500' },
  navRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  email: { fontSize: '13px', color: '#666' },
  logoutBtn: { fontSize: '13px', padding: '6px 12px', borderRadius: '8px', border: '0.5px solid #ddd', background: 'transparent', cursor: 'pointer' },
  main: { padding: '24px' },
  pageTitle: { fontSize: '20px', fontWeight: '600', marginBottom: '4px' },
  pageSub: { fontSize: '13px', color: '#666', marginBottom: '20px' },
};