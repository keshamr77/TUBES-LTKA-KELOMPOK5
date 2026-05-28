import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:absensi_lokasi/config/constants.dart';
import 'package:absensi_lokasi/models/user_model.dart';
import 'package:absensi_lokasi/services/api_service.dart';

/// Service untuk autentikasi pengguna menggunakan Firebase Auth.
///
/// Login & register di-handle client-side oleh Firebase Auth SDK.
/// Data tambahan (nama, NIM) disimpan di SharedPreferences
/// karena Firebase Auth hanya menyimpan email & UID.
class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;

  // ============================================================
  // Login (Firebase Auth)
  // ============================================================

  /// Login menggunakan Firebase Auth.
  /// Setelah login berhasil, ambil data tambahan dari SharedPreferences.
  Future<AuthResult> login(String email, String password) async {
    if (email.isEmpty || password.isEmpty) {
      return AuthResult(success: false, message: 'Email dan password wajib diisi.');
    }

    if (password.length < 6) {
      return AuthResult(success: false, message: 'Password minimal 6 karakter.');
    }

    try {
      final cred = await _firebaseAuth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      if (cred.user == null) {
        return AuthResult(success: false, message: 'Login gagal. Silakan coba lagi.');
      }

      // Update SharedPreferences dengan data Firebase terbaru
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.prefUserEmail, cred.user!.email ?? email);

      // Coba sync profile terbaru dari API saat login sukses
      String name = cred.user!.displayName ?? email.split('@').first;
      String nim = '';
      
      try {
        final response = await ApiService().get(AppConstants.getUserMeEndpoint);
        if (response.success && response.data != null) {
          final updatedUser = UserModel.fromJson(response.data!);
          name = updatedUser.name;
          nim = updatedUser.nim;
          await prefs.setString(AppConstants.prefUserName, name);
          await prefs.setString(AppConstants.prefUserNim, nim);
          if (updatedUser.email.isNotEmpty) {
            await prefs.setString(AppConstants.prefUserEmail, updatedUser.email);
          }
        }
      } catch (e) {
        debugPrint('Gagal mengambil data user saat login: $e');
      }

      final user = UserModel(
        id: cred.user!.uid,
        name: prefs.getString(AppConstants.prefUserName) ?? name,
        nim: prefs.getString(AppConstants.prefUserNim) ?? nim,
        email: cred.user!.email ?? email,
      );

      return AuthResult(success: true, message: 'Login berhasil', user: user);
    } on FirebaseAuthException catch (e) {
      return AuthResult(success: false, message: _mapFirebaseError(e.code));
    } catch (e) {
      return AuthResult(success: false, message: 'Terjadi kesalahan: ${e.toString()}');
    }
  }

  // ============================================================
  // Register (Firebase Auth + simpan data tambahan lokal)
  // ============================================================

  /// Register akun baru via Firebase Auth.
  /// Data tambahan (nama, NIM) disimpan di SharedPreferences.
  /// TODO Phase berikutnya: kirim juga ke POST /api/users setelah backend ready.
  Future<AuthResult> register(
    String name,
    String nim,
    String email,
    String password,
  ) async {
    if (name.isEmpty || email.isEmpty || password.isEmpty) {
      return AuthResult(success: false, message: 'Semua field wajib diisi.');
    }

    if (password.length < 6) {
      return AuthResult(success: false, message: 'Password minimal 6 karakter.');
    }

    try {
      final cred = await _firebaseAuth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );

      if (cred.user == null) {
        return AuthResult(success: false, message: 'Registrasi gagal. Silakan coba lagi.');
      }

      // Set display name di Firebase
      await cred.user!.updateDisplayName(name);

      // Simpan data tambahan ke SharedPreferences
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.prefUserName, name);
      await prefs.setString(AppConstants.prefUserNim, nim);
      await prefs.setString(AppConstants.prefUserEmail, email);

      // Kirim profil baru ke backend untuk disimpan di Firestore
      try {
        final syncResponse = await ApiService().post(
          AppConstants.createUserEndpoint,
          body: {
            'name': name,
            'nim': nim,
            'email': email,
          },
        );
        if (!syncResponse.success) {
          debugPrint('Gagal sinkronisasi data user baru ke backend: ${syncResponse.message}');
        } else {
          debugPrint('Sukses sinkronisasi data user baru ke backend');
        }
      } catch (e) {
        debugPrint('Error saat sinkronisasi data user baru ke backend: $e');
      }

      final user = UserModel(
        id: cred.user!.uid,
        name: name,
        nim: nim,
        email: email,
      );

      return AuthResult(success: true, message: 'Registrasi berhasil', user: user);
    } on FirebaseAuthException catch (e) {
      return AuthResult(success: false, message: _mapFirebaseError(e.code));
    } catch (e) {
      return AuthResult(success: false, message: 'Terjadi kesalahan: ${e.toString()}');
    }
  }

  // ============================================================
  // Logout
  // ============================================================

  /// Logout dari Firebase Auth dan hapus data lokal
  Future<void> logout() async {
    await _firebaseAuth.signOut();
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }

  // ============================================================
  // Session Check
  // ============================================================

  /// Cek apakah user sudah login (ada Firebase session aktif)
  Future<bool> isLoggedIn() async {
    return _firebaseAuth.currentUser != null;
  }

  // ============================================================
  // User Profile
  // ============================================================

  /// Ambil data user dari Firebase Auth + SharedPreferences, dan sync dari Backend API jika online
  Future<UserModel?> getCurrentUser() async {
    final firebaseUser = _firebaseAuth.currentUser;
    if (firebaseUser == null) return null;

    final prefs = await SharedPreferences.getInstance();

    // Coba ambil profile terbaru dari API
    try {
      final response = await ApiService().get(AppConstants.getUserMeEndpoint);
      if (response.success && response.data != null) {
        final updatedUser = UserModel.fromJson(response.data!);
        
        // Simpan data terupdate ke SharedPreferences
        await prefs.setString(AppConstants.prefUserName, updatedUser.name);
        await prefs.setString(AppConstants.prefUserNim, updatedUser.nim);
        if (updatedUser.email.isNotEmpty) {
          await prefs.setString(AppConstants.prefUserEmail, updatedUser.email);
        }
        
        return updatedUser;
      } else if (response.statusCode == 404) {
        // Self-healing: Jika user tidak ditemukan di Firestore, coba restore dari data lokal SharedPreferences/Firebase
        final localName = prefs.getString(AppConstants.prefUserName) ?? firebaseUser.displayName ?? '';
        final localNim = prefs.getString(AppConstants.prefUserNim) ?? '';
        final localEmail = prefs.getString(AppConstants.prefUserEmail) ?? firebaseUser.email ?? '';

        if (localName.isNotEmpty && localNim.isNotEmpty) {
          debugPrint('Deteksi user Firestore hilang (404). Mencoba restorasi...');
          final restoreResponse = await ApiService().post(
            AppConstants.createUserEndpoint,
            body: {
              'name': localName,
              'nim': localNim,
              'email': localEmail,
            },
          );
          if (restoreResponse.success) {
            debugPrint('Sukses merestorasi data user ke Firestore');
            return UserModel(
              id: firebaseUser.uid,
              name: localName,
              nim: localNim,
              email: localEmail,
            );
          }
        }
      }
    } catch (e) {
      // Abaikan error jaringan/API, lanjut ke fallback SharedPreferences
      debugPrint('Gagal sinkronisasi data user dari API: $e');
    }

    return UserModel(
      id: firebaseUser.uid,
      name: prefs.getString(AppConstants.prefUserName) ??
          firebaseUser.displayName ??
          firebaseUser.email?.split('@').first ??
          '',
      nim: prefs.getString(AppConstants.prefUserNim) ?? '',
      email: prefs.getString(AppConstants.prefUserEmail) ?? firebaseUser.email ?? '',
    );
  }

  // ============================================================
  // Firebase Error Mapping
  // ============================================================

  /// Terjemahkan Firebase Auth error codes ke pesan Bahasa Indonesia
  String _mapFirebaseError(String code) {
    switch (code) {
      case 'user-not-found':
        return 'Email belum terdaftar. Silakan daftar terlebih dahulu.';
      case 'wrong-password':
        return 'Password salah. Silakan coba lagi.';
      case 'invalid-credential':
        return 'Email atau password salah. Periksa kembali data Anda.';
      case 'email-already-in-use':
        return 'Email sudah terdaftar. Silakan login atau gunakan email lain.';
      case 'weak-password':
        return 'Password terlalu lemah. Gunakan minimal 6 karakter.';
      case 'invalid-email':
        return 'Format email tidak valid. Gunakan email yang benar (contoh: nama@email.com).';
      case 'user-disabled':
        return 'Akun ini telah dinonaktifkan. Hubungi administrator.';
      case 'too-many-requests':
        return 'Terlalu banyak percobaan login gagal. Silakan coba lagi dalam beberapa menit.';
      case 'network-request-failed':
        return 'Tidak ada koneksi internet. Periksa jaringan Anda.';
      case 'channel-error':
        return 'Terjadi kesalahan. Pastikan email dan password sudah diisi.';
      default:
        return 'Terjadi kesalahan autentikasi ($code).';
    }
  }
}

/// Model hasil autentikasi
class AuthResult {
  final bool success;
  final String message;
  final UserModel? user;

  const AuthResult({
    required this.success,
    required this.message,
    this.user,
  });
}
