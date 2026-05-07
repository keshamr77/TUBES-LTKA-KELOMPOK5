import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:absensi_lokasi/config/constants.dart';
import 'package:absensi_lokasi/services/auth_service.dart';

/// Service untuk komunikasi dengan backend REST API.
/// Menangani semua HTTP request dengan autentikasi Bearer token.
class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  final String _baseUrl = AppConstants.baseUrl;

  // ============================================================
  // Header Builder
  // ============================================================

  /// Membuat headers dengan Bearer token untuk request yang terautentikasi
  Future<Map<String, String>> _getHeaders({bool withAuth = true}) async {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (withAuth) {
      final token = await AuthService().getToken();
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

      return _handleResponse(response);
    } on SocketException {
      return ApiResponse(
        success: false,
        message: 'Tidak ada koneksi internet. Periksa jaringan Anda.',
        statusCode: 0,
      );
    } on HttpException {
      return ApiResponse(
        success: false,
        message: 'Terjadi kesalahan pada server.',
        statusCode: 0,
      );
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
      return ApiResponse(
        success: false,
        message: 'Tidak ada koneksi internet. Periksa jaringan Anda.',
        statusCode: 0,
      );
    } on HttpException {
      return ApiResponse(
        success: false,
        message: 'Terjadi kesalahan pada server.',
        statusCode: 0,
      );
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

  /// Mengolah response HTTP menjadi ApiResponse
  ApiResponse _handleResponse(http.Response response) {
    final statusCode = response.statusCode;
    Map<String, dynamic>? data;

    try {
      data = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      data = null;
    }

    // Cek 401 Unauthorized → auto logout
    if (statusCode == 401) {
      AuthService().logout();
      return ApiResponse(
        success: false,
        message: 'Sesi telah berakhir. Silakan login kembali.',
        statusCode: statusCode,
        data: data,
      );
    }

    if (statusCode >= 200 && statusCode < 300) {
      return ApiResponse(
        success: true,
        message: data?['message']?.toString() ?? 'Berhasil',
        statusCode: statusCode,
        data: data,
      );
    }

    return ApiResponse(
      success: false,
      message: data?['message']?.toString() ?? 'Terjadi kesalahan (Kode: $statusCode)',
      statusCode: statusCode,
      data: data,
    );
  }
}

/// Model response standar dari API
class ApiResponse {
  final bool success;
  final String message;
  final int statusCode;
  final Map<String, dynamic>? data;

  const ApiResponse({
    required this.success,
    required this.message,
    required this.statusCode,
    this.data,
  });

  @override
  String toString() =>
      'ApiResponse(success: $success, code: $statusCode, message: $message)';
}
