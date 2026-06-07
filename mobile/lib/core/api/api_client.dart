import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _baseUrl = 'http://10.96.26.243:8000/api/v1'; // Physical device → your PC's WiFi IP
// Android emulator: 'http://10.0.2.2:8000/api/v1'

const _storage = FlutterSecureStorage();

Dio createDio() {
  final dio = Dio(BaseOptions(
    baseUrl: _baseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
  ));

  // Attach Bearer token to every request
  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      final token = await _storage.read(key: 'access_token');
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    },
    onError: (error, handler) async {
      if (error.response?.statusCode == 401) {
        final refreshToken = await _storage.read(key: 'refresh_token');
        if (refreshToken != null) {
          try {
            final refreshDio = Dio(BaseOptions(
              baseUrl: _baseUrl,
              connectTimeout: const Duration(seconds: 10),
            ));
            final res = await refreshDio.post(
              '/auth/refresh',
              data: {'refresh_token': refreshToken},
            );
            final newToken = res.data['access_token'] as String;
            await _storage.write(key: 'access_token', value: newToken);
            // Retry the original request with the new token
            final opts = error.requestOptions;
            opts.headers['Authorization'] = 'Bearer $newToken';
            final response = await dio.fetch(opts);
            return handler.resolve(response);
          } catch (_) {
            // Refresh failed — clear all tokens
            await _storage.deleteAll();
          }
        }
      }
      // Pass error through so catch blocks in screens handle it
      handler.next(error);
    },
  ));
  return dio;
}
