import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useTheme } from '../context/ThemeContext';
import TabelAbsensi from '../components/TabelAbsensi';
import KelolaSesi from '../components/KelolaSesi';
import KelolaMataKuliah from '../components/KelolaMataKuliah';

export default function Dashboard() {
  const user = auth.currentUser;
  const { dark, setDark } = useTheme();
  const [activeTab, setActiveTab] = useState('sesi');

  const bg = dark ? '#111' : '#f5f5f5';
  const navBg = dark ? '#1a1a1a' : '#fff';
  const border = dark ? '#2a2a2a' : '#e0e0e0';
  const text = dark ? '#f0f0f0' : '#1a1a1a';
  const sub = dark ? '#888' : '#666';

  return (
    <div style={{ minHeight: '100vh', background: bg }}>
      {/* Navbar */}
      <nav style={{ background: navBg, borderBottom: `0.5px solid ${border}`, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' }}>
        
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg, #1a73e8, #0d47a1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
            📍
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: text, lineHeight: '1' }}>AbsensiGPS</div>
            <div style={{ fontSize: '10px', color: sub, lineHeight: '1', marginTop: '2px' }}>Dashboard Dosen</div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Dark mode toggle */}
          <button
            onClick={() => setDark(!dark)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: `0.5px solid ${border}`, background: 'transparent', cursor: 'pointer', fontSize: '16px' }}
            title={dark ? 'Mode Terang' : 'Mode Gelap'}
          >
            {dark ? '☀️' : '🌙'}
          </button>
          <span style={{ fontSize: '13px', color: sub }}>{user?.email}</span>
          <button
            onClick={() => signOut(auth)}
            style={{ fontSize: '13px', padding: '6px 12px', borderRadius: '8px', border: `0.5px solid ${border}`, background: 'transparent', cursor: 'pointer', color: text }}
          >
            Keluar
          </button>
        </div>
      </nav>

      {/* Main */}
      <div style={{ padding: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '4px', color: text }}>Dashboard Dosen</h1>
        <p style={{ fontSize: '13px', color: sub, marginBottom: '20px' }}>Kelola sesi absensi dan pantau kehadiran mahasiswa</p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[['sesi', '📅️ Kelola Sesi'], ['absensi', '📋 Rekap Absensi'], ['matkul', '📚 Mata Kuliah']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '8px 18px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500',
                background: activeTab === key ? '#1a73e8' : (dark ? '#1a1a1a' : '#fff'),
                color: activeTab === key ? '#fff' : sub,
                border: `0.5px solid ${activeTab === key ? '#1a73e8' : border}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'sesi' && <KelolaSesi />}
        {activeTab === 'absensi' && <TabelAbsensi />}
        {activeTab === 'matkul' && <KelolaMataKuliah />}
      </div>
    </div>
  );
}