import { query } from '../client.js';
import { AppUser, AuthSession, RefreshToken, OAuthAccount, ApiKey, AuthSettings, UserSettings } from '../schema.js';
import bcrypt from 'bcryptjs';

export class UserRepository {
  private static instance: UserRepository | null = null;

  public static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  // --- Users ---
  public async findAll(): Promise<AppUser[]> {
    const res = await query<any>(`
      SELECT id, email, normalized_email as "normalizedEmail", username, display_name as "displayName",
             password_hash as "passwordHash", role, email_verified as "emailVerified", disabled,
             avatar_url as "avatarUrl", bio, google_id as "googleId",
             email_verification_token as "emailVerificationToken",
             email_verification_expires as "emailVerificationExpires",
             password_reset_token as "passwordResetToken",
             password_reset_expires as "passwordResetExpires",
             created_at as "createdAt", updated_at as "updatedAt", last_login_at as "lastLoginAt"
      FROM users
      ORDER BY created_at ASC
    `);
    return res.rows;
  }

  public async findById(id: string): Promise<AppUser | null> {
    const res = await query<any>(`
      SELECT id, email, normalized_email as "normalizedEmail", username, display_name as "displayName",
             password_hash as "passwordHash", role, email_verified as "emailVerified", disabled,
             avatar_url as "avatarUrl", bio, google_id as "googleId",
             email_verification_token as "emailVerificationToken",
             email_verification_expires as "emailVerificationExpires",
             password_reset_token as "passwordResetToken",
             password_reset_expires as "passwordResetExpires",
             created_at as "createdAt", updated_at as "updatedAt", last_login_at as "lastLoginAt"
      FROM users
      WHERE id = $1
      LIMIT 1
    `, [id]);
    return res.rows[0] || null;
  }

  public async findByEmail(email: string): Promise<AppUser | null> {
    const normalized = email.toLowerCase().trim();
    const res = await query<any>(`
      SELECT id, email, normalized_email as "normalizedEmail", username, display_name as "displayName",
             password_hash as "passwordHash", role, email_verified as "emailVerified", disabled,
             avatar_url as "avatarUrl", bio, google_id as "googleId",
             email_verification_token as "emailVerificationToken",
             email_verification_expires as "emailVerificationExpires",
             password_reset_token as "passwordResetToken",
             password_reset_expires as "passwordResetExpires",
             created_at as "createdAt", updated_at as "updatedAt", last_login_at as "lastLoginAt"
      FROM users
      WHERE normalized_email = $1 OR LOWER(email) = $1
      LIMIT 1
    `, [normalized]);
    return res.rows[0] || null;
  }

  public async findByUsername(username: string): Promise<AppUser | null> {
    const normalized = username.toLowerCase().trim();
    const res = await query<any>(`
      SELECT id, email, normalized_email as "normalizedEmail", username, display_name as "displayName",
             password_hash as "passwordHash", role, email_verified as "emailVerified", disabled,
             avatar_url as "avatarUrl", bio, google_id as "googleId",
             email_verification_token as "emailVerificationToken",
             email_verification_expires as "emailVerificationExpires",
             password_reset_token as "passwordResetToken",
             password_reset_expires as "passwordResetExpires",
             created_at as "createdAt", updated_at as "updatedAt", last_login_at as "lastLoginAt"
      FROM users
      WHERE LOWER(username) = $1
      LIMIT 1
    `, [normalized]);
    return res.rows[0] || null;
  }

  public async findByGoogleId(googleId: string): Promise<AppUser | null> {
    const res = await query<any>(`
      SELECT id, email, normalized_email as "normalizedEmail", username, display_name as "displayName",
             password_hash as "passwordHash", role, email_verified as "emailVerified", disabled,
             avatar_url as "avatarUrl", bio, google_id as "googleId",
             email_verification_token as "emailVerificationToken",
             email_verification_expires as "emailVerificationExpires",
             password_reset_token as "passwordResetToken",
             password_reset_expires as "passwordResetExpires",
             created_at as "createdAt", updated_at as "updatedAt", last_login_at as "lastLoginAt"
      FROM users
      WHERE google_id = $1
      LIMIT 1
    `, [googleId]);
    return res.rows[0] || null;
  }

