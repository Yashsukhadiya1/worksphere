// ── Auth ──────────────────────────────────────────────────────────────────────
class TokenResponse {
  final String accessToken;
  final String refreshToken;
  TokenResponse({required this.accessToken, required this.refreshToken});
  factory TokenResponse.fromJson(Map<String, dynamic> j) =>
      TokenResponse(accessToken: j['access_token'], refreshToken: j['refresh_token']);
}

class UserProfile {
  final String id, email, role;
  final bool isActive;
  UserProfile({required this.id, required this.email, required this.role, required this.isActive});
  factory UserProfile.fromJson(Map<String, dynamic> j) =>
      UserProfile(id: j['id'], email: j['email'], role: j['role'], isActive: j['is_active']);
}

// ── Employee ──────────────────────────────────────────────────────────────────
class EmployeeSummary {
  final String id, employeeNumber, firstName, lastName, jobTitle, status;
  final String? departmentName;
  EmployeeSummary({required this.id, required this.employeeNumber, required this.firstName,
      required this.lastName, required this.jobTitle, required this.status, this.departmentName});
  factory EmployeeSummary.fromJson(Map<String, dynamic> j) => EmployeeSummary(
    id: j['id'], employeeNumber: j['employee_number'],
    firstName: j['first_name'], lastName: j['last_name'],
    jobTitle: j['job_title'], status: j['status'],
    departmentName: j['department']?['name'],
  );
}

// ── Attendance ────────────────────────────────────────────────────────────────
class AttendanceRecord {
  final String id, employeeId, checkIn, date;
  final String? checkOut, totalHours;
  AttendanceRecord({required this.id, required this.employeeId, required this.checkIn,
      required this.date, this.checkOut, this.totalHours});
  factory AttendanceRecord.fromJson(Map<String, dynamic> j) => AttendanceRecord(
    id: j['id'], employeeId: j['employee_id'],
    checkIn: j['check_in'], date: j['date'],
    checkOut: j['check_out'], totalHours: j['total_hours']?.toString(),
  );
}

class LeaveRequest {
  final String id, employeeId, startDate, endDate, leaveType, status;
  final String? reason;
  LeaveRequest({required this.id, required this.employeeId, required this.startDate,
      required this.endDate, required this.leaveType, required this.status, this.reason});
  factory LeaveRequest.fromJson(Map<String, dynamic> j) => LeaveRequest(
    id: j['id'], employeeId: j['employee_id'],
    startDate: j['start_date'], endDate: j['end_date'],
    leaveType: j['leave_type'], status: j['status'],
    reason: j['reason'],
  );
}

// ── Payroll ───────────────────────────────────────────────────────────────────
class Payslip {
  final String id, payrollRunId, employeeId, grossSalary, totalDeductions, netSalary, createdAt;
  Payslip({required this.id, required this.payrollRunId, required this.employeeId,
      required this.grossSalary, required this.totalDeductions, required this.netSalary,
      required this.createdAt});
  factory Payslip.fromJson(Map<String, dynamic> j) => Payslip(
    id: j['id'], payrollRunId: j['payroll_run_id'], employeeId: j['employee_id'],
    grossSalary: j['gross_salary'].toString(), totalDeductions: j['total_deductions'].toString(),
    netSalary: j['net_salary'].toString(), createdAt: j['created_at'],
  );
}

// ── Performance ───────────────────────────────────────────────────────────────
class Goal {
  final String id, employeeId, title, createdAt;
  final int progress;
  final String? description, dueDate;
  Goal({required this.id, required this.employeeId, required this.title,
      required this.progress, required this.createdAt, this.description, this.dueDate});
  factory Goal.fromJson(Map<String, dynamic> j) => Goal(
    id: j['id'], employeeId: j['employee_id'], title: j['title'],
    progress: j['progress'], description: j['description'], dueDate: j['due_date'],
    createdAt: j['created_at'] ?? '',
  );
}

class Review {
  final String id, cycleId, employeeId, reviewerId, submittedAt;
  final int rating;
  final String? comments;
  Review({required this.id, required this.cycleId, required this.employeeId,
      required this.reviewerId, required this.rating, required this.submittedAt, this.comments});
  factory Review.fromJson(Map<String, dynamic> j) => Review(
    id: j['id'], cycleId: j['cycle_id'], employeeId: j['employee_id'],
    reviewerId: j['reviewer_id'], rating: j['rating'],
    submittedAt: j['submitted_at'], comments: j['comments'],
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────
class AppNotification {
  final String id, userId, title, body, createdAt;
  final bool isRead;
  AppNotification({required this.id, required this.userId, required this.title,
      required this.body, required this.isRead, required this.createdAt});
  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
    id: j['id'], userId: j['user_id'], title: j['title'], body: j['body'],
    isRead: j['is_read'], createdAt: j['created_at'],
  );
}
