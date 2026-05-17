/// Model data pengguna (mahasiswa)
/// Menyimpan informasi identitas dari backend /api/users/me.
/// Token TIDAK disimpan di model — dikelola oleh Firebase Auth.
class UserModel {
  final String id;
  final String name;
  final String nim;
  final String email;
  final String role;

  const UserModel({
    required this.id,
    required this.name,
    required this.nim,
    required this.email,
    this.role = 'student',
  });

  /// Parsing dari JSON response GET /api/users/me
  /// Format: { "success": true, "data": { "id", "name", "nim", "email", "role" } }
  factory UserModel.fromJson(Map<String, dynamic> json) {
    final data = json['data'] ?? json;
    return UserModel(
      id: data['id']?.toString() ?? '',
      name: data['name']?.toString() ?? '',
      nim: data['nim']?.toString() ?? '',
      email: data['email']?.toString() ?? '',
      role: data['role']?.toString() ?? 'student',
    );
  }

  /// Konversi ke JSON untuk POST /api/users (setelah register)
  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'nim': nim,
      'role': role,
    };
  }

  /// Membuat salinan dengan perubahan tertentu
  UserModel copyWith({
    String? id,
    String? name,
    String? nim,
    String? email,
    String? role,
  }) {
    return UserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      nim: nim ?? this.nim,
      email: email ?? this.email,
      role: role ?? this.role,
    );
  }

  @override
  String toString() => 'UserModel(id: $id, name: $name, nim: $nim)';
}
