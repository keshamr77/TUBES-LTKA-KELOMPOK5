import 'package:shared_preferences/shared_preferences.dart';
import 'package:absensi_lokasi/config/constants.dart';
import 'package:absensi_lokasi/models/user_model.dart';
import 'package:absensi_lokasi/services/api_service.dart';

/// Service untuk autentikasi pengguna.
/// Mengelola login, register, logout, dan sesi menggunakan SharedPreferences.
class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final ApiService _api = ApiService();

  // ============================================================
  // Login
  // ============================================================

  /// Login dengan email/NIM dan password
  /// Mengirim request ke POST /auth/login
  Future<AuthResult> login(String email, String password) async {
    final response = await _api.post(
      AppConstants.loginEndpoint,
      body: {
        'email': email,
        'password': password,
      },
      withAuth: false,
    );

    if (response.success && response.data != null) {
      try {
        final token = response.data!['token']?.toString() ?? '';
        final user = UserModel.fromJson(response.data!, token: token);

        // Simpan sesi ke SharedPreferences
        await _saveSession(user);

        return AuthResult(success: true, message: 'Login berhasil', user: user);
      } catch (e) {
        return AuthResult(
          success: false,
          message: 'Gagal memproses data login: ${e.toString()}',
        );
      }
    }

    return AuthResult(success: false, message: response.message);
  }

  // ============================================================
  // Register
  // ============================================================

  /// Registrasi akun baru
  /// Mengirim request ke POST /auth/register
  Future<AuthResult> register(
    String name,
    String nim,
    String email,
    String password,
  ) async {
    final response = await _api.post(
      AppConstants.registerEndpoint,
      body: {
        'name': name,
        'nim': nim,
        'email': email,
        'password': password,
      },
      withAuth: false,
    );

    if (response.success && response.data != null) {
      try {
        final token = response.data!['token']?.toString() ?? '';
        final user = UserModel.fromJson(response.data!, token: token);

        await _saveSession(user);

        return AuthResult(
          success: true,
          message: 'Registrasi berhasil',
          user: user,
        );
      } catch (e) {
        return AuthResult(
          success: false,
          message: 'Gagal memproses data registrasi: ${e.toString()}',
        );
      }
    }

    return AuthResult(success: false, message: response.message);
  }

  // ============================================================
  // Logout
  // ============================================================

  /// Logout: hapus semua data sesi
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }

  // ============================================================
  // Session Management
  // ============================================================

  /// Simpan sesi user ke SharedPreferences
  Future<void> _saveSession(UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(AppConstants.prefIsLoggedIn, true);
    await prefs.setString(AppConstants.prefToken, user.token);
    await prefs.setString(AppConstants.prefUserId, user.id);
    await prefs.setString(AppConstants.prefUserName, user.name);
    await prefs.setString(AppConstants.prefUserNim, user.nim);
    await prefs.setString(AppConstants.prefUserEmail, user.email);
  }

  /// Cek apakah user sudah login
  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(AppConstants.prefIsLoggedIn) ?? false;
  }

  /// Ambil token dari SharedPreferences
  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(AppConstants.prefToken);
  }

  /// Ambil data user dari SharedPreferences
  Future<UserModel?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final isLoggedIn = prefs.getBool(AppConstants.prefIsLoggedIn) ?? false;

    if (!isLoggedIn) return null;

    return UserModel(
      id: prefs.getString(AppConstants.prefUserId) ?? '',
      name: prefs.getString(AppConstants.prefUserName) ?? '',
      nim: prefs.getString(AppConstants.prefUserNim) ?? '',
      email: prefs.getString(AppConstants.prefUserEmail) ?? '',
      token: prefs.getString(AppConstants.prefToken) ?? '',
    );
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
