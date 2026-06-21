import { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, onSnapshot, deleteDoc, doc,
  serverTimestamp, query, orderBy, where, writeBatch, getDocs, updateDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';

export default function KelolaMataKuliah() {
  const { dark } = useTheme();
  const { addToast } = useToast();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nama: '', kode: '' });

  // Per-course state
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [courseStudents, setCourseStudents] = useState({}); // { courseId: [students] }
  const [csvPreview, setCsvPreview] = useState(null); // { courseId, rows: [{nim, nama}] }
  const [addManual, setAddManual] = useState(null); // { courseId, nim: '', nama: '' }
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef(null);

  const bg = dark ? '#1a1a1a' : '#fff';
  const border = dark ? '#2a2a2a' : '#e0e0e0';
  const text = dark ? '#f0f0f0' : '#1a1a1a';
  const sub = dark ? '#888' : '#666';
  const inputBg = dark ? '#111' : '#fff';
  const inputStyle = {
    padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`,
    fontSize: '13px', outline: 'none', background: inputBg, color: text, width: '100%',
  };

  // Realtime listener for courses — F4: filter di Firestore langsung (Client-side sorting to bypass index req)
  useEffect(() => {
    const email = auth.currentUser?.email;
    if (!email) { setLoading(false); return; }
    const q = query(
      collection(db, 'courses'),
      where('dosenEmail', '==', email)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setCourses(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load students when a course is expanded
  useEffect(() => {
    if (!expandedCourse) return;
    const unsub = onSnapshot(
      collection(db, 'courses', expandedCourse, 'students'),
      (snap) => {
        const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        students.sort((a, b) => (a.nim || '').localeCompare(b.nim || ''));
        setCourseStudents(prev => ({ ...prev, [expandedCourse]: students }));
      }
    );
    return () => unsub();
  }, [expandedCourse]);

  // Create course
  const handleBuatCourse = async () => {
    if (!form.nama) {
      addToast('Nama mata kuliah wajib diisi.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'courses'), {
        nama: form.nama,
        kode: form.kode,
        dosenEmail: auth.currentUser?.email,
        jumlahMahasiswa: 0,
        createdAt: serverTimestamp(),
      });
      setFormOpen(false);
      setForm({ nama: '', kode: '' });
      addToast('Mata kuliah berhasil dibuat!', 'success');
    } catch (err) {
      addToast('Gagal membuat mata kuliah: ' + err.message, 'error');
    }
    setSubmitting(false);
  };

  // Delete course
  const handleHapusCourse = async (courseId) => {
    try {
      // Delete all students subcollection first
      const studentsSnap = await getDocs(collection(db, 'courses', courseId, 'students'));
      const batch = writeBatch(db);
      studentsSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'courses', courseId));
      await batch.commit();
      addToast('Mata kuliah berhasil dihapus.', 'info');
      if (expandedCourse === courseId) setExpandedCourse(null);
    } catch (err) {
      addToast('Gagal menghapus: ' + err.message, 'error');
    }
    setModal(null);
  };

  // Delete individual student
  const handleHapusStudent = async (courseId, studentId) => {
    try {
      await deleteDoc(doc(db, 'courses', courseId, 'students', studentId));
      // Update count
      const remaining = (courseStudents[courseId] || []).length - 1;
      await updateDoc(doc(db, 'courses', courseId), { jumlahMahasiswa: Math.max(0, remaining) });
      addToast('Mahasiswa berhasil dihapus.', 'info');
    } catch (err) {
      addToast('Gagal menghapus mahasiswa.', 'error');
    }
  };

  // Add single student manually
  const handleTambahManual = async () => {
    if (!addManual?.nim || !addManual?.nama) {
      addToast('NIM dan Nama wajib diisi.', 'error');
      return;
    }
    try {
      await addDoc(collection(db, 'courses', addManual.courseId, 'students'), {
        nim: addManual.nim.trim(),
        nama: addManual.nama.trim(),
      });
      const currentCount = (courseStudents[addManual.courseId] || []).length + 1;
      await updateDoc(doc(db, 'courses', addManual.courseId), { jumlahMahasiswa: currentCount });
      setAddManual(null);
      addToast('Mahasiswa berhasil ditambahkan.', 'success');
    } catch (err) {
      addToast('Gagal menambahkan: ' + err.message, 'error');
    }
  };

  // CSV file handler
  const handleFileSelect = (courseId, event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target.result;
      const lines = csvText.split(/\r?\n/).filter(l => l.trim());
      const rows = [];

      for (const line of lines) {
        // Split by comma or semicolon
        const parts = line.split(/[,;]/).map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts.length >= 2) {
          const [nim, nama] = parts;
          // Skip header row
          if (nim.toLowerCase() === 'nim' || nim.toLowerCase() === 'no') continue;
          if (nim && nama) rows.push({ nim, nama });
        }
      }

      if (rows.length === 0) {
        addToast('CSV kosong atau format tidak sesuai. Format: NIM,Nama', 'error');
        return;
      }

      setCsvPreview({ courseId, rows });
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  // Import CSV rows to Firestore
  const handleImportCSV = async () => {
    if (!csvPreview) return;
    setUploading(true);
    try {
      const { courseId, rows } = csvPreview;

      // Get existing students to check duplicates
      const existingSnap = await getDocs(collection(db, 'courses', courseId, 'students'));
      const existingNIMs = new Set(existingSnap.docs.map(d => d.data().nim));

      const batch = writeBatch(db);
      let added = 0;
      let skipped = 0;

      for (const row of rows) {
        if (existingNIMs.has(row.nim)) {
          skipped++;
          continue;
        }
        const ref = doc(collection(db, 'courses', courseId, 'students'));
        batch.set(ref, { nim: row.nim, nama: row.nama });
        added++;
      }

      await batch.commit();

      // Update count
      const totalCount = existingNIMs.size + added;
      await updateDoc(doc(db, 'courses', courseId), { jumlahMahasiswa: totalCount });

      setCsvPreview(null);
      setExpandedCourse(courseId);
      addToast(`Import selesai! ${added} ditambahkan, ${skipped} duplikat di-skip.`, 'success');
    } catch (err) {
      addToast('Gagal import CSV: ' + err.message, 'error');
    }
    setUploading(false);
  };

  return (
    <div>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        style={{ display: 'none' }}
        onChange={() => {}}
      />

      {/* Modal Konfirmasi Hapus */}
      {modal?.type === 'hapus-course' && (
        <Modal
          title="Hapus Mata Kuliah?"
          message={`"${modal.nama}" beserta seluruh daftar mahasiswa akan dihapus permanen.`}
          onConfirm={() => handleHapusCourse(modal.courseId)}
          onCancel={() => setModal(null)}
          confirmLabel="Hapus"
          confirmDanger
        />
      )}

      {/* CSV Preview Modal */}
      {csvPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: bg, borderRadius: '14px', padding: '24px', width: '500px', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px', color: text }}>Preview Import CSV</h3>
            <p style={{ fontSize: '13px', color: sub, marginBottom: '16px' }}>
              {csvPreview.rows.length} mahasiswa ditemukan
            </p>

            <div style={{ maxHeight: '400px', overflow: 'auto', marginBottom: '16px', borderRadius: '8px', border: `0.5px solid ${border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', fontWeight: '500', color: sub, borderBottom: `0.5px solid ${border}`, background: dark ? '#111' : '#fafafa', textTransform: 'uppercase' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', fontWeight: '500', color: sub, borderBottom: `0.5px solid ${border}`, background: dark ? '#111' : '#fafafa', textTransform: 'uppercase' }}>NIM</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', fontWeight: '500', color: sub, borderBottom: `0.5px solid ${border}`, background: dark ? '#111' : '#fafafa', textTransform: 'uppercase' }}>Nama</th>
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.rows.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : (dark ? '#161616' : '#fafafa') }}>
                      <td style={{ padding: '8px 12px', borderBottom: `0.5px solid ${border}`, color: sub, fontSize: '12px' }}>{i + 1}</td>
                      <td style={{ padding: '8px 12px', borderBottom: `0.5px solid ${border}`, color: text, fontFamily: 'monospace', fontSize: '12px' }}>{r.nim}</td>
                      <td style={{ padding: '8px 12px', borderBottom: `0.5px solid ${border}`, color: text }}>{r.nama}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: '12px', color: sub, background: dark ? '#111' : '#f5f5f5', padding: '8px 12px', borderRadius: '8px', marginBottom: '16px' }}>
              ℹ️ Mahasiswa dengan NIM yang sudah terdaftar akan otomatis di-skip (tidak duplikat).
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setCsvPreview(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: `0.5px solid ${border}`, background: 'transparent', fontSize: '13px', cursor: 'pointer', color: text }}
              >
                Batal
              </button>
              <button
                onClick={handleImportCSV}
                disabled={uploading}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#1a73e8', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: uploading ? 0.7 : 1 }}
              >
                {uploading ? 'Mengimport...' : `✓ Import ${csvPreview.rows.length} Mahasiswa`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '2px', color: text }}>Mata Kuliah</h2>
          <p style={{ fontSize: '13px', color: sub }}>Kelola mata kuliah dan daftar mahasiswa</p>
        </div>
        <button
          onClick={() => setFormOpen(!formOpen)}
          style={{ padding: '9px 18px', background: formOpen ? '#666' : '#1a73e8', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
        >
          {formOpen ? '✕ Batal' : '+ Buat Mata Kuliah'}
        </button>
      </div>

      {/* Form Buat Mata Kuliah */}
      {formOpen && (
        <div style={{ background: bg, borderRadius: '12px', border: `0.5px solid ${border}`, padding: '20px 24px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: text }}>Buat Mata Kuliah Baru</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: sub, marginBottom: '6px' }}>Nama Mata Kuliah *</label>
              <input
                style={inputStyle}
                type="text"
                placeholder="Layanan Tersambung & Komputasi Awan"
                value={form.nama}
                onChange={e => setForm({ ...form, nama: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: sub, marginBottom: '6px' }}>Kode Mata Kuliah</label>
              <input
                style={inputStyle}
                type="text"
                placeholder="IF-4301"
                value={form.kode}
                onChange={e => setForm({ ...form, kode: e.target.value })}
              />
            </div>
          </div>
          <button
            onClick={handleBuatCourse}
            disabled={submitting}
            style={{ padding: '9px 18px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Menyimpan...' : '✓ Simpan Mata Kuliah'}
          </button>
        </div>
      )}

      {/* Daftar Mata Kuliah */}
      {loading ? (
        <p style={{ color: sub, fontSize: '14px' }}>Memuat mata kuliah...</p>
      ) : courses.length === 0 ? (
        <div style={{ background: bg, borderRadius: '12px', border: `0.5px solid ${border}`, padding: '40px', textAlign: 'center', color: sub }}>
          <p style={{ fontSize: '32px', marginBottom: '8px' }}>📚</p>
          <p style={{ fontWeight: '500', marginBottom: '4px', color: text }}>Belum ada mata kuliah</p>
          <p style={{ fontSize: '13px' }}>Klik "Buat Mata Kuliah" untuk menambahkan mata kuliah pertama</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {courses.map(course => {
            const isExpanded = expandedCourse === course.id;
            const students = courseStudents[course.id] || [];

            return (
              <div key={course.id} style={{ background: bg, borderRadius: '12px', border: `0.5px solid ${border}`, overflow: 'hidden' }}>
                {/* Course Header */}
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '2px', color: text }}>{course.nama}</div>
                      <div style={{ fontSize: '12px', color: sub }}>
                        {course.kode && `${course.kode} · `}👥 {course.jumlahMahasiswa || 0} mahasiswa
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Upload CSV */}
                    <label style={{ flex: 'none' }}>
                      <input
                        type="file"
                        accept=".csv,.txt"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileSelect(course.id, e)}
                      />
                      <span style={{
                        display: 'inline-block', padding: '7px 14px', borderRadius: '8px',
                        border: `0.5px solid ${border}`, background: 'transparent',
                        fontSize: '12px', cursor: 'pointer', color: text,
                      }}>
                        📤 Upload CSV
                      </span>
                    </label>

                    {/* Toggle student list */}
                    <button
                      onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                      style={{
                        flex: 'none', padding: '7px 14px', borderRadius: '8px',
                        border: `0.5px solid ${border}`, background: isExpanded ? (dark ? '#2a2a2a' : '#f0f0f0') : 'transparent',
                        fontSize: '12px', cursor: 'pointer', color: text,
                      }}
                    >
                      {isExpanded ? '▲ Tutup' : '👁 Lihat Mahasiswa'}
                    </button>

                    {/* Add manual */}
                    <button
                      onClick={() => setAddManual(addManual?.courseId === course.id ? null : { courseId: course.id, nim: '', nama: '' })}
                      style={{
                        flex: 'none', padding: '7px 14px', borderRadius: '8px',
                        border: `0.5px solid ${border}`, background: 'transparent',
                        fontSize: '12px', cursor: 'pointer', color: text,
                      }}
                    >
                      + Tambah Manual
                    </button>

                    {/* Delete course */}
                    <button
                      onClick={() => setModal({ type: 'hapus-course', courseId: course.id, nama: course.nama })}
                      style={{
                        flex: 'none', padding: '7px 12px', borderRadius: '8px',
                        border: `0.5px solid ${border}`, background: 'transparent',
                        fontSize: '12px', cursor: 'pointer', color: '#c62828',
                      }}
                    >
                      🗑
                    </button>
                  </div>

                  {/* Manual add form */}
                  {addManual?.courseId === course.id && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', color: sub, marginBottom: '4px' }}>NIM</label>
                        <input
                          style={{ ...inputStyle, fontSize: '12px', padding: '7px 10px' }}
                          placeholder="18123XXX"
                          value={addManual.nim}
                          onChange={e => setAddManual({ ...addManual, nim: e.target.value })}
                        />
                      </div>
                      <div style={{ flex: 2 }}>
                        <label style={{ display: 'block', fontSize: '11px', color: sub, marginBottom: '4px' }}>Nama</label>
                        <input
                          style={{ ...inputStyle, fontSize: '12px', padding: '7px 10px' }}
                          placeholder="Nama lengkap"
                          value={addManual.nama}
                          onChange={e => setAddManual({ ...addManual, nama: e.target.value })}
                        />
                      </div>
                      <button
                        onClick={handleTambahManual}
                        style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#1a73e8', color: '#fff', fontSize: '12px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        ✓ Tambah
                      </button>
                    </div>
                  )}
                </div>

                {/* Student List (Expanded) */}
                {isExpanded && (
                  <div style={{ borderTop: `0.5px solid ${border}` }}>
                    {students.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: sub, fontSize: '13px' }}>
                        Belum ada mahasiswa. Upload CSV atau tambah manual.
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: '11px', fontWeight: '500', color: sub, borderBottom: `0.5px solid ${border}`, background: dark ? '#111' : '#fafafa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>#</th>
                            <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: '11px', fontWeight: '500', color: sub, borderBottom: `0.5px solid ${border}`, background: dark ? '#111' : '#fafafa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>NIM</th>
                            <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: '11px', fontWeight: '500', color: sub, borderBottom: `0.5px solid ${border}`, background: dark ? '#111' : '#fafafa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nama</th>
                            <th style={{ width: '50px', padding: '8px 16px', borderBottom: `0.5px solid ${border}`, background: dark ? '#111' : '#fafafa' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((s, i) => (
                            <tr key={s.id} style={{ background: i % 2 === 0 ? 'transparent' : (dark ? '#161616' : '#fafafa') }}>
                              <td style={{ padding: '8px 16px', borderBottom: `0.5px solid ${border}`, color: sub, fontSize: '12px' }}>{i + 1}</td>
                              <td style={{ padding: '8px 16px', borderBottom: `0.5px solid ${border}`, color: text, fontFamily: 'monospace', fontSize: '12px' }}>{s.nim}</td>
                              <td style={{ padding: '8px 16px', borderBottom: `0.5px solid ${border}`, color: text }}>{s.nama}</td>
                              <td style={{ padding: '8px 16px', borderBottom: `0.5px solid ${border}` }}>
                                <button
                                  onClick={() => handleHapusStudent(course.id, s.id)}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#c62828', padding: '2px 6px', borderRadius: '4px' }}
                                  title="Hapus mahasiswa"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
