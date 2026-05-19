import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:absensi_lokasi/config/constants.dart';

/// Service untuk komunikasi dengan backend REST API.
///
/// Phase 1 (mock mode):
///   - Backend BELUM verify Firebase token
///   - Identifikasi user via header X-Mock-User-Id
///   - Hanya 2 endpoint: POST /api/attendances, GET /api/attendances/me
///
/// Phase 2 (production):
///   - Ganti _getHeaders() untuk pakai Firebase Auth token
///   - Hapus X-Mock-User-Id header
class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  final String _baseUrl = AppConstants.baseUrl;

  // ============================================================
  // Header Builder
  // ============================================================

  /// Membuat headers untuk request.
  /// Phase 1: pakai X-Mock-User-Id
  /// Phase 2: ganti ke Bearer token Firebase
  Future<Map<String, String>> _getHeaders({bool withAuth = true}) async {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (withAuth) {
      // Phase 1: Mock user ID
      headers['X-Mock-User-Id'] = AppConstants.mockUserId;

      // Phase 2: Uncomment ini dan hapus line di atas
      // final token = await FirebaseAuth.instance.currentUser?.getIdToken();
      // if (token != null) headers['Authorization'] = 'Bearer $token';
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

      return _handleResponse(response);
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

      return _handleResponse(response);
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
  ApiResponse _handleResponse(http.Response response) {
    final statusCode = response.statusCode;
    Map<String, dynamic>? data;

    try {
      data = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      data = null;
    }

    if (statusCode >= 200 && statusCode < 300) {
      return ApiResponse(
        success: true,
        message: data?['message']?.toString() ?? 'Berhasil',
        statusCode: statusCode,
        data: data,
      );
    }

    // Error response
    final error = data?['error'];
    final errorCode = error?['code']?.toString() ?? '';
    final errorMessage = error?['message']?.toString() ??
        data?['message']?.toString() ??
        'Terjadi kesalahan (Kode: $statusCode)';

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
