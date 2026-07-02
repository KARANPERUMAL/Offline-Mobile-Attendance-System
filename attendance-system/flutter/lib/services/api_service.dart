import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiService {
  ApiService._internal();
  static final ApiService instance = ApiService._internal();

  static const String _tokenKey = 'jwt_token';
  static const String _baseUrlKey = 'base_url';
  static const String publicBaseUrl =
      'https://offline-attendance-systemfinal-year-project-production.up.railway.app';
  static const String _defaultBaseUrl = publicBaseUrl;

  final _storage = const FlutterSecureStorage(
    // Use EncryptedSharedPreferences on Android — much faster than Keystore
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  late Dio _dio;

  // ── In-memory cache — read from storage ONCE at init, never again ──────
  String _cachedToken = '';
  String _cachedBaseUrl = _defaultBaseUrl;

  Future<void> init() async {
    // Read both values in parallel — only storage reads happen here
    _cachedBaseUrl = _defaultBaseUrl;
    final token = await _storage.read(key: _tokenKey);
    _cachedToken = token ?? '';
    await _storage.write(key: _baseUrlKey, value: _defaultBaseUrl);

    _dio = Dio(BaseOptions(
      baseUrl: _cachedBaseUrl,
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 5),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        // Use cached token — NO async storage read on every request
        if (_cachedToken.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $_cachedToken';
        }
        return handler.next(options);
      },
      onError: (error, handler) => handler.next(error),
    ));
  }

  Future<void> setBaseUrl(String url) async {
    final normalizedUrl = normalizeBaseUrl(url);
    _cachedBaseUrl = normalizedUrl;
    _dio.options.baseUrl = normalizedUrl;
    await _storage.write(key: _baseUrlKey, value: normalizedUrl);
  }

  Future<void> usePublicBaseUrl() async {
    await setBaseUrl(publicBaseUrl);
  }

  Future<String?> getBaseUrl() async => _cachedBaseUrl;

  String get activeBaseUrl => _cachedBaseUrl;

  Future<void> updateServerIp(String teacherIp) async {
    await setBaseUrl('http://$teacherIp:8080');
  }

  Future<void> saveToken(String token) async {
    _cachedToken = token;
    _storage.write(key: _tokenKey, value: token);
  }

  Future<void> clearToken() async {
    _cachedToken = '';
    _cachedBaseUrl = _defaultBaseUrl;
    _dio.options.baseUrl = _defaultBaseUrl;
    await Future.wait([
      _storage.delete(key: _tokenKey),
      _storage.delete(key: _baseUrlKey),
    ]);
  }

  // ── Auth ──────────────────────────────────────────────────────
  Future<Map<String, dynamic>> login(String username, String password) async {
    try {
      await usePublicBaseUrl();
      final response = await _dio.post('/api/auth/login',
          data: {'username': username, 'password': password});
      return response.data['data'];
    } on DioException catch (e) {
      throw Exception(_friendlyDioError(e));
    }
  }

  static String normalizeBaseUrl(String value) {
    var url = value.trim();
    if (url.isEmpty) {
      throw const FormatException('Server URL is required.');
    }

    url = url.replaceAll(RegExp(r'/+$'), '');
    final hasScheme = RegExp(r'^[a-zA-Z][a-zA-Z0-9+.-]*://').hasMatch(url);
    if (!hasScheme) {
      final scheme = _isLocalServer(url) ? 'http' : 'https';
      url = '$scheme://$url';
    }

    final uri = Uri.tryParse(url);
    if (uri == null || uri.host.trim().isEmpty) {
      throw const FormatException('Enter a valid server URL.');
    }

    final host = uri.host.toLowerCase();
    if (host == 'production.up.railway.app' ||
        host == 'up.railway.app' ||
        host == 'railway.app') {
      throw const FormatException(
        'Enter the full Railway app URL, not only production.up.railway.app.',
      );
    }

    if (uri.scheme != 'http' && uri.scheme != 'https') {
      throw const FormatException(
          'Server URL must start with http:// or https://.');
    }

    return uri.replace(path: '', query: null, fragment: null).toString();
  }

  static bool _isLocalServer(String url) {
    final host = url.split('/').first.split(':').first.toLowerCase();
    return host == 'localhost' ||
        host == '10.0.2.2' ||
        RegExp(r'^(\d{1,3}\.){3}\d{1,3}$').hasMatch(host);
  }

  String _friendlyDioError(DioException error) {
    if (error.response?.statusCode == 401) {
      return 'Invalid username or password.';
    }

    final message = error.message ?? '';
    final lowLevelError = error.error?.toString() ?? '';
    if (message.contains('Failed host lookup') ||
        lowLevelError.contains('Failed host lookup') ||
        lowLevelError.contains('No address associated with hostname')) {
      return 'Cannot reach the cloud server from this phone. Connect to Wi-Fi or mobile data, then open $publicBaseUrl/api/auth/health in Chrome to test.';
    }

    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return 'Server did not respond in time. Check your internet connection or try again.';
    }

    if (error.type == DioExceptionType.connectionError) {
      return 'Could not connect to the cloud server. Check Wi-Fi/mobile data and try again.';
    }

    return 'Unable to login right now. Please try again.';
  }

  // ── Teacher ───────────────────────────────────────────────────
  Future<Map<String, dynamic>> generateOtp(
      int subjectId, String timeSlot) async {
    final response = await _dio.post('/api/teacher/otp/generate',
        data: {'subjectId': subjectId, 'timeSlot': timeSlot});
    return response.data['data'];
  }

  Future<List<dynamic>> getSubjects(
      {int? departmentId, int? yearOfStudy}) async {
    final params = <String, dynamic>{};
    if (departmentId != null) params['departmentId'] = departmentId;
    if (yearOfStudy != null) params['yearOfStudy'] = yearOfStudy;
    final response =
        await _dio.get('/api/teacher/subjects', queryParameters: params);
    return response.data['data'];
  }

  // ── Student ───────────────────────────────────────────────────
  Future<List<dynamic>> getMyAttendance() async {
    final response = await _dio.get('/api/student/attendance');
    final data = response.data['data'];
    if (data == null) return [];
    return data as List<dynamic>;
  }

  // ── Sync ──────────────────────────────────────────────────────
  Future<Map<String, dynamic>> syncAttendance(
      List<Map<String, dynamic>> records) async {
    final response =
        await _dio.post('/api/sync/attendance', data: {'records': records});
    return response.data['data'];
  }

  Future<void> finalizeSession({
    required int subjectId,
    required int teacherId,
    required int departmentId,
    required int yearOfStudy,
    required String attendanceDate,
    required String timeSlot,
    required List<int> presentStudentIds,
  }) async {
    await _dio.post('/api/sync/finalize-session', data: {
      'subjectId': subjectId,
      'teacherId': teacherId,
      'departmentId': departmentId,
      'yearOfStudy': yearOfStudy,
      'attendanceDate': attendanceDate,
      'timeSlot': timeSlot,
      'presentStudentIds': presentStudentIds,
    });
  }

  // ── Admin — Register ──────────────────────────────────────────
  Future<Map<String, dynamic>> registerTeacher(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/api/admin/teachers', data: data);
    return response.data['data'];
  }

  Future<Map<String, dynamic>> registerStudent(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/api/admin/students', data: data);
    return response.data['data'];
  }

  // ── Admin — Departments ───────────────────────────────────────
  Future<List<dynamic>> getDepartments() async {
    final response = await _dio.get('/api/admin/departments');
    return response.data['data'];
  }

  Future<Map<String, dynamic>> createDepartment(
      String name, String code) async {
    final response = await _dio
        .post('/api/admin/departments', data: {'name': name, 'code': code});
    return response.data['data'];
  }

  // ── Admin — Subjects ──────────────────────────────────────────
  Future<List<dynamic>> getAllSubjects() async {
    final response = await _dio.get('/api/admin/subjects');
    return response.data['data'];
  }

  Future<Map<String, dynamic>> createSubject({
    required String name,
    required String code,
    required int departmentId,
    required int yearOfStudy,
    int credits = 3,
  }) async {
    final response = await _dio.post('/api/admin/subjects', data: {
      'name': name,
      'code': code,
      'departmentId': departmentId,
      'yearOfStudy': yearOfStudy,
      'credits': credits,
    });
    return response.data['data'];
  }

  // ── Admin — Attendance Stats ──────────────────────────────────
  Future<List<dynamic>> getAttendanceStats({
    int? studentId,
    int? subjectId,
    int? departmentId,
    int? yearOfStudy,
  }) async {
    final params = <String, dynamic>{};
    if (studentId != null) params['studentId'] = studentId;
    if (subjectId != null) params['subjectId'] = subjectId;
    if (departmentId != null) params['departmentId'] = departmentId;
    if (yearOfStudy != null) params['yearOfStudy'] = yearOfStudy;
    final response =
        await _dio.get('/api/admin/attendance/stats', queryParameters: params);
    return response.data['data'];
  }

  // ── Admin — Excel Export ──────────────────────────────────────
  Future<List<int>> exportAttendanceExcel(
      {int? departmentId, int? yearOfStudy}) async {
    final params = <String, dynamic>{};
    if (departmentId != null) params['departmentId'] = departmentId;
    if (yearOfStudy != null) params['yearOfStudy'] = yearOfStudy;
    final response = await _dio.get(
      '/api/admin/attendance/export',
      queryParameters: params,
      options: Options(responseType: ResponseType.bytes),
    );
    return response.data as List<int>;
  }

  // ── Admin — Password Reset ────────────────────────────────────
  Future<void> resetPassword(String username, String newPassword) async {
    await _dio.post('/api/admin/reset-password',
        data: {'username': username, 'newPassword': newPassword});
  }

  // ── Admin — List Teachers & Students ─────────────────────────
  Future<List<dynamic>> getTeachers() async {
    final response = await _dio.get('/api/admin/teachers');
    return response.data['data'];
  }

  Future<List<dynamic>> getStudents(
      {int? departmentId, int? yearOfStudy}) async {
    final params = <String, dynamic>{};
    if (departmentId != null) params['departmentId'] = departmentId;
    if (yearOfStudy != null) params['yearOfStudy'] = yearOfStudy;
    final response =
        await _dio.get('/api/admin/students', queryParameters: params);
    return response.data['data'];
  }
}
