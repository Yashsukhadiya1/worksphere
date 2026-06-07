import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../shared/models/models.dart';

class PerformanceScreen extends StatefulWidget {
  const PerformanceScreen({super.key});
  @override
  State<PerformanceScreen> createState() => _PerformanceScreenState();
}

class _PerformanceScreenState extends State<PerformanceScreen> {
  final _dio = createDio();
  List<Review> _reviews = [];
  List<Goal> _goals = [];
  final _goalCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _dueDate = '';
  String _msg = '';
  String _error = '';
  bool _loading = true;
  int _tab = 1; // 0 = reviews, 1 = goals

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() { _loading = true; _error = ''; });
    try {
      final rv = await _dio.get('/performance/reviews/me')
          .timeout(const Duration(seconds: 10));
      final gv = await _dio.get('/performance/goals/me')
          .timeout(const Duration(seconds: 10));
      if (!mounted) return;
      setState(() {
        _reviews = (rv.data as List).map((e) => Review.fromJson(e)).toList();
        _goals   = (gv.data as List).map((e) => Goal.fromJson(e)).toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = 'Failed to load data'; });
    }
  }

  Future<void> _addGoal() async {
    if (_goalCtrl.text.trim().isEmpty) return;
    setState(() { _msg = ''; _error = ''; });
    try {
      await _dio.post('/performance/goals', data: {
        'title': _goalCtrl.text.trim(),
        if (_descCtrl.text.trim().isNotEmpty) 'description': _descCtrl.text.trim(),
        if (_dueDate.isNotEmpty) 'due_date': _dueDate,
      });
      _goalCtrl.clear(); _descCtrl.clear();
      setState(() { _dueDate = ''; _msg = 'Goal added ✅'; });
      _load();
    } catch (e) {
      setState(() => _error = 'Failed to add goal');
    }
  }

  Future<void> _updateProgress(String id, int val) async {
    try {
      await _dio.put('/performance/goals/$id', data: {'progress': val});
      _load();
    } catch (_) {}
  }

  Widget _starRow(int rating) => Row(
    mainAxisSize: MainAxisSize.min,
    children: List.generate(5, (i) => Icon(
      i < rating ? Icons.star : Icons.star_border,
      color: i < rating ? Colors.amber : Colors.grey[400],
      size: 20,
    )),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Performance'),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)],
      ),
      body: Column(children: [
        // Tab bar
        Container(
          color: Colors.white,
          child: Row(children: [
            _tabBtn('Goals', 1),
            _tabBtn('Reviews', 0),
          ]),
        ),
        if (_msg.isNotEmpty)
          Container(
            width: double.infinity,
            color: Colors.green[50],
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(_msg, style: TextStyle(color: Colors.green[800], fontSize: 13)),
          ),
        if (_error.isNotEmpty)
          Container(
            width: double.infinity,
            color: Colors.red[50],
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(_error, style: TextStyle(color: Colors.red[800], fontSize: 13)),
          ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _tab == 0 ? _reviewsTab() : _goalsTab(),
        ),
      ]),
    );
  }

  Widget _tabBtn(String label, int idx) => Expanded(
    child: GestureDetector(
      onTap: () => setState(() => _tab = idx),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: _tab == idx ? const Color(0xFF2563EB) : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        child: Text(label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: _tab == idx ? const Color(0xFF2563EB) : Colors.grey,
          )),
      ),
    ),
  );

  Widget _reviewsTab() {
    if (_reviews.isEmpty) {
      return const Center(
        child: Text('No performance reviews yet.\nYour manager will submit reviews for you.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.grey)),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _reviews.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final r = _reviews[i];
        return Card(
          elevation: 1,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                _starRow(r.rating),
                Text(r.submittedAt.length > 10 ? r.submittedAt.substring(0, 10) : r.submittedAt,
                  style: const TextStyle(color: Colors.grey, fontSize: 12)),
              ]),
              if (r.comments != null && r.comments!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(r.comments!, style: const TextStyle(fontSize: 14, color: Colors.black87)),
              ],
            ]),
          ),
        );
      },
    );
  }

  Widget _goalsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Add goal form
        Card(
          elevation: 1,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Add My Goal', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(height: 12),
              TextField(
                controller: _goalCtrl,
                decoration: const InputDecoration(
                  labelText: 'Goal title *',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _descCtrl,
                decoration: const InputDecoration(
                  labelText: 'Description (optional)',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  child: Text(
                    _dueDate.isEmpty ? 'Due date (optional)' : 'Due: $_dueDate',
                    style: TextStyle(fontSize: 13, color: _dueDate.isEmpty ? Colors.grey : Colors.black87),
                  ),
                ),
                TextButton(
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now(),
                      firstDate: DateTime.now(),
                      lastDate: DateTime(2030),
                    );
                    if (picked != null) {
                      setState(() => _dueDate = picked.toIso8601String().substring(0, 10));
                    }
                  },
                  child: const Text('Pick Date'),
                ),
              ]),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _addGoal,
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB)),
                  child: const Text('Add Goal', style: TextStyle(color: Colors.white)),
                ),
              ),
            ]),
          ),
        ),

        const SizedBox(height: 16),
        Text('My Goals (${_goals.length})',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 8),

        if (_goals.isEmpty)
          const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: Text('No goals yet. Add one above or wait for your manager to assign one.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey, fontSize: 13))),
          )
        else
          ..._goals.map((g) => Card(
            elevation: 1,
            margin: const EdgeInsets.only(bottom: 8),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Expanded(child: Text(g.title, style: const TextStyle(fontWeight: FontWeight.w600))),
                  Text('${g.progress}%',
                    style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold)),
                ]),
                if (g.description != null && g.description!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(g.description!, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  ),
                if (g.dueDate != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text('Due: ${g.dueDate}', style: const TextStyle(fontSize: 11, color: Colors.orange)),
                  ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: g.progress / 100,
                    minHeight: 8,
                    backgroundColor: Colors.grey[200],
                    valueColor: const AlwaysStoppedAnimation(Color(0xFF2563EB)),
                  ),
                ),
                Slider(
                  value: g.progress.toDouble(),
                  min: 0, max: 100, divisions: 20,
                  activeColor: const Color(0xFF2563EB),
                  onChangeEnd: (v) => _updateProgress(g.id, v.round()),
                  onChanged: (v) => setState(() {
                    final idx = _goals.indexWhere((gl) => gl.id == g.id);
                    if (idx >= 0) {
                      _goals[idx] = Goal(
                        id: g.id, employeeId: g.employeeId,
                        title: g.title, description: g.description,
                        progress: v.round(), dueDate: g.dueDate,
                        createdAt: g.createdAt,
                      );
                    }
                  }),
                ),
              ]),
            ),
          )),
      ]),
    );
  }
}
