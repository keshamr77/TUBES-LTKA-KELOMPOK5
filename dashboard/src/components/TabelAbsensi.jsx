import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export default function TabelAbsensi() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'attendances'), (snap) => {
      const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(rows);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <p style={{ color: '#666', fontSize: '14px' }}>Memuat data...</p>;
  if (data.length === 0) return <p style={{ color: '#666', fontSize: '14px' }}>Belum ada data absensi.</p>;

  return (
    <div style={styles.card}>
      <table style={styles.table}>
        <thead>
          <tr>
            {['Nama', 'NIM', 'Waktu Absen', 'Status', 'Koordinat'].map(h => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.id}>
              <td style={styles.td}>{row.nama || '-'}</td>
              <td style={styles.td}>{row.nim || '-'}</td>
              <td style={styles.td}>{row.waktu || '-'}</td>
              <td style={styles.td}>
                <span style={{
                  ...styles.badge,
                  background: row.status === 'hadir' ? '#e8f5e9' : row.status === 'terlambat' ? '#fff8e1' : '#ffebee',
                  color: row.status === 'hadir' ? '#2e7d32' : row.status === 'terlambat' ? '#f57f17' : '#c62828',
                }}>
                  {row.status || '-'}
                </span>
              </td>
              <td style={styles.td}>
                {row.posisi ? `${row.posisi.latitude}, ${row.posisi.longitude}` : row.latitude && row.longitude ? `${row.latitude}, ${row.longitude}` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  card: { background: '#fff', borderRadius: '12px', border: '0.5px solid #e0e0e0', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: '500', color: '#888', borderBottom: '0.5px solid #eee', textTransform: 'uppercase', letterSpacing: '0.04em' },
  td: { padding: '12px 16px', borderBottom: '0.5px solid #f0f0f0', color: '#1a1a1a' },
  badge: { padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '500' },
};