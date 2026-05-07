/// Model data pengguna (mahasiswa)
/// Menyimpan informasi identitas dan token autentikasi.
class UserModel {
  final String id;
  final String name;
  final String nim;
  final String email;
  final String token;

  const UserModel({
    required this.id,
    required this.name,
    required this.nim,
    required this.email,
    required this.token,
  });

  /// Parsing dari JSON response API
  factory UserModel.fromJson(Map<String, dynamic> json, {String? token}) {
    final user = json['user'] ?? json;
    return UserModel(
      id: user['id']?.toString() ?? '',
      name: user['name']?.toString() ?? '',
      nim: user['nim']?.toString() ?? '',
      email: user['email']?.toString() ?? '',
      token: token ?? json['token']?.toString() ?? '',
    );
  }

  /// Konversi ke JSON untuk penyimpanan lokal
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'nim': nim,
      'email': email,
      'token': token,
    };
  }

  /// Membuat salinan dengan perubahan tertentu
  UserModel copyWith({
    String? id,
    String? name,
    String? nim,
    String? email,
    String? token,
  }) {
    return UserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      nim: nim ?? this.nim,
      email: email ?? this.email,
      token: token ?? this.token,
    );
  }

  @override
  String toString() => 'UserModel(id: $id, name: $name, nim: $nim)';
}
