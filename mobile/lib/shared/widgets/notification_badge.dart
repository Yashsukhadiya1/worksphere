import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_client.dart';
import '../../shared/models/models.dart';

// ── Provider ──────────────────────────────────────────────────────────────────

final notifProvider =
    StateNotifierProvider<NotifNotifier, AsyncValue<List<AppNotification>>>(
  (ref) => NotifNotifier(),
);

class NotifNotifier
    extends StateNotifier<AsyncValue<List<AppNotification>>> {
  NotifNotifier() : super(const AsyncValue.loading()) {
    _load();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _load());
  }

  Timer? _timer;
  final _dio = createDio();
  List<String> _seenIds = [];

  // Callback so the badge widget can trigger the in-app popup
  void Function(AppNotification)? onNewNotification;

  Future<void> _load() async {
    try {
      final res = await _dio.get('/notifications');
      final items = (res.data as List)
          .map((e) => AppNotification.fromJson(e))
          .toList();

      // Detect truly new notifications (not seen before)
      if (_seenIds.isNotEmpty) {
        for (final n in items) {
          if (!_seenIds.contains(n.id)) {
            onNewNotification?.call(n);
          }
        }
      }
      _seenIds = items.map((n) => n.id).toList();
      state = AsyncValue.data(items);
    } catch (_) {
      // keep previous state on error
    }
  }

  Future<void> markRead(String id, String readerName) async {
    try {
      await _dio.put('/notifications/$id/read');
      state = AsyncValue.data(
        state.valueOrNull?.where((n) => n.id != id).toList() ?? [],
      );
    } catch (_) {}
  }

  Future<void> markAllRead() async {
    final items = List<AppNotification>.from(state.valueOrNull ?? []);
    for (final n in items) {
      await markRead(n.id, '');
    }
  }

  void refresh() => _load();

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

// ── Overlay helper ────────────────────────────────────────────────────────────

void showNotifToast(BuildContext context, AppNotification n) {
  final overlay = Overlay.of(context);
  late OverlayEntry entry;
  entry = OverlayEntry(
    builder: (_) => Positioned(
      top: MediaQuery.of(context).padding.top + 8,
      left: 16,
      right: 16,
      child: _NotifToast(
        notification: n,
        onDismiss: () => entry.remove(),
      ),
    ),
  );
  overlay.insert(entry);
  Future.delayed(const Duration(seconds: 4), () {
    if (entry.mounted) entry.remove();
  });
}

class _NotifToast extends StatelessWidget {
  final AppNotification notification;
  final VoidCallback onDismiss;
  const _NotifToast({required this.notification, required this.onDismiss});

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 8,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E3A5F),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(children: [
          const Icon(Icons.notifications, color: Colors.white, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(notification.title,
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
              Text(notification.body,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white70, fontSize: 11)),
            ]),
          ),
          IconButton(
            icon: const Icon(Icons.close, color: Colors.white70, size: 18),
            onPressed: onDismiss,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ]),
      ),
    );
  }
}

// ── Badge Widget ─────────────────────────────────────────────────────────────

class NotificationBadge extends ConsumerStatefulWidget {
  const NotificationBadge({super.key});

  @override
  ConsumerState<NotificationBadge> createState() => _NotificationBadgeState();
}

class _NotificationBadgeState extends ConsumerState<NotificationBadge> {
  @override
  void initState() {
    super.initState();
    // Wire up the toast callback after first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(notifProvider.notifier).onNewNotification = (n) {
        if (mounted) showNotifToast(context, n);
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    final notifs = ref.watch(notifProvider);
    final count = notifs.valueOrNull?.length ?? 0;

    return Stack(children: [
      IconButton(
        icon: const Icon(Icons.notifications_outlined),
        onPressed: () => _showSheet(context, notifs.valueOrNull ?? []),
      ),
      if (count > 0)
        Positioned(
          right: 8, top: 8,
          child: Container(
            padding: const EdgeInsets.all(3),
            decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
            child: Text('$count',
                style: const TextStyle(color: Colors.white, fontSize: 9)),
          ),
        ),
    ]);
  }

  void _showSheet(BuildContext context, List<AppNotification> list) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => _NotifSheet(
        list: list,
        onMarkRead: (id) =>
            ref.read(notifProvider.notifier).markRead(id, ''),
        onMarkAllRead: () =>
            ref.read(notifProvider.notifier).markAllRead(),
      ),
    );
  }
}

// ── Bottom Sheet ─────────────────────────────────────────────────────────────

class _NotifSheet extends StatefulWidget {
  final List<AppNotification> list;
  final Future<void> Function(String id) onMarkRead;
  final Future<void> Function() onMarkAllRead;

  const _NotifSheet({
    required this.list,
    required this.onMarkRead,
    required this.onMarkAllRead,
  });

  @override
  State<_NotifSheet> createState() => _NotifSheetState();
}

class _NotifSheetState extends State<_NotifSheet> {
  late List<AppNotification> _items;

  @override
  void initState() {
    super.initState();
    _items = List.from(widget.list);
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 8),
            width: 40, height: 4,
            decoration: BoxDecoration(
                color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
            child: Row(children: [
              const Text('Notifications',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const Spacer(),
              if (_items.isNotEmpty)
                TextButton(
                  onPressed: () async {
                    await widget.onMarkAllRead();
                    setState(() => _items.clear());
                  },
                  child: const Text('Mark all read', style: TextStyle(fontSize: 12)),
                ),
            ]),
          ),
          const Divider(height: 1),
          if (_items.isEmpty)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Text('No unread notifications',
                  style: TextStyle(color: Colors.grey)),
            )
          else
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                padding: const EdgeInsets.only(bottom: 16),
                itemCount: _items.length,
                separatorBuilder: (_, __) =>
                    const Divider(height: 1, indent: 16),
                itemBuilder: (_, i) {
                  final n = _items[i];
                  return ListTile(
                    leading: const CircleAvatar(
                      radius: 18,
                      backgroundColor: Color(0xFFEFF6FF),
                      child: Icon(Icons.notifications,
                          size: 18, color: Color(0xFF2563EB)),
                    ),
                    title: Text(n.title,
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(n.body, style: const TextStyle(fontSize: 12)),
                        const SizedBox(height: 2),
                        Text(
                          n.createdAt.length > 10
                              ? n.createdAt.substring(0, 10)
                              : n.createdAt,
                          style: const TextStyle(
                              fontSize: 10, color: Colors.grey),
                        ),
                      ],
                    ),
                    isThreeLine: true,
                    trailing: IconButton(
                      icon: const Icon(Icons.check_circle_outline,
                          size: 20, color: Colors.blue),
                      tooltip: 'Mark read',
                      onPressed: () async {
                        await widget.onMarkRead(n.id);
                        setState(() =>
                            _items.removeWhere((x) => x.id == n.id));
                      },
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
