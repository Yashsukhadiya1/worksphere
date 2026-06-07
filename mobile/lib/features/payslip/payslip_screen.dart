import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../shared/models/models.dart';

class PayslipScreen extends StatefulWidget {
  const PayslipScreen({super.key});
  @override
  State<PayslipScreen> createState() => _PayslipScreenState();
}

class _PayslipScreenState extends State<PayslipScreen> {
  final _dio = createDio();
  List<Payslip> _payslips = [];

  @override
  void initState() {
    super.initState();
    _dio.get('/payroll/payslips/me').then((res) {
      if (!mounted) return;
      setState(() => _payslips = (res.data as List).map((e) => Payslip.fromJson(e)).toList());
    }).catchError((_) {
      // 404 or error — no payslips yet
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Payslips')),
      body: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _payslips.length,
        itemBuilder: (_, i) {
          final p = _payslips[i];
          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(p.createdAt.substring(0, 10), style: const TextStyle(color: Colors.grey, fontSize: 12)),
                const SizedBox(height: 8),
                _row('Gross Salary', p.grossSalary),
                _row('Deductions', p.totalDeductions),
                const Divider(),
                _row('Net Salary', p.netSalary, bold: true, color: Colors.green[700]!),
              ]),
            ),
          );
        },
      ),
    );
  }

  Widget _row(String label, String value, {bool bold = false, Color? color}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 2),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
      Text(value, style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal, color: color)),
    ]),
  );
}
