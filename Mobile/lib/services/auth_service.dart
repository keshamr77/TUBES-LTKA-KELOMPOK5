import 'package:shared_preferences/shared_preferences.dart';
import 'package:absensi_lokasi/config/constants.dart';
import 'package:absensi_lokasi/models/user_model.dart';

/// Service untuk autentikasi pengguna.
///
/// Phase 1 (mock mode):
///   - Backend BELUM verify Firebase token
///   - Login/register disimulasikan lokal (SharedPreferences)
///   - User ID = AppConstants.mockUserId
///
/// Phase 2 (production):
///   - Ganti ke Firebase Auth SDK (signInWithEmailAndPassword, dll)
///   - Hapus mock login/register
class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  // ============================================================
  // Login (Phase 1: Lokal, Phase 2: Firebase Auth)
  // ============================================================

  /// Login — Phase 1: simpan ke SharedPreferences saja
  Future<AuthResult> login(String email, String password) async {
    // Phase 1: Simulasi login lokal (tidak ada backend auth)
    // Minimal validation
    if (email.isEmpty || password.isEmpty) {
      return AuthResult(success: false, message: 'Email dan password wajib diisi.');
    }

    if (password.length < 6) {
      return AuthResult(success: false, message: 'Password minimal 6 karakter.');
    }

    // Simpan ke SharedPreferences sebagai "logged in"
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('is_logged_in', true);
    await prefs.setString(AppConstants.prefUserEmail, email);
    // Jika belum ada nama, pakai email prefix
    if (prefs.getString(AppConstants.prefUserName) == null) {
      await prefs.setString(AppConstants.prefUserName, email.split('@').first);
    }

    final user = UserModel(
      id: AppConstants.mockUserId,
      name: prefs.getString(AppConstants.prefUserName) ?? email.split('@').first,
      nim: prefs.getString(AppConstants.prefUserNim) ?? '',
      email: email,
    );

    return AuthResult(success: true, message: 'Login berhasil', user: user);

    // Phase 2: Uncomment ini
    // final cred = await FirebaseAuth.instance.signInWithEmailAndPassword(
    //   email: email, password: password);
    // ...
  }

  // ============================================================
  // Register (Phase 1: Lokal, Phase 2: Firebase + POST /api/users)
  // ============================================================

  /// Register — Phase 1: simpan data ke SharedPreferences
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

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('is_logged_in', true);
    await prefs.setString(AppConstants.prefUserName, name);
    await prefs.setString(AppConstants.prefUserNim, nim);
    await prefs.setString(AppConstants.prefUserEmail, email);

    final user = UserModel(
      id: AppConstants.mockUserId,
      name: name,
      nim: nim,
      email: email,
    );

    return AuthResult(success: true, message: 'Registrasi berhasil', user: user);

    // Phase 2: Uncomment ini
    // final cred = await FirebaseAuth.instance.createUserWithEmailAndPassword(...);
    // await ApiService().post('/users', body: { 'name': name, 'nim': nim, 'role': 'student' });
  }

  // ============================================================
  // Logout
  // ============================================================

  /// Logout dan hapus data lokal
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    // Phase 2: await FirebaseAuth.instance.signOut();
  }

  // ============================================================
  // Session Check
  // ============================================================

  /// Cek apakah user sudah login
  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('is_logged_in') ?? false;
    // Phase 2: return FirebaseAuth.instance.currentUser != null;
  }

  // ============================================================
  // User Profile
  // ============================================================

  /// Ambil data user dari SharedPreferences
  Future<UserModel?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final isLoggedIn = prefs.getBool('is_logged_in') ?? false;
    if (!isLoggedIn) return null;

    return UserModel(
      id: AppConstants.mockUserId,
      name: prefs.getString(AppConstants.prefUserName) ?? '',
      nim: prefs.getString(AppConstants.prefUserNim) ?? '',
      email: prefs.getString(AppConstants.prefUserEmail) ?? '',
    );

    // Phase 2: fetch dari GET /api/users/me
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
