import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';

/// An error surfaced by the MOTION backend.
class ApiException implements Exception {
  final int statusCode;
  final String code;
  final String message;

  const ApiException(
      {required this.statusCode, required this.code, required this.message});

  @override
  String toString() => message;
}

class ApiClient {
  final String baseUrl;
  final Duration timeout;
  String? _token;

  ApiClient({String? baseUrl, Duration? timeout})
      : baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
        timeout = timeout ?? const Duration(seconds: 15);

  set token(String? value) => _token = value;

  Map<String, String> _headers({bool json = true}) {
    final headers = <String, String>{
      if (json) 'Content-Type': 'application/json',
    };
    if (_token != null && _token!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final u = Uri.parse('$baseUrl$path');
    return query == null ? u : u.replace(queryParameters: query);
  }

  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    final res = await _send(
      () => http.get(_uri(path, query), headers: _headers(json: false)),
    );
    return _decode(res);
  }

  Future<dynamic> post(String path, {Object? body}) async {
    final res = await _send(
      () => http.post(
        _uri(path),
        headers: _headers(),
        body: body == null ? null : jsonEncode(body),
      ),
    );
    return _decode(res);
  }

  Future<dynamic> postForm(String path, Map<String, String> fields) async {
    final res = await _send(
      () => http.post(_uri(path), headers: _headers(json: false), body: fields),
    );
    return _decode(res);
  }

  Future<http.Response> _send(Future<http.Response> Function() request) async {
    try {
      return await request().timeout(timeout);
    } on TimeoutException {
      throw ApiException(
        statusCode: 0,
        code: 'TIMEOUT',
        message: 'The server took too long to respond. Please try again.',
      );
    } on http.ClientException {
      // Thrown on both mobile and web for connection/DNS/network failures.
      throw ApiException(
        statusCode: 0,
        code: 'NETWORK',
        message: 'Could not reach the server. Please check your connection.',
      );
    }
  }

  dynamic _decode(http.Response res) {
    final text = res.body.isEmpty ? '{}' : res.body;
    Object? decoded;
    try {
      decoded = jsonDecode(text);
    } catch (_) {
      decoded = null;
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return decoded;
    }
    final map = decoded is Map ? decoded : <String, dynamic>{};
    final err = map['error'];
    throw ApiException(
      statusCode: res.statusCode,
      code: (err is Map && err['code'] != null)
          ? err['code'].toString()
          : 'UNKNOWN',
      message: (err is Map && err['message'] != null)
          ? err['message'].toString()
          : 'Request failed (${res.statusCode})',
    );
  }
}
