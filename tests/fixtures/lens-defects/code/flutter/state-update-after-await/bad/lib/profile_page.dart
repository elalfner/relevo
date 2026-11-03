import 'package:flutter/material.dart';

class User {
  const User(this.name);
  final String name;
}

Future<User> fetchUser() async => const User('Ana');

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  String name = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final user = await fetchUser();
    setState(() => name = user.name);
  }

  @override
  Widget build(BuildContext context) => Text(name);
}
