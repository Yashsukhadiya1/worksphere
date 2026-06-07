import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_client.dart';
import '../../features/auth/auth_provider.dart';

class AiScreen extends ConsumerStatefulWidget {
  const AiScreen({super.key});
  @override
  ConsumerState<AiScreen> createState() => _AiScreenState();
}

class _AiScreenState extends ConsumerState<AiScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  final _dio = createDio();

  // productivity
  Map<String, dynamic>? _productivity;
  bool _loadingProd = false;

  // burnout
  Map<String, dynamic>? _burnout;
  bool _loadingBurnout = false;

  // history
  List<dynamic> _history = [];
  bool _loadingHistory = false;

  String _error = '';

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider);
    final isAdmin = user?.role == 'admin' || user?.role == 'hr_manager';
    _tabs = TabController(length: isAdmin ? 3 : 3, vsync: this);
    _loadProductivity();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _loadProductivity() async {
    setState(() { _loadingProd = true; _error = ''; });
    try {
      final res = await _dio.get('/ai/ml/productivity')
          .timeout(const Duration(seconds: 15));
      setState(() { _productivity = res.data; });
    } catch (e) {
      setState(() { _error = _parseError(e); });
    } finally {
      setState(() => _loadingProd = false);
    }
  }

  Future<void> _loadBurnout() async {
    if (_burnout != null) return;
    setState(() { _loadingBurnout = true; _error = ''; });
    try {
      final res = await _dio.get('/ai/ml/burnout')
          .timeout(const Duration(seconds: 15));
      setState(() { _burnout = res.data; });
    } catch (e) {
      setState(() { _error = _parseError(e); });
    } finally {
      setState(() => _loadingBurnout = false);
    }
  }

  Future<void> _loadHistory() async {
    if (_history.isNotEmpty) return;
    setState(() { _loadingHistory = true; _error = ''; });
    try {
      final res = await _dio.get('/ai/ml/my-dataset')
          .timeout(const Duration(seconds: 15));
      setState(() { _history = res.data as List; });
    } catch (e) {
      setState(() { _error = _parseError(e); });
    } finally {
      setState(() => _loadingHistory = false);
    }
  }

  String _parseError(Object e) {
    final s = e.toString();
    if (s.contains('404')) return 'Employee profile not found.';
    if (s.contains('connect') || s.contains('Timeout')) return 'Cannot reach server.';
    return 'Something went wrong.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Insights'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF2563EB),
        elevation: 1,
        bottom: TabBar(
          controller: _tabs,
          labelColor: const Color(0xFF2563EB),
          unselectedLabelColor: Colors.grey,
          indicatorColor: const Color(0xFF2563EB),
          onTap: (i) {
            if (i == 1) _loadBurnout();
            if (i == 2) _loadHistory();
          },
          tabs: const [
            Tab(text: 'Productivity'),
            Tab(text: 'Burnout'),
            Tab(text: 'History'),
          ],
        ),
      ),
      body: Column(children: [
        if (_error.isNotEmpty)
          Container(
            width: double.infinity,
            color: Colors.red[50],
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(_error, style: TextStyle(color: Colors.red[700], fontSize: 13)),
          ),
        Expanded(
          child: TabBarView(
            controller: _tabs,
            children: [
              _buildProductivityTab(),
              _buildBurnoutTab(),
              _buildHistoryTab(),
            ],
          ),
        ),
      ]),
    );
  }

  // ── Productivity ────────────────────────────────────────────────────────────
  Widget _buildProductivityTab() {
    if (_loadingProd) return const Center(child: CircularProgressIndicator());
    if (_productivity == null) {
      return Center(
        child: ElevatedButton(
          onPressed: _loadProductivity,
          child: const Text('Load Productivity'),
        ),
      );
    }
    final score = _productivity!['score'] as int;
    final level = _productivity!['level'] as String;
    final breakdown = _productivity!['breakdown'] as Map<String, dynamic>;
    final date = _productivity!['date'] as String;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Center(
          child: Column(children: [
            const SizedBox(height: 8),
            SizedBox(
              width: 130, height: 130,
              child: Stack(alignment: Alignment.center, children: [
                CircularProgressIndicator(
                  value: score / 100,
                  strokeWidth: 10,
                  backgroundColor: Colors.grey[200],
                  valueColor: AlwaysStoppedAnimation(
                    score >= 80 ? Colors.green : score >= 60 ? Colors.blue : score >= 40 ? Colors.amber : Colors.red,
                  ),
                ),
                Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('$score', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
                  Text(level, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ]),
              ]),
            ),
            const SizedBox(height: 8),
            Text(date, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ]),
        ),
        const SizedBox(height: 20),
        const Text('Breakdown', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 8),
        ...breakdown.entries.map((e) {
          final ok = e.value == true;
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: ok ? Colors.green[50] : Colors.red[50],
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(children: [
              Icon(ok ? Icons.check_circle : Icons.cancel,
                  color: ok ? Colors.green : Colors.red, size: 18),
              const SizedBox(width: 10),
              Text(
                e.key.replaceAll('_', ' '),
                style: TextStyle(
                  color: ok ? Colors.green[800] : Colors.red[800],
                  fontSize: 14,
                ),
              ),
            ]),
          );
        }),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _loadProductivity,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh'),
          ),
        ),
      ]),
    );
  }

  // ── Burnout ─────────────────────────────────────────────────────────────────
  Widget _buildBurnoutTab() {
    if (_loadingBurnout) return const Center(child: CircularProgressIndicator());
    if (_burnout == null) {
      return Center(
        child: ElevatedButton(
          onPressed: _loadBurnout,
          child: const Text('Check Burnout'),
        ),
      );
    }
    final warning = _burnout!['warning'] as bool;
    final days = _burnout!['consecutive_working_days'] as int;
    final message = _burnout!['message'] as String;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        const SizedBox(height: 20),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: warning ? Colors.red[50] : Colors.green[50],
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: warning ? Colors.red.shade200 : Colors.green.shade200),
          ),
          child: Column(children: [
            Text(warning ? '🔥' : '✅', style: const TextStyle(fontSize: 48)),
            const SizedBox(height: 12),
            Text(
              warning ? 'Burnout Warning' : "You're in good shape",
              style: TextStyle(
                fontSize: 18, fontWeight: FontWeight.bold,
                color: warning ? Colors.red[700] : Colors.green[700],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '$days consecutive working days',
              style: const TextStyle(fontSize: 14, color: Colors.grey),
            ),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: warning ? Colors.red[800] : Colors.green[800],
              ),
            ),
          ]),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () { setState(() => _burnout = null); _loadBurnout(); },
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh'),
          ),
        ),
      ]),
    );
  }

  // ── History ─────────────────────────────────────────────────────────────────
  Widget _buildHistoryTab() {
    if (_loadingHistory) return const Center(child: CircularProgressIndicator());
    if (_history.isEmpty) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('No history yet.', style: TextStyle(color: Colors.grey)),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: _loadHistory, child: const Text('Load History')),
        ]),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _history.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final r = _history[i] as Map<String, dynamic>;
        final rating = r['performance_rating'];
        final salary = r['net_salary'];
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: Colors.grey.shade200),
            borderRadius: BorderRadius.circular(12),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6)],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(r['month'] as String,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            const SizedBox(height: 8),
            _row('Present Days', '${r['present_days']}'),
            _row('Avg Hours/Day', '${r['avg_hours_per_day']}h'),
            _row('Approved Leaves', '${r['approved_leaves']}'),
            _row('Performance Rating', rating != null ? '$rating / 5' : '—'),
            _row('Net Salary', salary != null ? '₹${(salary as num).toStringAsFixed(0)}' : '—'),
          ]),
        );
      },
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(label, style: const TextStyle(fontSize: 13, color: Colors.grey)),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
        ]),
      );
}
