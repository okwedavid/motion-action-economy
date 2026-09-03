import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../state/auth_state.dart';
import '../theme.dart';

class AuthScreen extends StatefulWidget {
  final AuthState auth;
  const AuthScreen({super.key, required this.auth});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();

  bool _register = false;
  bool _busy = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _firstName.dispose();
    _lastName.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_register) {
        await widget.auth.register(
          email: _email.text.trim(),
          password: _password.text,
          firstName: _firstName.text.trim(),
          lastName: _lastName.text.trim(),
        );
      } else {
        await widget.auth.login(email: _email.text.trim(), password: _password.text);
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Could not reach the server. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.directions_run, size: 56, color: AppColors.primary),
                  const SizedBox(height: 8),
                  const Text(
                    'MOTION',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.ink),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Prove real actions. Earn verified reputation.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted),
                  ),
                  const SizedBox(height: 24),
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(value: false, label: Text('Log in'), icon: Icon(Icons.login)),
                      ButtonSegment(value: true, label: Text('Create account'), icon: Icon(Icons.person_add)),
                    ],
                    selected: {_register},
                    onSelectionChanged: (s) => setState(() => _register = s.first),
                  ),
                  const SizedBox(height: 20),
                  if (_register) ...[
                    TextFormField(
                      controller: _firstName,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(labelText: 'First name', prefixIcon: Icon(Icons.person_outline)),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _lastName,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(labelText: 'Last name', prefixIcon: Icon(Icons.person_outline)),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                    ),
                    const SizedBox(height: 12),
                  ],
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline)),
                    validator: (v) {
                      if (v == null || !v.contains('@')) return 'Enter a valid email';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _password,
                    obscureText: _obscure,
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _submit(),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                    validator: (v) => (v == null || v.length < 8) ? 'At least 8 characters' : null,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFDECEC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFF5C2C0)),
                      ),
                      child: Text(_error!, style: const TextStyle(color: AppColors.destructive)),
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: _busy
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(_register ? 'Create account' : 'Log in'),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Demo build — connect it to the MOTION API and enable\nlive verification in production.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
