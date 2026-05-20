import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, onSnapshot, updateDoc,
  deleteDoc, doc, serverTimestamp, query, orderBy
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';

const KAMPUS_ITB = { lat: -6.890590, lng: 107.610692 };

export default function KelolaSesi() {
  const { dark } = useTheme();
  const { addToast } = useToast();
  const [sesiList, setSesiList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState(null); // { type: 'tutup'|'hapus', sesiId, sesiNama }
  const [form, setForm] = useState({
    namaKelas: '', kodeKelas: '',
    tanggal: new Date().toISOString().split('T')[0],
    jamMulai: '', jamSelesai: '', radius: '100',
  });

  const bg = dark ? '#1a1a1a' : '#fff';
  const border = dark ? '#2a2a2a' : '#e0e0e0';
  const text = dark ? '#f0f0f0' : '#1a1a1a';
  const sub = dark ? '#888' : '#666';
  const inputBg = dark ? '#111' : '#fff';

  // Realtime listener + auto close
  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const now = new Date();
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Auto close sesi yang sudah lewat jam selesai
      data.forEach(async (sesi) => {
        if (sesi.status === 'active' && sesi.tanggal && sesi.jamSelesai) {
          const selesai = new Date(`${sesi.tanggal}T${sesi.jamSelesai}:00`);
          if (now > selesai) {
            await updateDoc(doc(db, 'sessions', sesi.id), { status: 'closed' });
          }
        }
      });

      setSesiList(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleBuatSesi = async () => {
    if (!form.namaKelas || !form.jamMulai || !form.jamSelesai) {
      addToast('Mohon lengkapi semua field yang wajib diisi.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'sessions'), {
        namaKelas: form.namaKelas,
        kodeKelas: form.kodeKelas,
        tanggal: form.tanggal,
        jamMulai: form.jamMulai,
        jamSelesai: form.jamSelesai,
        radius: parseInt(form.radius),
        latitude: KAMPUS_ITB.lat,
        longitude: KAMPUS_ITB.lng,
        status: 'active',
        dosenEmail: auth.currentUser?.email,
        createdAt: serverTimestamp(),
      });
      setFormOpen(false);
      setForm({ namaKelas: '', kodeKelas: '', tanggal: new Date().toISOString().split('T')[0], jamMulai: '', jamSelesai: '', radius: '100' });
      addToast('Sesi berhasil dibuat!', 'success');
    } catch (err) {
      addToast('Gagal membuat sesi: ' + err.message, 'error');
    }
    setSubmitting(false);
  };

  const handleTutupSesi = async (sesiId) => {
    try {
      await updateDoc(doc(db, 'sessions', sesiId), { status: 'closed' });
      addToast('Sesi berhasil ditutup.', 'info');
    } catch (err) {
      addToast('Gagal menutup sesi.', 'error');
    }
    setModal(null);
  };

  const handleHapusSesi = async (sesiId) => {
    try {
      await deleteDoc(doc(db, 'sessions', sesiId));
      addToast('Sesi berhasil dihapus.', 'info');
    } catch (err) {
      addToast('Gagal menghapus sesi.', 'error');
    }
    setModal(null);
  };

  const handleExportCSV = (sesi) => {
    const rows = [
      ['Nama Kelas', 'Kode', 'Tanggal', 'Jam Mulai', 'Jam Selesai', 'Status', 'Radius'],
      [sesi.namaKelas, sesi.kodeKelas, sesi.tanggal, sesi.jamMulai, sesi.jamSelesai, sesi.status, sesi.radius + 'm'],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sesi-${sesi.namaKelas}-${sesi.tanggal}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('CSV berhasil didownload!', 'success');
  };

  const statusStyle = (status) => ({
    active: { bg: '#e8f5e9', color: '#2e7d32', label: '🟢 Aktif' },
    closed: { bg: '#ffebee', color: '#c62828', label: '🔴 Ditutup' },
  }[status] || { bg: '#f5f5f5', color: '#666', label: status });

  const inputStyle = { padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, fontSize: '13px', outline: 'none', background: inputBg, color: text, width: '100%' };

  return (
    <div>
      {/* Modal Konfirmasi */}
      {modal?.type === 'tutup' && (
        <Modal
          title="Tutup Sesi?"
          message={`Sesi "${modal.sesiNama}" akan ditutup. Mahasiswa tidak bisa absen lagi setelah ini.`}
          onConfirm={() => handleTutupSesi(modal.sesiId)}
          onCancel={() => setModal(null)}
          confirmLabel="Tutup Sesi"
          confirmDanger
        />
      )}
      {modal?.type === 'hapus' && (
        <Modal
          title="Hapus Sesi?"
          message={`Sesi "${modal.sesiNama}" akan dihapus permanen dan tidak bisa dikembalikan.`}
          onConfirm={() => handleHapusSesi(modal.sesiId)}
          onCancel={() => setModal(null)}
          confirmLabel="Hapus"
          confirmDanger
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '2px', color: text }}>Sesi Absensi</h2>
          <p style={{ fontSize: '13px', color: sub }}>Buat dan kelola sesi kelas agar mahasiswa bisa absen</p>
        </div>
        <button
          onClick={() => setFormOpen(!formOpen)}
          style={{ padding: '9px 18px', background: formOpen ? '#666' : '#1a73e8', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
        >
          {formOpen ? '✕ Batal' : '+ Buat Sesi Baru'}
        </button>
      </div>

      {/* Form */}
      {formOpen && (
        <div style={{ background: bg, borderRadius: '12px', border: `0.5px solid ${border}`, padding: '20px 24px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: text }}>Buat Sesi Baru</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            {[
              { label: 'Nama Kelas *', key: 'namaKelas', placeholder: 'Layanan Tersambung & Komputasi Awan', type: 'text' },
              { label: 'Kode Kelas', key: 'kodeKelas', placeholder: 'IF-43-01', type: 'text' },
              { label: 'Tanggal *', key: 'tanggal', type: 'date' },
              { label: 'Jam Mulai *', key: 'jamMulai', type: 'time' },
              { label: 'Jam Selesai *', key: 'jamSelesai', type: 'time' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: sub, marginBottom: '6px' }}>{f.label}</label>
                <input
                  style={inputStyle}
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: sub, marginBottom: '6px' }}>Radius</label>
              <select style={inputStyle} value={form.radius} onChange={e => setForm({ ...form, radius: e.target.value })}>
                {['50', '100', '200', '300'].map(r => <option key={r} value={r}>{r} meter</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: sub, background: dark ? '#111' : '#f5f5f5', padding: '8px 12px', borderRadius: '8px', marginBottom: '14px' }}>
            📍 Lokasi: ITB Ganesha ({KAMPUS_ITB.lat}, {KAMPUS_ITB.lng}) · Auto close saat jam selesai
          </div>
          <button
            onClick={handleBuatSesi}
            disabled={submitting}
            style={{ padding: '9px 18px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Menyimpan...' : '✓ Simpan Sesi'}
          </button>
        </div>
      )}

      {/* Daftar Sesi */}
      {loading ? (
        <p style={{ color: sub, fontSize: '14px' }}>Memuat sesi...</p>
      ) : sesiList.length === 0 ? (
        <div style={{ background: bg, borderRadius: '12px', border: `0.5px solid ${border}`, padding: '40px', textAlign: 'center', color: sub }}>
          <p style={{ fontSize: '32px', marginBottom: '8px' }}>🗓️</p>
          <p style={{ fontWeight: '500', marginBottom: '4px', color: text }}>Belum ada sesi</p>
          <p style={{ fontSize: '13px' }}>Klik "Buat Sesi Baru" untuk membuat sesi absensi pertama</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
          {sesiList.map(sesi => {
            const st = statusStyle(sesi.status);
            return (
              <div key={sesi.id} style={{ background: bg, borderRadius: '12px', border: `0.5px solid ${border}`, padding: '16px 20px' }}>

                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '2px', color: text }}>{sesi.namaKelas}</div>
                    <div style={{ fontSize: '12px', color: sub }}>{sesi.kodeKelas} · {sesi.tanggal}</div>
                  </div>
                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: '500', background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                    {st.label}
                  </span>
                </div>

                {/* Info */}
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: sub, marginBottom: '14px' }}>
                  <span>🕐 {sesi.jamMulai} – {sesi.jamSelesai}</span>
                  <span>📍 Radius {sesi.radius}m</span>
                </div>

                {/* Statistik */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  {[
                    { label: 'Hadir', val: sesi.statHadir ?? 0, color: '#2e7d32', bg: '#e8f5e9' },
                    { label: 'Terlambat', val: sesi.statTerlambat ?? 0, color: '#f57f17', bg: '#fff8e1' },
                    { label: 'Absen', val: sesi.statAbsen ?? 0, color: '#c62828', bg: '#ffebee' },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: '600', color: s.color }}>{s.val}</div>
                      <div style={{ fontSize: '10px', color: s.color }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleExportCSV(sesi)}
                    style={{ flex: 1, padding: '7px', borderRadius: '8px', border: `0.5px solid ${border}`, background: 'transparent', fontSize: '12px', cursor: 'pointer', color: text }}
                  >
                    ⬇ Export CSV
                  </button>
                  {sesi.status === 'active' && (
                    <button
                      onClick={() => setModal({ type: 'tutup', sesiId: sesi.id, sesiNama: sesi.namaKelas })}
                      style={{ flex: 1, padding: '7px', borderRadius: '8px', border: '1px solid #f5c2c2', background: 'transparent', fontSize: '12px', cursor: 'pointer', color: '#c62828' }}
                    >
                      ⏹ Tutup Sesi
                    </button>
                  )}
                  <button
                    onClick={() => setModal({ type: 'hapus', sesiId: sesi.id, sesiNama: sesi.namaKelas })}
                    style={{ padding: '7px 12px', borderRadius: '8px', border: `0.5px solid ${border}`, background: 'transparent', fontSize: '12px', cursor: 'pointer', color: '#c62828' }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}