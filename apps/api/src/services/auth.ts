import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { UsersRepo, SessionsRepo } from '../repos/users.js';
import { UnauthorizedError } from '../lib/errors.js';
import { config } from '../config/index.js';

const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sessionTtlMs(): number {
  const match = /^(\d+)([smhd])$/.exec(config.sessionTtl);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2];
  const mult: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * mult[unit];
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  bmoniUserId: string | null;
}

export function toPublicUser(
  user: { id: string; email: string; first_name: string; last_name: string; bmoni_user_id: string | null },
  profile: { display_name?: string } = {},
): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    displayName: profile.display_name || user.first_name,
    bmoniUserId: user.bmoni_user_id,
  };
}

export class AuthService {
  constructor(
    private users: UsersRepo,
    private sessions: SessionsRepo,
  ) {}

  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    displayName?: string;
  }): Promise<{ user: PublicUser; token: string; expiresAt: Date }> {
    const passwordHash = await hashPassword(input.password);
    const user = await this.users.create({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    });
    await this.users.insertProfile(user.id, input.displayName || input.firstName);
    const { token, expiresAt } = await this.createSession(user.id);
    return { user: toPublicUser(user), token, expiresAt };
  }

  async login(email: string, password: string): Promise<{ user: PublicUser; token: string; expiresAt: Date }> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedError('Invalid email or password');
    if (user.status !== 'active') throw new UnauthorizedError('Account is not active');
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw new UnauthorizedError('Invalid email or password');
    const profile = await this.users.getProfile(user.id);
    const { token, expiresAt } = await this.createSession(user.id);
    return { user: toPublicUser(user, profile), token, expiresAt };
  }

  private async createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + sessionTtlMs());
    await this.sessions.create(userId, tokenHash, expiresAt);
    return { token, expiresAt };
  }

  /** Validates a bearer token -> returns the public user. */
  async authenticate(token: string | undefined): Promise<PublicUser> {
    if (!token) throw new UnauthorizedError('Missing authorization token');
    const session = await this.sessions.findByTokenHash(sha256(token));
    if (!session) throw new UnauthorizedError('Invalid or expired session');
    const user = await this.users.findById(session.user_id);
    if (!user || user.status !== 'active') throw new UnauthorizedError('Invalid or expired session');
    const profile = await this.users.getProfile(user.id);
    return toPublicUser(user, profile);
  }

  async logout(userId: string, token: string | undefined): Promise<void> {
    if (!token) return;
    await this.sessions.revoke(userId, sha256(token));
  }
}
