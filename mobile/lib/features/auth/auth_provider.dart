import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../core/api/api_client.dart';
import '../../shared/models/models.dart';

const _storage = FlutterSecureStorage();

class AuthNotifier extends StateNotifier<UserProfile?> {
  AuthNotifier() : super(null);

  final _dio = createDio();

  Future<void> login(String email, String password) async {
    final res = await _dio.post('/auth/login', data: {'email': email, 'password': password});
    final tokens = TokenResponse.fromJson(res.data);
    await _storage.write(key: 'access_token', value: tokens.accessToken);
    await _storage.write(key: 'refresh_token', value: tokens.refreshToken);
    await loadMe();
  }

  Future<void> loadMe() async {
    try {
      final res = await _dio.get('/auth/me');
      state = UserProfile.fromJson(res.data);
    } catch (_) {
      state = null;
    }
  }

  Future<void> logout() async {
    final rt = await _storage.read(key: 'refresh_token');
    if (rt != null) {
      try { await _dio.post('/auth/logout', data: {'refresh_token': rt}); } catch (_) {}
    }
    await _storage.deleteAll();
    state = null;
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, UserProfile?>(
  (_) => AuthNotifier(),
);
