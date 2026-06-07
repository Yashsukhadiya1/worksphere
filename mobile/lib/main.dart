import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router/router.dart';
import 'features/auth/auth_provider.dart';

void main() {
  runApp(const ProviderScope(child: EEMSApp()));
}

class EEMSApp extends ConsumerStatefulWidget {
  const EEMSApp({super.key});

  @override
  ConsumerState<EEMSApp> createState() => _EEMSAppState();
}

class _EEMSAppState extends ConsumerState<EEMSApp> {
  @override
  void initState() {
    super.initState();
    // Load user exactly once on startup, not on every rebuild
    Future.microtask(() => ref.read(authProvider.notifier).loadMe());
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'EEMS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF2563EB),
        useMaterial3: true,
      ),
      routerConfig: router,
    );
  }
}
