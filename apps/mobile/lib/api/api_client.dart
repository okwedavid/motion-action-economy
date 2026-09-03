import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';

/// An error surfaced by the MOTION backend.
class ApiException implements Exception {
  final int statusCode;
  final String code;
  final String message;

  const ApiException({required this.statusCode, required this.code, required this.message});

  @override
  String toString() => message;
}

class ApiClient {
  final String baseUrl;
  String? _token;

  ApiClient({String? baseUrl}) : baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

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
    final res = await http.get(_uri(path, query), headers: _headers(json: false));
    return _decode(res);
  }

  Future<dynamic> post(String path, {Object? body}) async {
    final res = await http.post(
      _uri(path),
      headers: _headers(),
      body: body == null ? null : jsonEncode(body),
    );
    return _decode(res);
  }

  Future<dynamic> postForm(String path, Map<String, String> fields) async {
    final res = await http.post(_uri(path), headers: _headers(json: false), body: fields);
    return _decode(res);
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
      code: (err is Map && err['code'] != null) ? err['code'].toString() : 'UNKNOWN',
      message: (err is Map && err['message'] != null)
          ? err['message'].toString()
          : 'Request failed (${res.statusCode})',
    );
  }
}
