import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/auth_provider.dart';
import '../../features/attendance/attendance_screen.dart';
import '../../features/leave/leave_screen.dart';
import '../../features/payslip/payslip_screen.dart';
import '../../features/performance/performance_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/ai/ai_screen.dart';
import '../../shared/widgets/home_shell.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);
  return GoRouter(
    initialLocation: authState != null ? '/home' : '/login',
    redirect: (context, state) {
      final loggedIn = authState != null;
      final onLogin = state.matchedLocation == '/login';
      if (!loggedIn && !onLogin) return '/login';
      if (loggedIn && onLogin) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      ShellRoute(
        builder: (context, state, child) => HomeShell(child: child),
        routes: [
          GoRoute(path: '/home',        builder: (_, __) => const AttendanceScreen()),
          GoRoute(path: '/leave',       builder: (_, __) => const LeaveScreen()),
          GoRoute(path: '/payslips',    builder: (_, __) => const PayslipScreen()),
          GoRoute(path: '/performance', builder: (_, __) => const PerformanceScreen()),
          GoRoute(path: '/ai',          builder: (_, __) => const AiScreen()),
          GoRoute(path: '/profile',     builder: (_, __) => const ProfileScreen()),
        ],
      ),
    ],
  );
});
