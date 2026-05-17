import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:absensi_lokasi/config/constants.dart';
import 'package:absensi_lokasi/models/user_model.dart';
import 'package:absensi_lokasi/services/api_service.dart';

/// Service untuk autentikasi pengguna menggunakan Firebase Auth.
/// Login & register 100% via Firebase Auth SDK.
/// Setelah register, kirim POST /api/users untuk simpan nama & NIM di backend.
class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;
  final ApiService _api = ApiService();

  // ============================================================
  // Login via Firebase Auth
  // ============================================================

  /// Login dengan email dan password menggunakan Firebase Auth
  Future<AuthResult> login(String email, String password) async {
    try {
      final credential = await _firebaseAuth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      if (credential.user == null) {
        return AuthResult(success: false, message: 'Login gagal. Coba lagi.');
      }

      // Ambil data profil dari backend
      final user = await _fetchUserProfile();

      return AuthResult(
        success: true,
        message: 'Login berhasil',
        user: user,
      );
    } on FirebaseAuthException catch (e) {
      return AuthResult(
        success: false,
        message: _mapFirebaseError(e.code),
      );
    } catch (e) {
      return AuthResult(
        success: false,
        message: 'Terjadi kesalahan: ${e.toString()}',
      );
    }
  }

  // ============================================================
  // Register via Firebase Auth + POST /api/users
  // ============================================================

  /// Registrasi akun baru via Firebase Auth,
  /// lalu simpan nama & NIM ke backend via POST /api/users
  Future<AuthResult> register(
    String name,
    String nim,
    String email,
    String password,
  ) async {
    try {
      // 1. Buat akun di Firebase Auth
      final credential = await _firebaseAuth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );

      if (credential.user == null) {
        return AuthResult(success: false, message: 'Registrasi gagal. Coba lagi.');
      }

      // 2. Update display name di Firebase
      await credential.user!.updateDisplayName(name);

      // 3. Simpan data ke backend
      final response = await _api.post(
        AppConstants.createUserEndpoint,
        body: {
          'name': name,
          'nim': nim,
          'role': 'student',
        },
      );

      if (!response.success) {
        // Backend gagal tapi akun Firebase sudah terbuat — log warning
        // User masih bisa login, tapi profil perlu di-sync ulang nanti
      }

      // 4. Cache profil lokal
      await _cacheUserProfile(name: name, nim: nim, email: email);

      final user = UserModel(
        id: credential.user!.uid,
        name: name,
        nim: nim,
        email: email,
        role: 'student',
      );

      return AuthResult(
        success: true,
        message: 'Registrasi berhasil',
        user: user,
      );
    } on FirebaseAuthException catch (e) {
      return AuthResult(
        success: false,
        message: _mapFirebaseError(e.code),
      );
    } catch (e) {
      return AuthResult(
        success: false,
        message: 'Terjadi kesalahan: ${e.toString()}',
      );
    }
  }

  // ============================================================
  // Logout
  // ============================================================

  /// Logout dari Firebase Auth dan hapus cache lokal
  Future<void> logout() async {
    await _firebaseAuth.signOut();
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }

  // ============================================================
  // Session Check
  // ============================================================

  /// Cek apakah user sudah login (Firebase Auth state)
  Future<bool> isLoggedIn() async {
    return _firebaseAuth.currentUser != null;
  }

  /// Ambil Firebase ID token untuk request API
  Future<String?> getToken({bool forceRefresh = false}) async {
    final user = _firebaseAuth.currentUser;
    if (user == null) return null;
    return await user.getIdToken(forceRefresh);
  }

  // ============================================================
  // User Profile
  // ============================================================

  /// Ambil data user dari backend GET /api/users/me
  /// Fallback ke cache lokal jika offline
  Future<UserModel?> getCurrentUser() async {
    final firebaseUser = _firebaseAuth.currentUser;
    if (firebaseUser == null) return null;

    // Coba ambil dari backend
    final response = await _api.get(AppConstants.getUserMeEndpoint);
    if (response.success && response.data != null) {
      final user = UserModel.fromJson(response.data!);
      // Update cache
      await _cacheUserProfile(
        name: user.name,
        nim: user.nim,
        email: user.email,
      );
      return user;
    }

    // Fallback ke cache lokal
    return await _getCachedUser(firebaseUser);
  }

  /// Ambil user dari cache SharedPreferences
  Future<UserModel> _getCachedUser(User firebaseUser) async {
    final prefs = await SharedPreferences.getInstance();
    return UserModel(
      id: firebaseUser.uid,
      name: prefs.getString(AppConstants.prefUserName) ?? firebaseUser.displayName ?? '',
      nim: prefs.getString(AppConstants.prefUserNim) ?? '',
      email: prefs.getString(AppConstants.prefUserEmail) ?? firebaseUser.email ?? '',
      role: prefs.getString(AppConstants.prefUserRole) ?? 'student',
    );
  }

  /// Cache profil user ke SharedPreferences
  Future<void> _cacheUserProfile({
    required String name,
    required String nim,
    required String email,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.prefUserName, name);
    await prefs.setString(AppConstants.prefUserNim, nim);
    await prefs.setString(AppConstants.prefUserEmail, email);
  }

  // ============================================================
  // Firebase Error Mapping
  // ============================================================

  /// Terjemahkan kode error Firebase ke pesan Bahasa Indonesia
  String _mapFirebaseError(String code) {
    switch (code) {
      case 'user-not-found':
        return 'Akun tidak ditemukan. Periksa email Anda.';
      case 'wrong-password':
        return 'Kata sandi salah. Coba lagi.';
      case 'invalid-email':
        return 'Format email tidak valid.';
      case 'user-disabled':
        return 'Akun ini telah dinonaktifkan.';
      case 'email-already-in-use':
        return 'Email sudah terdaftar. Silakan login.';
      case 'weak-password':
        return 'Kata sandi terlalu lemah. Minimal 6 karakter.';
      case 'too-many-requests':
        return 'Terlalu banyak percobaan. Coba lagi nanti.';
      case 'network-request-failed':
        return 'Tidak ada koneksi internet.';
      case 'invalid-credential':
        return 'Email atau kata sandi salah.';
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
