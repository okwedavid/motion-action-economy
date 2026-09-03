import 'package:flutter/material.dart';

import '../state/auth_state.dart';
import '../theme.dart';

class ProfileScreen extends StatelessWidget {
  final AuthState auth;
  const ProfileScreen({super.key, required this.auth});

  @override
  Widget build(BuildContext context) {
    final user = auth.user;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 32,
                    backgroundColor: AppColors.primary,
                    child: Text(
                      user == null || user.displayName.isEmpty
                          ? '?'
                          : user.displayName[0].toUpperCase(),
                      style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(user?.displayName ?? 'User',
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.ink)),
                  Text(user?.email ?? '', style: const TextStyle(color: AppColors.muted)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Column(
              children: [
                _infoTile(Icons.person_outline, 'First name', user?.firstName ?? ''),
                _infoTile(Icons.person_outline, 'Last name', user?.lastName ?? ''),
                _infoTile(
                  Icons.account_balance_wallet_outlined,
                  'BMONI user',
                  user?.bmoniUserId == null || user!.bmoniUserId!.isEmpty ? 'Not linked' : 'Linked',
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: () => auth.logout(),
            icon: const Icon(Icons.logout),
            label: const Text('Log out'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.destructive,
              side: const BorderSide(color: AppColors.destructive),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'MOTION — prove real actions, earn verified reputation.\n\nDemo build. Connect the live MOTION API and enable production verification and rails for real use.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted, fontSize: 12, height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _infoTile(IconData icon, String label, String value) {
    return ListTile(
      leading: Icon(icon, color: AppColors.primary),
      title: Text(label, style: const TextStyle(fontSize: 13, color: AppColors.muted)),
      subtitle: Text(value, style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink)),
    );
  }
}
