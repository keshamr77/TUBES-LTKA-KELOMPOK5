import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, onSnapshot, updateDoc,
  deleteDoc, doc, serverTimestamp, query, orderBy, getDocs
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';

const CHECKPOINTS = {
  LTRGM: { label: 'LTRGM', lat: -6.890535729447833, lng: 107.60826648987447 },
  'LABTEK VIII': { label: 'LABTEK VIII', lat: -6.890526003964189, lng: 107.6111579521029 },
};

export default function KelolaSesi() {
  const { dark } = useTheme();
  const { addToast } = useToast();
  const [sesiList, setSesiList] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseStudentsMap, setCourseStudentsMap] = useState({}); // { courseId: [{nim, nama}] }
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState(null); // { type: 'tutup'|'hapus', sesiId, sesiNama }
  const [form, setForm] = useState({
    courseId: '', namaKelas: '', kodeKelas: '',
    tanggal: new Date().toISOString().split('T')[0],
    jamMulai: '', jamSelesai: '', radius: '100',
    modePilihan: 'kelas', lokasiKelas: 'LTRGM',
    jumlahMahasiswa: '',
  });

  const bg = dark ? '#1a1a1a' : '#fff';
  const border = dark ? '#2a2a2a' : '#e0e0e0';
  const text = dark ? '#f0f0f0' : '#1a1a1a';
  const sub = dark ? '#888' : '#666';
  const inputBg = dark ? '#111' : '#fff';

  // Helper: hitung statistik per sesi dari data attendances
  const getSessionStats = useCallback((sessionId, jumlahMhs, courseId) => {
    // Filter attendances untuk sesi ini, hanya check_in (bukan check_out)
    const sesiAttendances = attendances.filter(
      a => a.sessionId === sessionId && a.type !== 'check_out'
    );

    // Deduplicate per NIM — ambil status terakhir tiap mahasiswa
    const perMhs = {};
    sesiAttendances.forEach(a => {
      const key = a.nim || a.nama || a.id; // fallback jika nim kosong
      // Simpan yang terakhir (attendances sudah sorted desc by timestamp)
      if (!perMhs[key]) perMhs[key] = a;
    });

    const uniqueList = Object.values(perMhs);
    const normalizeStatus = (s) => {
      if (!s) return 'hadir';
      if (s === 'present' || s === 'hadir') return 'hadir';
      if (s === 'late' || s === 'terlambat') return 'terlambat';
      if (s === 'absent' || s === 'tidak hadir') return 'tidak hadir';
      return s;
    };

    const hadir = uniqueList.filter(a => normalizeStatus(a.status) === 'hadir').length;
    const terlambat = uniqueList.filter(a => normalizeStatus(a.status) === 'terlambat').length;
    const totalHadir = hadir + terlambat;

    // Jika ada courseId dan student list, hitung absen dari daftar terdaftar
    const courseStudents = courseId ? (courseStudentsMap[courseId] || []) : [];
    let total;
    if (courseStudents.length > 0) {
      total = courseStudents.length;
    } else {
      total = parseInt(jumlahMhs) || 0;
    }
    const absen = total > 0 ? Math.max(0, total - totalHadir) : 0;

    return { hadir, terlambat, absen, total };
  }, [attendances, courseStudentsMap]);

  // Realtime listener untuk attendances
  useEffect(() => {
    const q = query(collection(db, 'attendances'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAttendances(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Realtime listener untuk courses
  useEffect(() => {
    const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const email = auth.currentUser?.email;
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCourses(email ? data.filter(c => c.dosenEmail === email) : data);
    });
    return () => unsub();
  }, []);

  // Load students for courses that have sessions (for stats)
  useEffect(() => {
    const courseIds = [...new Set(sesiList.map(s => s.courseId).filter(Boolean))];
    courseIds.forEach(async (cid) => {
      if (courseStudentsMap[cid]) return; // already loaded
      try {
        const snap = await getDocs(collection(db, 'courses', cid, 'students'));
        const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCourseStudentsMap(prev => ({ ...prev, [cid]: students }));
      } catch (e) { /* ignore */ }
    });
  }, [sesiList, courseStudentsMap]);

  // Realtime listener + auto close
  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const now = new Date();
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Auto close sesi yang sudah lewat jam selesai
      data.forEach(async (sesi) => {
        if (sesi.status === 'open' && sesi.tanggal && sesi.jamSelesai) {
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
    if (form.modePilihan === 'kelas' && !form.lokasiKelas) {
      addToast('Mohon pilih lokasi kelas.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const isKelas = form.modePilihan === 'kelas';
      const checkpoint = isKelas ? CHECKPOINTS[form.lokasiKelas] : null;
      await addDoc(collection(db, 'sessions'), {
        namaKelas: form.namaKelas,
        kodeKelas: form.kodeKelas,
        tanggal: form.tanggal,
        jamMulai: form.jamMulai,
        jamSelesai: form.jamSelesai,
        radius: isKelas ? parseInt(form.radius) : 0,
        latitude: checkpoint ? checkpoint.lat : null,
        longitude: checkpoint ? checkpoint.lng : null,
        modePilihan: form.modePilihan,
        lokasiKelas: isKelas ? form.lokasiKelas : null,
        locationType: isKelas ? 'smart_classroom' : 'wfh',
        locationRequired: isKelas,
        jumlahMahasiswa: parseInt(form.jumlahMahasiswa) || 0,
        courseId: form.courseId || null,
        status: 'open',
        dosenEmail: auth.currentUser?.email,
        createdAt: serverTimestamp(),
      });
      setFormOpen(false);
      setForm({ courseId: '', namaKelas: '', kodeKelas: '', tanggal: new Date().toISOString().split('T')[0], jamMulai: '', jamSelesai: '', radius: '100', modePilihan: 'kelas', lokasiKelas: 'LTRGM', jumlahMahasiswa: '' });
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
    open: { bg: '#e8f5e9', color: '#2e7d32', label: '🟢 Terbuka' },
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

          {/* Pilih Mata Kuliah */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: sub, marginBottom: '6px' }}>Mata Kuliah</label>
            <select
              style={inputStyle}
              value={form.courseId}
              onChange={e => {
                const cid = e.target.value;
                if (!cid) {
                  setForm({ ...form, courseId: '', namaKelas: '', kodeKelas: '', jumlahMahasiswa: '' });
                  return;
                }
                const c = courses.find(x => x.id === cid);
                if (c) {
                  setForm({ ...form, courseId: cid, namaKelas: c.nama, kodeKelas: c.kode || '', jumlahMahasiswa: String(c.jumlahMahasiswa || 0) });
                }
              }}
            >
              <option value="">— Tanpa Mata Kuliah (input manual) —</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nama} {c.kode ? `(${c.kode})` : ''} · {c.jumlahMahasiswa || 0} mahasiswa
                </option>
              ))}
            </select>
            {courses.length === 0 && (
              <p style={{ fontSize: '11px', color: '#f57f17', marginTop: '6px', fontStyle: 'italic' }}>
                Belum ada mata kuliah. Buat dulu di tab 📚 Mata Kuliah.
              </p>
            )}
          </div>

          {/* Mode Pilihan: Kelas / WFH */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: sub, marginBottom: '8px' }}>Mode Kehadiran *</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[{ key: 'kelas', icon: '🏫', label: 'Kelas (Onsite)' }, { key: 'wfh', icon: '🏠', label: 'WFH (Online)' }].map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setForm({ ...form, modePilihan: m.key })}
                  style={{
                    flex: 1, padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500',
                    border: form.modePilihan === m.key ? '2px solid #1a73e8' : `1px solid ${border}`,
                    background: form.modePilihan === m.key ? (dark ? 'rgba(26,115,232,0.12)' : '#e8f0fe') : 'transparent',
                    color: form.modePilihan === m.key ? '#1a73e8' : text,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            {[
              { label: 'Nama Kelas *', key: 'namaKelas', placeholder: 'Layanan Tersambung & Komputasi Awan', type: 'text', readOnly: !!form.courseId },
              { label: 'Kode Kelas', key: 'kodeKelas', placeholder: 'IF-43-01', type: 'text', readOnly: !!form.courseId },
              { label: 'Tanggal *', key: 'tanggal', type: 'date' },
              { label: 'Jam Mulai *', key: 'jamMulai', type: 'time' },
              { label: 'Jam Selesai *', key: 'jamSelesai', type: 'time' },
              { label: 'Jumlah Mahasiswa *', key: 'jumlahMahasiswa', placeholder: 'Contoh: 40', type: 'number', readOnly: !!form.courseId },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: sub, marginBottom: '6px' }}>
                  {f.label}
                  {f.readOnly && <span style={{ fontSize: '10px', color: '#1a73e8', marginLeft: '6px' }}>auto</span>}
                </label>
                <input
                  style={{ ...inputStyle, ...(f.readOnly ? { opacity: 0.7, cursor: 'not-allowed' } : {}) }}
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  readOnly={f.readOnly}
                  onChange={e => !f.readOnly && setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}

            {/* Lokasi Kelas — hanya muncul di mode kelas */}
            {form.modePilihan === 'kelas' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: sub, marginBottom: '6px' }}>Lokasi Kelas *</label>
                <select style={inputStyle} value={form.lokasiKelas} onChange={e => setForm({ ...form, lokasiKelas: e.target.value })}>
                  {Object.keys(CHECKPOINTS).map(k => <option key={k} value={k}>{CHECKPOINTS[k].label}</option>)}
                </select>
              </div>
            )}

            {/* Radius — hanya muncul di mode kelas */}
            {form.modePilihan === 'kelas' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: sub, marginBottom: '6px' }}>Radius</label>
                <select style={inputStyle} value={form.radius} onChange={e => setForm({ ...form, radius: e.target.value })}>
                  {['50', '100', '200', '300'].map(r => <option key={r} value={r}>{r} meter</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Info panel */}
          <div style={{ fontSize: '12px', color: sub, background: dark ? '#111' : '#f5f5f5', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', lineHeight: '1.6' }}>
            {form.modePilihan === 'kelas' ? (
              <>
                📍 Lokasi: <strong style={{ color: text }}>{CHECKPOINTS[form.lokasiKelas]?.label}</strong>{' '}
                ({CHECKPOINTS[form.lokasiKelas]?.lat}, {CHECKPOINTS[form.lokasiKelas]?.lng})
                {' · '} Radius {form.radius}m · Auto close saat jam selesai
              </>
            ) : (
              <>
                🏠 Mode WFH — Mahasiswa bisa absen dari mana saja tanpa validasi GPS · Auto close saat jam selesai
              </>
            )}
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
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '12px', color: sub, marginBottom: '14px' }}>
                  <span>🕐 {sesi.jamMulai} – {sesi.jamSelesai}</span>
                  {sesi.modePilihan === 'wfh' ? (
                    <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', background: dark ? 'rgba(33,150,243,0.15)' : '#e3f2fd', color: dark ? '#90caf9' : '#1565c0', fontWeight: '500' }}>🏠 WFH</span>
                  ) : (
                    <>
                      <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', background: dark ? 'rgba(76,175,80,0.15)' : '#e8f5e9', color: dark ? '#a5d6a7' : '#2e7d32', fontWeight: '500' }}>🏫 {sesi.lokasiKelas || 'Kelas'}</span>
                      <span>📍 Radius {sesi.radius}m</span>
                    </>
                  )}
                </div>

                {/* Statistik */}
                {(() => {
                  const stats = getSessionStats(sesi.id, sesi.jumlahMahasiswa, sesi.courseId);
                  return (
                    <>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        {[
                          { label: 'Hadir', val: stats.hadir, color: '#2e7d32', bg: '#e8f5e9' },
                          { label: 'Terlambat', val: stats.terlambat, color: '#f57f17', bg: '#fff8e1' },
                          { label: 'Absen', val: stats.absen, color: '#c62828', bg: '#ffebee' },
                        ].map(s => (
                          <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: '600', color: s.color }}>{s.val}</div>
                            <div style={{ fontSize: '10px', color: s.color }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                      {stats.total > 0 && (
                        <div style={{ fontSize: '11px', color: sub, marginBottom: '14px', textAlign: 'center' }}>
                          👥 Total mahasiswa: {stats.total} · Terisi: {stats.hadir + stats.terlambat}/{stats.total}
                          {sesi.courseId && <span style={{ marginLeft: '4px', color: '#1a73e8' }}>(dari mata kuliah)</span>}
                        </div>
                      )}
                      {stats.total === 0 && (
                        <div style={{ fontSize: '11px', color: '#f57f17', marginBottom: '14px', textAlign: 'center', fontStyle: 'italic' }}>
                          ⚠️ Jumlah mahasiswa belum diset — angka absen tidak bisa dihitung
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleExportCSV(sesi)}
                    style={{ flex: 1, padding: '7px', borderRadius: '8px', border: `0.5px solid ${border}`, background: 'transparent', fontSize: '12px', cursor: 'pointer', color: text }}
                  >
                    ⬇ Export CSV
                  </button>
                  {sesi.status === 'open' && (
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