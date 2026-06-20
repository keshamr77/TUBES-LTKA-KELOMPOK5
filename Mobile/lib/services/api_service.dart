import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:absensi_lokasi/config/constants.dart';

/// Service untuk komunikasi dengan backend REST API.
///
/// Autentikasi via Firebase Auth ID Token (Bearer).
/// Juga mengirim X-Mock-User-Id sebagai fallback selama backend
/// belum upgrade ke verify Firebase JWT.
class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  final String _baseUrl = AppConstants.baseUrl;

  // ============================================================
  // Header Builder
  // ============================================================

  /// Membuat headers untuk request.
  /// Menggunakan Firebase Auth ID Token (Bearer).
  /// Juga kirim X-Mock-User-Id sebagai fallback untuk backend Phase 1.
  Future<Map<String, String>> _getHeaders({bool withAuth = true}) async {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (withAuth) {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        // Firebase Auth Bearer token
        final token = await user.getIdToken();
        if (token != null) {
          headers['Authorization'] = 'Bearer $token';
        }
        // Fallback: backend Phase 1 masih pakai X-Mock-User-Id
        // TODO: Hapus ini setelah backend verify Firebase JWT
        headers['X-Mock-User-Id'] = user.uid;
      } else {
        // User belum login — kirim mock ID sebagai fallback
        headers['X-Mock-User-Id'] = AppConstants.mockUserId;
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
      debugPrint('[ApiService GET] $uri');
      debugPrint('[ApiService GET] X-Mock-User-Id: ${headers['X-Mock-User-Id']}');
      final response = await http
          .get(uri, headers: headers)
          .timeout(const Duration(seconds: 30));

      debugPrint('[ApiService GET] Status: ${response.statusCode}');
      debugPrint('[ApiService GET] Body: ${response.body.length > 500 ? response.body.substring(0, 500) : response.body}');
      return _handleResponse(response);
    } catch (e) {
      final msg = e.toString().toLowerCase();
      if (msg.contains('socketexception') || msg.contains('networkerror') || msg.contains('xmlhttprequest') || msg.contains('failed to fetch')) {
        return ApiResponse.networkError();
      }
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
    } catch (e) {
      final msg = e.toString().toLowerCase();
      if (msg.contains('socketexception') || msg.contains('networkerror') || msg.contains('xmlhttprequest') || msg.contains('failed to fetch')) {
        return ApiResponse.networkError();
      }
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
