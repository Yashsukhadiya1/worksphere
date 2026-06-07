import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../shared/models/models.dart';

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key});
  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  final _dio = createDio();
  List<LeaveRequest> _leaves = [];
  String _startDate = '', _endDate = '', _reason = '';
  String _leaveType = 'annual';
  String _msg = '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await _dio.get('/leave/me');
      if (!mounted) return;
      setState(() => _leaves = (res.data as List).map((e) => LeaveRequest.fromJson(e)).toList());
    } catch (_) {
      // 404 = no records yet
    }
  }

  Future<void> _submit() async {
    try {
      await _dio.post('/leave/request', data: {
        'start_date': _startDate, 'end_date': _endDate,
        'leave_type': _leaveType, 'reason': _reason,
      });
      if (!mounted) return;
      setState(() => _msg = 'Leave request submitted ✅');
      _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _msg = 'Error submitting leave request');
    }
  }

  Color _statusColor(String s) => switch (s) {
    'approved' => Colors.green, 'rejected' => Colors.red, _ => Colors.orange
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Leave Requests')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (_msg.isNotEmpty) Text(_msg, style: TextStyle(color: _msg.contains('✅') ? Colors.green : Colors.red)),
          const Text('New Request', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          TextField(decoration: const InputDecoration(labelText: 'Start Date (YYYY-MM-DD)'), onChanged: (v) => _startDate = v),
          TextField(decoration: const InputDecoration(labelText: 'End Date (YYYY-MM-DD)'), onChanged: (v) => _endDate = v),
          DropdownButton<String>(
            value: _leaveType,
            items: ['annual','sick','unpaid','other'].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
            onChanged: (v) => setState(() => _leaveType = v!),
          ),
          TextField(decoration: const InputDecoration(labelText: 'Reason (optional)'), onChanged: (v) => _reason = v),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: _submit, child: const Text('Submit')),
          const SizedBox(height: 16),
          const Text('My Requests', style: TextStyle(fontWeight: FontWeight.bold)),
          Expanded(
            child: ListView.builder(
              itemCount: _leaves.length,
              itemBuilder: (_, i) {
                final l = _leaves[i];
                return Card(
                  child: ListTile(
                    title: Text('${l.leaveType}  ${l.startDate} – ${l.endDate}'),
                    subtitle: Text(l.reason ?? ''),
                    trailing: Chip(
                      label: Text(l.status, style: const TextStyle(color: Colors.white, fontSize: 11)),
                      backgroundColor: _statusColor(l.status),
                    ),
                  ),
                );
              },
            ),
          ),
        ]),
      ),
    );
  }
}