  public async create(user: Partial<AppUser> & { id: string; email: string; username: string; passwordHash: string }): Promise<AppUser> {
    const normalizedEmail = (user.normalizedEmail || user.email).toLowerCase().trim();
    const now = new Date().toISOString();

    const res = await query<any>(`
      INSERT INTO users (
        id, email, normalized_email, username, display_name, password_hash, role,
        email_verified, disabled, avatar_url, bio, google_id,
        email_verification_token, email_verification_expires,
        password_reset_token, password_reset_expires,
        created_at, updated_at, last_login_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        normalized_email = EXCLUDED.normalized_email,
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        email_verified = EXCLUDED.email_verified,
        disabled = EXCLUDED.disabled,
        avatar_url = EXCLUDED.avatar_url,
        bio = EXCLUDED.bio,
        google_id = EXCLUDED.google_id,
        updated_at = NOW()
      RETURNING id, email, normalized_email as "normalizedEmail", username, display_name as "displayName",
                password_hash as "passwordHash", role, email_verified as "emailVerified", disabled,
                avatar_url as "avatarUrl", bio, google_id as "googleId",
                email_verification_token as "emailVerificationToken",
                email_verification_expires as "emailVerificationExpires",
                password_reset_token as "passwordResetToken",
                password_reset_expires as "passwordResetExpires",
                created_at as "createdAt", updated_at as "updatedAt", last_login_at as "lastLoginAt"
    `, [
      user.id,
      user.email,
      normalizedEmail,
      user.username,
      user.displayName || user.username,
      user.passwordHash,
      user.role || 'User',
      user.emailVerified ?? false,
      user.disabled ?? false,
      user.avatarUrl || null,
      user.bio || null,
      user.googleId || null,
      user.emailVerificationToken || null,
      user.emailVerificationExpires || null,
      user.passwordResetToken || null,
      user.passwordResetExpires || null,
      user.createdAt || now,
      user.updatedAt || now,
      user.lastLoginAt || null
    ]);

    return res.rows[0];
  }

