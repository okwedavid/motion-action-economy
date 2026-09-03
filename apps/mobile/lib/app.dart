import 'package:flutter/material.dart';

import 'screens/auth_screen.dart';
import 'screens/missions_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/reputation_screen.dart';
import 'screens/wallet_screen.dart';
import 'screens/home_screen.dart';
import 'state/auth_state.dart';
import 'theme.dart';

class MotionApp extends StatelessWidget {
  final AuthState auth;
  const MotionApp({super.key, required this.auth});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MOTION',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: AnimatedBuilder(
        animation: auth,
        builder: (context, _) {
          switch (auth.status) {
            case AuthStatus.unknown:
              return const _BootScreen();
            case AuthStatus.unauthenticated:
              return AuthScreen(auth: auth);
            case AuthStatus.authenticated:
              return MainShell(auth: auth);
          }
        },
      ),
    );
  }
}

class _BootScreen extends StatelessWidget {
  const _BootScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}

class MainShell extends StatefulWidget {
  final AuthState auth;
  const MainShell({super.key, required this.auth});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final tabs = [
      HomeScreen(auth: widget.auth),
      MissionsScreen(api: widget.auth.api),
      ReputationScreen(api: widget.auth.api),
      WalletScreen(api: widget.auth.api),
      ProfileScreen(auth: widget.auth),
    ];
    return Scaffold(
      body: IndexedStack(index: _index, children: tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore), label: 'Missions'),
          NavigationDestination(icon: Icon(Icons.local_fire_department_outlined), selectedIcon: Icon(Icons.local_fire_department), label: 'Reputation'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), selectedIcon: Icon(Icons.account_balance_wallet), label: 'Wallet'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
