import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:absensi_lokasi/config/constants.dart';

/// Service untuk komunikasi dengan backend REST API.
/// Token diambil dari Firebase Auth, BUKAN SharedPreferences.
/// Mendukung auto-retry saat TOKEN_EXPIRED.
class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  final String _baseUrl = AppConstants.baseUrl;

  // ============================================================
  // Token dari Firebase Auth
  // ============================================================

  /// Ambil Firebase ID token dari user yang sedang login
  Future<String?> _getFirebaseToken({bool forceRefresh = false}) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return null;
    return await user.getIdToken(forceRefresh);
  }

  // ============================================================
  // Header Builder
  // ============================================================

  /// Membuat headers dengan Bearer token Firebase
  Future<Map<String, String>> _getHeaders({bool withAuth = true}) async {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (withAuth) {
      final token = await _getFirebaseToken();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    return headers;
  }

  // ============================================================
  // HTTP Methods
  // ============================================================

  /// GET request
  Future<ApiResponse> get(
    String endpoint, {
    Map<String, String>? queryParams,
    bool withAuth = true,
  }) async {
    try {
      var uri = Uri.parse('$_baseUrl$endpoint');
      if (queryParams != null) {
        uri = uri.replace(queryParameters: queryParams);
      }

      final headers = await _getHeaders(withAuth: withAuth);
      final response = await http
          .get(uri, headers: headers)
          .timeout(const Duration(seconds: 30));

      return _handleResponse(response, 'GET', endpoint);
    } on SocketException {
      return ApiResponse.networkError();
    } on HttpException {
      return ApiResponse.serverError();
    } catch (e) {
      return ApiResponse(
        success: false,
        message: 'Terjadi kesalahan: ${e.toString()}',
        statusCode: 0,
      );
    }
  }

  /// POST request
  Future<ApiResponse> post(
    String endpoint, {
    Map<String, dynamic>? body,
    bool withAuth = true,
  }) async {
    try {
      final uri = Uri.parse('$_baseUrl$endpoint');
      final headers = await _getHeaders(withAuth: withAuth);
      final response = await http
          .post(uri, headers: headers, body: jsonEncode(body))
          .timeout(const Duration(seconds: 30));

      return _handleResponse(response, 'POST', endpoint);
    } on SocketException {
      return ApiResponse.networkError();
    } on HttpException {
      return ApiResponse.serverError();
    } catch (e) {
      return ApiResponse(
        success: false,
        message: 'Terjadi kesalahan: ${e.toString()}',
        statusCode: 0,
      );
    }
  }

  // ============================================================
  // Response Handler
  // ============================================================

  /// Mengolah response HTTP sesuai format backend:
  /// Sukses: { "success": true, "data": { ... } }
  /// Error:  { "success": false, "error": { "code": "...", "message": "..." } }
  Future<ApiResponse> _handleResponse(
    http.Response response,
    String method,
    String endpoint,
  ) async {
    final statusCode = response.statusCode;
    Map<String, dynamic>? data;

    try {
      data = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      data = null;
    }

    // --- Handle 401: coba force refresh token sekali, lalu retry ---
    if (statusCode == 401) {
      final errorCode = data?['error']?['code']?.toString() ?? '';

      // Coba refresh token sekali
      final newToken = await _getFirebaseToken(forceRefresh: true);
      if (newToken != null) {
        // Retry request dengan token baru
        try {
          final headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer $newToken',
          };

          http.Response retryResponse;
          final uri = Uri.parse('$_baseUrl$endpoint');

          if (method == 'POST') {
            retryResponse = await http
                .post(uri, headers: headers, body: response.request?.headers['body'])
                .timeout(const Duration(seconds: 30));
          } else {
            retryResponse = await http
                .get(uri, headers: headers)
                .timeout(const Duration(seconds: 30));
          }

          // Jika retry berhasil, proses response-nya
          if (retryResponse.statusCode != 401) {
            Map<String, dynamic>? retryData;
            try {
              retryData = jsonDecode(retryResponse.body) as Map<String, dynamic>;
            } catch (_) {}

            return _buildApiResponse(retryResponse.statusCode, retryData);
          }
        } catch (_) {}
      }

      // Retry gagal juga → force logout
      await FirebaseAuth.instance.signOut();
      return ApiResponse(
        success: false,
        message: 'Sesi telah berakhir. Silakan login kembali.',
        statusCode: 401,
        errorCode: errorCode,
        data: data,
      );
    }

    return _buildApiResponse(statusCode, data);
  }

  /// Build ApiResponse dari status code dan parsed data
  ApiResponse _buildApiResponse(int statusCode, Map<String, dynamic>? data) {
    if (statusCode >= 200 && statusCode < 300) {
      return ApiResponse(
        success: true,
        message: data?['message']?.toString() ?? 'Berhasil',
        statusCode: statusCode,
        data: data,
      );
    }

    // Error response dari backend
    final error = data?['error'];
    final errorCode = error?['code']?.toString() ?? '';
    final errorMessage = error?['message']?.toString()
        ?? data?['message']?.toString()
        ?? 'Terjadi kesalahan (Kode: $statusCode)';

    return ApiResponse(
      success: false,
      message: errorMessage,
      statusCode: statusCode,
      errorCode: errorCode,
      data: data,
    );
  }
}

/// Model response standar dari API
class ApiResponse {
  final bool success;
  final String message;
  final int statusCode;
  final String errorCode;
  final Map<String, dynamic>? data;

  const ApiResponse({
    required this.success,
    required this.message,
    required this.statusCode,
    this.errorCode = '',
    this.data,
  });

  /// Shortcut untuk error jaringan
  factory ApiResponse.networkError() => const ApiResponse(
    success: false,
    message: 'Tidak ada koneksi internet. Periksa jaringan Anda.',
    statusCode: 0,
  );

  /// Shortcut untuk error server
  factory ApiResponse.serverError() => const ApiResponse(
    success: false,
    message: 'Terjadi kesalahan pada server.',
    statusCode: 0,
  );

  /// Cek apakah error tertentu
  bool hasErrorCode(String code) => errorCode == code;

  @override
  String toString() =>
      'ApiResponse(success: $success, code: $statusCode, error: $errorCode, message: $message)';
}
