import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'notification_badge.dart';

class HomeShell extends StatelessWidget {
  final Widget child;
  const HomeShell({required this.child, super.key});

  // AI tab removed — now a floating button
  static const _tabs = [
    (icon: Icons.access_time,    label: 'Attendance',  path: '/home'),
    (icon: Icons.beach_access,   label: 'Leave',       path: '/leave'),
    (icon: Icons.receipt_long,   label: 'Payslips',    path: '/payslips'),
    (icon: Icons.star_outline,   label: 'Performance', path: '/performance'),
    (icon: Icons.person_outline, label: 'Profile',     path: '/profile'),
  ];

  int _currentIndex(BuildContext context) {
    try {
      final location = GoRouterState.of(context).matchedLocation;
      final idx = _tabs.indexWhere((t) => t.path == location);
      return idx < 0 ? 0 : idx;
    } catch (_) {
      return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final idx = _currentIndex(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'EEMS',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: const Color(0xFF60A5FA),
        elevation: 2,
        iconTheme: const IconThemeData(color: Colors.white),
        actions: const [NotificationBadge()],
      ),
      body: child,
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.go('/ai'),
        backgroundColor: const Color(0xFF60A5FA),
        foregroundColor: Colors.white,
        elevation: 4,
        tooltip: 'AI Assistant',
        child: const Icon(Icons.auto_awesome),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: idx,
        type: BottomNavigationBarType.fixed,
        selectedItemColor: Colors.white,
        unselectedItemColor: Colors.white70,
        backgroundColor: const Color(0xFF60A5FA),
        selectedFontSize: 10,
        unselectedFontSize: 10,
        iconSize: 20,
        onTap: (i) => context.go(_tabs[i].path),
        items: _tabs
            .map((t) => BottomNavigationBarItem(icon: Icon(t.icon), label: t.label))
            .toList(),
      ),
    );
  }
}
