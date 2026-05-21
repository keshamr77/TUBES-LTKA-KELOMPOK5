import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useTheme } from '../context/ThemeContext';

export default function TabelAbsensi() {
  const { dark } = useTheme();
  const [data, setData] = useState([]);
  const [sessions, setSessions] = useState([]);
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
    const q = query(collection(db, 'attendances'), orderBy('waktu', 'desc'));
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
      ? ['Nama', 'NIM', 'Kode Kelas', 'Waktu', 'Status', 'Koordinat']
      : ['Nama', 'NIM', 'Waktu', 'Status', 'Koordinat'];
    const csvRows = rows.map(r => activeTab === 'general'
      ? [r.nama || '-', r.nim || '-', r.kodeKelas || '-', r.waktu || '-', normalizeStatus(r.status), `${r.latitude || ''} ${r.longitude || ''}`]
      : [r.nama || '-', r.nim || '-', r.waktu || '-', normalizeStatus(r.status), `${r.latitude || ''} ${r.longitude || ''}`]
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
            <div style={{ marginTop: '10px', fontSize: '12px', color: sub, display: 'flex', gap: '16px' }}>
              <span>🕐 {selectedSessionData.jamMulai} – {selectedSessionData.jamSelesai}</span>
              <span>📍 Radius {selectedSessionData.radius}m</span>
              <span style={{
                padding: '2px 8px', borderRadius: '99px', fontSize: '11px',
                background: selectedSessionData.status === 'open' ? '#e8f5e9' : '#ffebee',
                color: selectedSessionData.status === 'open' ? '#2e7d32' : '#c62828',
              }}>
                {selectedSessionData.status === 'open' ? '🟢 Aktif' : '🔴 Ditutup'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tabel */}
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
                    <td style={{ ...tdStyle, color: sub }}>{row.waktu || '—'}</td>
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
        </div>
      )}
    </div>
  );
}