  public async update(id: string, updates: Partial<AppUser>): Promise<AppUser | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(updates.email);
      fields.push(`normalized_email = $${idx++}`);
      values.push(updates.email.toLowerCase().trim());
    }
    if (updates.username !== undefined) {
      fields.push(`username = $${idx++}`);
      values.push(updates.username);
    }
    if (updates.displayName !== undefined) {
      fields.push(`display_name = $${idx++}`);
      values.push(updates.displayName);
    }
    if (updates.passwordHash !== undefined) {
      fields.push(`password_hash = $${idx++}`);
      values.push(updates.passwordHash);
    }
    if (updates.role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(updates.role);
    }
    if (updates.emailVerified !== undefined) {
      fields.push(`email_verified = $${idx++}`);
      values.push(updates.emailVerified);
    }
    if (updates.disabled !== undefined) {
      fields.push(`disabled = $${idx++}`);
      values.push(updates.disabled);
    }
    if (updates.avatarUrl !== undefined) {
      fields.push(`avatar_url = $${idx++}`);
      values.push(updates.avatarUrl);
    }
    if (updates.bio !== undefined) {
      fields.push(`bio = $${idx++}`);
      values.push(updates.bio);
    }
    if (updates.googleId !== undefined) {
      fields.push(`google_id = $${idx++}`);
      values.push(updates.googleId);
    }
    if (updates.emailVerificationToken !== undefined) {
      fields.push(`email_verification_token = $${idx++}`);
      values.push(updates.emailVerificationToken);
    }
    if (updates.emailVerificationExpires !== undefined) {
      fields.push(`email_verification_expires = $${idx++}`);
      values.push(updates.emailVerificationExpires);
    }
    if (updates.passwordResetToken !== undefined) {
      fields.push(`password_reset_token = $${idx++}`);
      values.push(updates.passwordResetToken);
    }
    if (updates.passwordResetExpires !== undefined) {
      fields.push(`password_reset_expires = $${idx++}`);
      values.push(updates.passwordResetExpires);
    }
    if (updates.lastLoginAt !== undefined) {
      fields.push(`last_login_at = $${idx++}`);
      values.push(updates.lastLoginAt);
    }

    fields.push(`updated_at = NOW()`);

    if (fields.length === 1) {
      return this.findById(id);
    }

    values.push(id);
    const sql = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING id, email, normalized_email as "normalizedEmail", username, display_name as "displayName",
                password_hash as "passwordHash", role, email_verified as "emailVerified", disabled,
                avatar_url as "avatarUrl", bio, google_id as "googleId",
                email_verification_token as "emailVerificationToken",
                email_verification_expires as "emailVerificationExpires",
                password_reset_token as "passwordResetToken",
                password_reset_expires as "passwordResetExpires",
                created_at as "createdAt", updated_at as "updatedAt", last_login_at as "lastLoginAt"
    `;

    const res = await query<any>(sql, values);
    return res.rows[0] || null;
  }

  public async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM users WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  }

  // --- Sessions ---
  public async createSession(session: AuthSession): Promise<AuthSession> {
    const res = await query<any>(`
      INSERT INTO sessions (id, user_id, token, refresh_token, user_agent, ip_address, device_info, created_at, expires_at, revoked)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, user_id as "userId", token, refresh_token as "refreshToken",
                user_agent as "userAgent", ip_address as "ipAddress", device_info as "deviceInfo",
                created_at as "createdAt", expires_at as "expiresAt", revoked
    `, [
      session.id,
      session.userId,
      session.token,
      session.refreshToken || null,
      session.userAgent || null,
      session.ipAddress || null,
      session.deviceInfo || null,
      session.createdAt || new Date().toISOString(),
      session.expiresAt,
      session.revoked ?? false
    ]);
    return res.rows[0];
  }

  public async findSessionByToken(token: string): Promise<AuthSession | null> {
    const res = await query<any>(`
      SELECT id, user_id as "userId", token, refresh_token as "refreshToken",
             user_agent as "userAgent", ip_address as "ipAddress", device_info as "deviceInfo",
             created_at as "createdAt", expires_at as "expiresAt", revoked
      FROM sessions
      WHERE token = $1 AND revoked = FALSE AND expires_at > NOW()
      LIMIT 1
    `, [token]);
    return res.rows[0] || null;
  }

  public async findSessionByRefreshToken(refreshToken: string): Promise<AuthSession | null> {
    const res = await query<any>(`
      SELECT id, user_id as "userId", token, refresh_token as "refreshToken",
             user_agent as "userAgent", ip_address as "ipAddress", device_info as "deviceInfo",
             created_at as "createdAt", expires_at as "expiresAt", revoked
      FROM sessions
      WHERE refresh_token = $1 AND revoked = FALSE AND expires_at > NOW()
      LIMIT 1
    `, [refreshToken]);
    return res.rows[0] || null;
  }

  public async findSessionsByUserId(userId: string): Promise<AuthSession[]> {
    const res = await query<any>(`
      SELECT id, user_id as "userId", token, refresh_token as "refreshToken",
             user_agent as "userAgent", ip_address as "ipAddress", device_info as "deviceInfo",
             created_at as "createdAt", expires_at as "expiresAt", revoked
      FROM sessions
      WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()
      ORDER BY created_at DESC
    `, [userId]);
    return res.rows;
  }

  public async revokeSession(tokenIdOrId: string): Promise<boolean> {
    const res = await query(`
      UPDATE sessions
      SET revoked = TRUE
      WHERE id = $1 OR token = $1
    `, [tokenIdOrId]);
    return (res.rowCount || 0) > 0;
  }

  public async revokeAllSessionsForUser(userId: string, exceptToken?: string): Promise<void> {
    if (exceptToken) {
      await query(`
        UPDATE sessions
        SET revoked = TRUE
        WHERE user_id = $1 AND token != $2
      `, [userId, exceptToken]);
    } else {
      await query(`
        UPDATE sessions
        SET revoked = TRUE
        WHERE user_id = $1
      `, [userId]);
    }
  }

  // --- OAuth Accounts ---
  public async findOAuthAccount(provider: string, providerUserId: string): Promise<OAuthAccount | null> {
    const res = await query<any>(`
      SELECT id, provider, provider_user_id as "providerUserId", user_id as "userId",
             email, display_name as "displayName", avatar_url as "avatarUrl", created_at as "createdAt"
      FROM oauth_accounts
      WHERE provider = $1 AND provider_user_id = $2
      LIMIT 1
    `, [provider, providerUserId]);
    return res.rows[0] || null;
  }

  public async createOAuthAccount(account: OAuthAccount): Promise<OAuthAccount> {
    const res = await query<any>(`
      INSERT INTO oauth_accounts (id, provider, provider_user_id, user_id, email, display_name, avatar_url, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (provider, provider_user_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url
      RETURNING id, provider, provider_user_id as "providerUserId", user_id as "userId",
                email, display_name as "displayName", avatar_url as "avatarUrl", created_at as "createdAt"
    `, [
      account.id,
      account.provider,
      account.providerUserId,
      account.userId,
      account.email || null,
      account.displayName || null,
      account.avatarUrl || null,
      account.createdAt || new Date().toISOString()
    ]);
    return res.rows[0];
  }

  // --- API Keys ---
  public async findApiKeys(userId?: string): Promise<ApiKey[]> {
    if (userId) {
      const res = await query<any>(`
        SELECT id, user_id as "userId", name, key_prefix as "keyPrefix", key_hash as "keyHash",
               scopes, created_at as "createdAt", last_used_at as "lastUsedAt", revoked
        FROM api_keys
        WHERE user_id = $1 AND revoked = FALSE
        ORDER BY created_at DESC
      `, [userId]);
      return res.rows;
    }
    const res = await query<any>(`
      SELECT id, user_id as "userId", name, key_prefix as "keyPrefix", key_hash as "keyHash",
             scopes, created_at as "createdAt", last_used_at as "lastUsedAt", revoked
      FROM api_keys
      WHERE revoked = FALSE
      ORDER BY created_at DESC
    `);
    return res.rows;
  }

  public async createApiKey(apiKey: ApiKey): Promise<ApiKey> {
    const res = await query<any>(`
      INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, scopes, created_at, last_used_at, revoked)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, user_id as "userId", name, key_prefix as "keyPrefix", key_hash as "keyHash",
                scopes, created_at as "createdAt", last_used_at as "lastUsedAt", revoked
    `, [
      apiKey.id,
      apiKey.userId,
      apiKey.name,
      apiKey.keyPrefix,
      apiKey.keyHash,
      apiKey.scopes,
      apiKey.createdAt || new Date().toISOString(),
      apiKey.lastUsedAt || null,
      apiKey.revoked ?? false
    ]);
    return res.rows[0];
  }

  public async revokeApiKey(id: string, userId: string): Promise<boolean> {
    const res = await query(`
      UPDATE api_keys
      SET revoked = TRUE
      WHERE id = $1 AND user_id = $2
    `, [id, userId]);
    return (res.rowCount || 0) > 0;
  }

  public async verifyApiKey(rawKey: string): Promise<ApiKey | null> {
    if (!rawKey) return null;
    const prefix = rawKey.substring(0, 10);
    const res = await query<any>(`
      SELECT id, user_id as "userId", name, key_prefix as "keyPrefix", key_hash as "keyHash",
             scopes, created_at as "createdAt", last_used_at as "lastUsedAt", revoked
      FROM api_keys
      WHERE key_prefix = $1 AND revoked = FALSE
    `, [prefix]);

    for (const key of res.rows) {
      if (bcrypt.compareSync(rawKey, key.keyHash)) {
        await query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [key.id]);
        return key;
      }
    }
    return null;
  }

  // --- Auth Policy Settings ---
  public async getAuthSettings(): Promise<AuthSettings> {
    const res = await query<any>(`
      SELECT value FROM system_settings WHERE key = 'auth_settings' LIMIT 1
    `);
    if (res.rows[0]?.value) {
      return res.rows[0].value;
    }
    return {
      allowPasswordSignup: true,
      requireEmailVerification: false,
      passwordMinLength: 6
    };
  }

  public async updateAuthSettings(settings: Partial<AuthSettings>): Promise<AuthSettings> {
    const current = await this.getAuthSettings();
    const updated = { ...current, ...settings };
    await query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('auth_settings', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [JSON.stringify(updated)]);
    return updated;
  }

  // In-memory cache fallback for user settings
  private memoryUserSettings: Map<string, UserSettings> = new Map();

  // --- User Preferences & Settings ---
  public async getUserSettings(userId: string): Promise<UserSettings> {
    try {
      const res = await query<any>(`
        SELECT user_id as "userId", theme, sidebar_collapsed as "sidebarCollapsed",
               audio_fx as "audioFx", custom_preferences as "customPreferences", updated_at as "updatedAt"
        FROM user_settings
        WHERE user_id = $1
        LIMIT 1
      `, [userId]);

      if (res.rows[0]) {
        this.memoryUserSettings.set(userId, res.rows[0]);
        return res.rows[0];
      }
    } catch {}

    if (this.memoryUserSettings.has(userId)) {
      return this.memoryUserSettings.get(userId)!;
    }

    return {
      userId,
      theme: {},
      sidebarCollapsed: false,
      audioFx: true,
      customPreferences: {},
      updatedAt: new Date().toISOString()
    };
  }

  public async updateUserSettings(userId: string, settings: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.getUserSettings(userId);
    const merged = { ...current, ...settings, updatedAt: new Date().toISOString() };
    this.memoryUserSettings.set(userId, merged);

    try {
      await query(`
        INSERT INTO user_settings (user_id, theme, sidebar_collapsed, audio_fx, custom_preferences, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          theme = EXCLUDED.theme,
          sidebar_collapsed = EXCLUDED.sidebar_collapsed,
          audio_fx = EXCLUDED.audio_fx,
          custom_preferences = EXCLUDED.custom_preferences,
          updated_at = NOW()
      `, [
        userId,
        JSON.stringify(merged.theme || {}),
        merged.sidebarCollapsed ?? false,
        merged.audioFx ?? true,
        JSON.stringify(merged.customPreferences || {})
      ]);
    } catch {}

    return merged;
  }
}
