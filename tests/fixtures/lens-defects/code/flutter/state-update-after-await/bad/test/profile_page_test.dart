import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app/profile_page.dart';

void main() {
  testWidgets('the profile page shows the name after it loads', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: ProfilePage()));
    await tester.pumpAndSettle();
    expect(find.text('Ana'), findsOneWidget);
  });
}
