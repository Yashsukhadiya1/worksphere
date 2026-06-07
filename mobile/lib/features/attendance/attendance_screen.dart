import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_client.dart';
import '../../shared/models/models.dart';

class AttendanceScreen extends ConsumerStatefulWidget {
  const AttendanceScreen({super.key});
  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  final _dio = createDio();
  List<AttendanceRecord> _records = [];
  String _msg = '';
  String _error = '';
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() { _loading = true; _msg = ''; _error = ''; });
    try {
      final res = await _dio.get('/attendance/me')
          .timeout(const Duration(seconds: 10));
      if (!mounted) return;
      setState(() {
        _records = (res.data as List).map((e) => AttendanceRecord.fromJson(e)).toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString().contains('404')
          ? 'No attendance records yet.'
          : e.toString().contains('TimeoutException') || e.toString().contains('connect')
              ? 'Cannot reach server. Check your connection.'
              : 'Error loading attendance.';
      setState(() { _error = msg; _loading = false; });
    }
  }

  Future<void> _clockIn() async {
    setState(() { _msg = ''; _error = ''; });
    try {
      await _dio.post('/attendance/checkin')
          .timeout(const Duration(seconds: 10));
      if (!mounted) return;
      setState(() => _msg = 'Clocked in ✅');
      _load();
    } catch (e) {
      if (!mounted) return;
      final detail = e.toString().contains('409')
          ? 'Already clocked in today'
          : 'Server error. Try again.';
      setState(() => _error = detail);
    }
  }

  Future<void> _clockOut() async {
    setState(() { _msg = ''; _error = ''; });
    try {
      await _dio.post('/attendance/checkout')
          .timeout(const Duration(seconds: 10));
      if (!mounted) return;
      setState(() => _msg = 'Clocked out ✅');
      _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'No active clock-in found for today.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (_msg.isNotEmpty)
            _banner(_msg, Colors.green[50]!, Colors.green[800]!),
          if (_error.isNotEmpty)
            _banner(_error, Colors.red[50]!, Colors.red[800]!),
          Row(children: [
            ElevatedButton.icon(
              onPressed: _clockIn,
              icon: const Icon(Icons.login, color: Colors.white),
              label: const Text('Clock In', style: TextStyle(color: Colors.white)),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            ),
            const SizedBox(width: 12),
            ElevatedButton.icon(
              onPressed: _clockOut,
              icon: const Icon(Icons.logout, color: Colors.white),
              label: const Text('Clock Out', style: TextStyle(color: Colors.white)),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
            ),
          ]),
          const SizedBox(height: 20),
          const Text('Recent Records',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_records.isEmpty && _error.isEmpty)
            const Center(
              child: Text('No attendance records yet.\nTap Clock In to start.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey)),
            )
          else
            Expanded(
              child: ListView.separated(
                physics: const ClampingScrollPhysics(),
                itemCount: _records.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final r = _records[i];
                  return ListTile(
                    dense: true,
                    leading: const Icon(Icons.calendar_today,
                        size: 18, color: Colors.blue),
                    title: Text(r.date,
                        style: const TextStyle(fontWeight: FontWeight.w500)),
                    subtitle: Text(
                        'In: ${_fmt(r.checkIn)}  Out: ${r.checkOut != null ? _fmt(r.checkOut!) : "—"}'),
                    trailing: r.totalHours != null
                        ? Text('${r.totalHours}h',
                            style: const TextStyle(
                                color: Colors.green,
                                fontWeight: FontWeight.bold))
                        : const Text('Active',
                            style: TextStyle(color: Colors.orange)),
                  );
                },
              ),
            ),
        ]),
      ),
    );
  }

  String _fmt(String dt) =>
      dt.length > 18 ? dt.substring(11, 19) : dt;

  Widget _banner(String text, Color bg, Color fg) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
            color: bg, borderRadius: BorderRadius.circular(8)),
        child: Text(text, style: TextStyle(color: fg, fontSize: 13)),
      );
}
