import 'package:flutter/material.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  String name = '';

  Future<void> load() async {
    final user = await fetchUser();
    setState(() => name = user.name);
  }

  @override
  Widget build(BuildContext context) => Text(name);
}
