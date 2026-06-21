import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useTheme } from '../context/ThemeContext';

export default function TabelAbsensi() {
  const { dark } = useTheme();
  const [data, setData] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [courseStudents, setCourseStudents] = useState([]); // students of selected course
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [selectedSession, setSelectedSession] = useState('');

  const bg = dark ? '#1a1a1a' : '#fff';
  const border = dark ? '#2a2a2a' : '#e0e0e0';
  const text = dark ? '#f0f0f0' : '#1a1a1a';
  const sub = dark ? '#888' : '#666';
  const headerBg = dark ? '#111' : '#fafafa';
  const rowHover = dark ? '#222' : '#f9f9f9';

  // Ambil semua attendances
  useEffect(() => {
    const q = query(collection(db, 'attendances'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Ambil semua sessions untuk dropdown
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'sessions'), (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Load students when a session with courseId is selected
  useEffect(() => {
    const session = sessions.find(s => s.id === selectedSession);
    if (!session?.courseId) {
      setCourseStudents([]);
      return;
    }
    const loadStudents = async () => {
      try {
        const snap = await getDocs(collection(db, 'courses', session.courseId, 'students'));
        setCourseStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setCourseStudents([]);
      }
    };
    loadStudents();
  }, [selectedSession, sessions]);

  const normalizeStatus = (status) => {
    if (!status) return '-';
    if (status === 'present' || status === 'hadir') return 'hadir';
    if (status === 'late' || status === 'terlambat') return 'terlambat';
    if (status === 'absent' || status === 'tidak hadir') return 'tidak hadir';
    return status;
  };

  const statusStyle = (raw) => {
    const s = normalizeStatus(raw);
    if (s === 'hadir') return { bg: '#e8f5e9', color: '#2e7d32', label: '✓ Hadir' };
    if (s === 'terlambat') return { bg: '#fff8e1', color: '#f57f17', label: '⏰ Terlambat' };
    return { bg: '#ffebee', color: '#c62828', label: '✕ Tidak Hadir' };
  };

  const handleExportCSV = (rows, filename) => {
    const headers = activeTab === 'general'
      ? ['Nama', 'NIM', 'Kode Kelas', 'Waktu', 'Tipe', 'Status', 'Koordinat']
      : ['Nama', 'NIM', 'Waktu', 'Tipe', 'Status', 'Koordinat'];
    const csvRows = rows.map(r => activeTab === 'general'
      ? [r.nama || '-', r.nim || '-', r.kodeKelas || '-', r.timestamp?.toDate ? r.timestamp.toDate().toLocaleString('id-ID') : (r.timestamp || '-'), r.type === 'check_out' ? 'Keluar' : 'Masuk', normalizeStatus(r.status), `${r.latitude || ''} ${r.longitude || ''}`]
      : [r.nama || '-', r.nim || '-', r.timestamp?.toDate ? r.timestamp.toDate().toLocaleString('id-ID') : (r.timestamp || '-'), r.type === 'check_out' ? 'Keluar' : 'Masuk', normalizeStatus(r.status), `${r.latitude || ''} ${r.longitude || ''}`]
    );
    const csv = [headers, ...csvRows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter data per kelas
  const filteredData = activeTab === 'perkelas' && selectedSession
    ? data.filter(r => r.sessionId === selectedSession)
    : data;

  const selectedSessionData = sessions.find(s => s.id === selectedSession);

  // Hitung mahasiswa yang belum absen (hanya check_in yang dihitung)
  const checkInData = filteredData.filter(r => r.type === 'check_in' || !r.type);
  const checkedInNIMs = new Set(checkInData.map(r => r.nim).filter(Boolean));
  const absentStudents = courseStudents.filter(s => !checkedInNIMs.has(s.nim));

  // Statistik untuk summary
  const totalTerdaftar = courseStudents.length;
  const totalHadir = checkInData.filter(r => normalizeStatus(r.status) === 'hadir').length;
  const totalTerlambat = checkInData.filter(r => normalizeStatus(r.status) === 'terlambat').length;
  const totalAbsen = totalTerdaftar > 0 ? absentStudents.length : 0;

  const thStyle = {
    textAlign: 'left', padding: '10px 16px', fontSize: '11px',
    fontWeight: '500', color: sub, borderBottom: `0.5px solid ${border}`,
    textTransform: 'uppercase', letterSpacing: '0.04em', background: headerBg,
  };
  const tdStyle = {
    padding: '12px 16px', borderBottom: `0.5px solid ${border}`, color: text, fontSize: '13px',
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '2px', color: text }}>Rekap Absensi</h2>
          <p style={{ fontSize: '13px', color: sub }}>
            {activeTab === 'general' ? `${data.length} total data absensi` : `Filter per kelas`}
          </p>
        </div>
        <button
          onClick={() => handleExportCSV(filteredData, `rekap-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`)}
          style={{ padding: '8px 16px', borderRadius: '8px', border: `0.5px solid ${border}`, background: 'transparent', fontSize: '12px', cursor: 'pointer', color: text }}
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Sub Tab */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[['general', '📋 Semua Kelas'], ['perkelas', '🏫 Per Kelas']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setSelectedSession(''); }}
            style={{
              padding: '7px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
              background: activeTab === key ? (dark ? '#2a2a2a' : '#f0f0f0') : 'transparent',
              color: activeTab === key ? text : sub,
              border: `0.5px solid ${activeTab === key ? border : 'transparent'}`,
              fontWeight: activeTab === key ? '500' : '400',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Dropdown pilih kelas (hanya di tab Per Kelas) */}
      {activeTab === 'perkelas' && (
        <div style={{ marginBottom: '16px' }}>
          <select
            value={selectedSession}
            onChange={e => setSelectedSession(e.target.value)}
            style={{
              padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`,
              fontSize: '13px', background: dark ? '#111' : '#fff', color: text,
              minWidth: '300px', outline: 'none',
            }}
          >
            <option value="">— Pilih Kelas —</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.namaKelas} {s.kodeKelas ? `(${s.kodeKelas})` : ''} · {s.tanggal}
              </option>
            ))}
          </select>
          {selectedSessionData && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: sub, display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>🕐 {selectedSessionData.jamMulai} – {selectedSessionData.jamSelesai}</span>
              {selectedSessionData.modePilihan === 'wfh' ? (
                <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', background: '#e3f2fd', color: '#1565c0', fontWeight: '500' }}>🏠 WFH</span>
              ) : (
                <>
                  <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', background: '#e8f5e9', color: '#2e7d32', fontWeight: '500' }}>🏫 {selectedSessionData.lokasiKelas || 'Kelas'}</span>
                  <span>📍 Radius {selectedSessionData.radius}m</span>
                </>
              )}
              <span style={{
                padding: '2px 8px', borderRadius: '99px', fontSize: '11px',
                background: selectedSessionData.status === 'open' ? '#e8f5e9' : '#ffebee',
                color: selectedSessionData.status === 'open' ? '#2e7d32' : '#c62828',
              }}>
                {selectedSessionData.status === 'open' ? '🟢 Aktif' : '🔴 Ditutup'}
              </span>
              {selectedSessionData.courseId && (
                <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', background: dark ? 'rgba(156,39,176,0.15)' : '#f3e5f5', color: '#7b1fa2', fontWeight: '500' }}>
                  📚 Terhubung ke Mata Kuliah
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Statistik Cards — hanya muncul di per-kelas dengan courseId */}
      {activeTab === 'perkelas' && selectedSession && totalTerdaftar > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'Terdaftar', value: totalTerdaftar, color: '#1565c0', bg: dark ? 'rgba(21,101,192,0.12)' : '#e3f2fd', icon: '👥' },
            { label: 'Hadir', value: totalHadir, color: '#2e7d32', bg: dark ? 'rgba(46,125,50,0.12)' : '#e8f5e9', icon: '✓' },
            { label: 'Terlambat', value: totalTerlambat, color: '#f57f17', bg: dark ? 'rgba(245,127,23,0.12)' : '#fff8e1', icon: '⏰' },
            { label: 'Belum Absen', value: totalAbsen, color: '#c62828', bg: dark ? 'rgba(198,40,40,0.12)' : '#ffebee', icon: '✕' },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, borderRadius: '10px', padding: '14px 16px',
              border: `0.5px solid ${border}`,
            }}>
              <div style={{ fontSize: '11px', color: s.color, fontWeight: '500', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {s.icon} {s.label}
              </div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabel Absensi */}
      <div style={{ background: bg, borderRadius: '12px', border: `0.5px solid ${border}`, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '24px', color: sub, fontSize: '14px' }}>Memuat data...</p>
        ) : filteredData.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: sub }}>
            <p style={{ fontSize: '28px', marginBottom: '8px' }}>📭</p>
            <p style={{ fontWeight: '500', color: text, marginBottom: '4px' }}>
              {activeTab === 'perkelas' && !selectedSession ? 'Pilih kelas dulu' : 'Belum ada data absensi'}
            </p>
            <p style={{ fontSize: '13px' }}>
              {activeTab === 'perkelas' && !selectedSession
                ? 'Pilih kelas dari dropdown di atas'
                : 'Data akan muncul saat mahasiswa mulai absen'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={thStyle}>Nama</th>
                <th style={thStyle}>NIM</th>
                {activeTab === 'general' && <th style={thStyle}>Kode Kelas</th>}
                <th style={thStyle}>Waktu Absen</th>
                {activeTab === 'general' && <th style={thStyle}>Nama Kelas</th>}
                <th style={thStyle}>Tipe</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Koordinat</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, i) => {
                const st = statusStyle(row.status);
                return (
                  <tr
                    key={row.id}
                    style={{ background: i % 2 === 0 ? 'transparent' : (dark ? '#161616' : '#fafafa') }}
                    onMouseEnter={e => e.currentTarget.style.background = rowHover}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : (dark ? '#161616' : '#fafafa')}
                  >
                    <td style={tdStyle}>
                      <div style={{ fontWeight: '500' }}>{row.nama || <span style={{ color: sub }}>—</span>}</div>
                    </td>
                    <td style={{ ...tdStyle, color: sub }}>{row.nim || '—'}</td>
                    {activeTab === 'general' && (
                      <td style={{ ...tdStyle, color: sub }}>{row.kodeKelas || '—'}</td>
                    )}
                    <td style={{ ...tdStyle, color: sub, fontSize: '12px' }}>
                      {row.timestamp?.toDate
                        ? row.timestamp.toDate().toLocaleString('id-ID')
                        : row.timestamp || '—'}
                    </td>
                    {activeTab === 'general' && (
                      <td style={{ ...tdStyle, color: sub }}>{row.namaKelas || '—'}</td>
                    )}
                    <td style={tdStyle}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '4px', fontSize: '11px',
                        fontWeight: '500',
                        background: row.type === 'check_out' ? (dark ? 'rgba(33, 150, 243, 0.15)' : '#e3f2fd') : (dark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9'),
                        color: row.type === 'check_out' ? (dark ? '#90caf9' : '#1e88e5') : (dark ? '#a5d6a7' : '#2e7d32'),
                      }}>
                        {row.type === 'check_out' ? 'Keluar' : 'Masuk'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '99px', fontSize: '11px',
                        fontWeight: '500', background: st.bg, color: st.color,
                      }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: sub, fontSize: '12px' }}>
                      {row.latitude && row.longitude ? `${row.latitude}, ${row.longitude}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Tabel Belum Absen — hanya muncul di per-kelas jika ada courseId */}
      {activeTab === 'perkelas' && selectedSession && absentStudents.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#c62828', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚠️ Belum Absen ({absentStudents.length} mahasiswa)
          </h3>
          <div style={{ background: bg, borderRadius: '12px', border: `0.5px solid ${border}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>NIM</th>
                  <th style={thStyle}>Nama</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {absentStudents.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? 'transparent' : (dark ? '#161616' : '#fafafa') }}>
                    <td style={{ ...tdStyle, color: sub, width: '50px' }}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{s.nim}</td>
                    <td style={tdStyle}>{s.nama}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '99px', fontSize: '11px',
                        fontWeight: '500', background: '#ffebee', color: '#c62828',
                      }}>
                        ✕ Belum Absen
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary bar */}
      {filteredData.length > 0 && (
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '12px', color: sub }}>
          {[
            { label: 'Hadir', val: filteredData.filter(r => normalizeStatus(r.status) === 'hadir').length, color: '#2e7d32' },
            { label: 'Terlambat', val: filteredData.filter(r => normalizeStatus(r.status) === 'terlambat').length, color: '#f57f17' },
            { label: 'Tidak Hadir', val: filteredData.filter(r => normalizeStatus(r.status) === 'tidak hadir').length, color: '#c62828' },
          ].map(s => (
            <span key={s.label} style={{ color: s.color, fontWeight: '500' }}>
              {s.label}: {s.val}
            </span>
          ))}
          <span>· Total: {filteredData.length}</span>
          {totalTerdaftar > 0 && <span>· Belum absen: {totalAbsen}</span>}
        </div>
      )}
    </div>
  );
}