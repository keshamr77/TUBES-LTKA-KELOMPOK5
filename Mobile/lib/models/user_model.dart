/// Model data pengguna (mahasiswa)
/// Phase 1: Data dari SharedPreferences (mock)
/// Phase 2: Data dari GET /api/users/me
class UserModel {
  final String id;
  final String name;
  final String nim;
  final String email;

  const UserModel({
    required this.id,
    required this.name,
    required this.nim,
    required this.email,
  });

  /// Parsing dari JSON response GET /api/users/me (Phase 2)
  factory UserModel.fromJson(Map<String, dynamic> json) {
    final data = json['data'] ?? json;
    return UserModel(
      id: data['userId']?.toString() ?? data['id']?.toString() ?? '',
      name: data['name']?.toString() ?? '',
      nim: data['nim']?.toString() ?? '',
      email: data['email']?.toString() ?? '',
    );
  }

  /// Konversi ke JSON
  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'nim': nim,
    };
  }

  /// Membuat salinan dengan perubahan tertentu
  UserModel copyWith({
    String? id,
    String? name,
    String? nim,
    String? email,
  }) {
    return UserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      nim: nim ?? this.nim,
      email: email ?? this.email,
    );
  }

  @override
  String toString() => 'UserModel(id: $id, name: $name, nim: $nim)';
}
