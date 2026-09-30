/**
 * StorageService
 * Provides persistent server-side & database-backed storage for user preferences,
 * theme settings, custom logos, branding, and server configs.
 * Eliminates client-side localStorage dependency while ensuring safe data migration.
 */

export interface UserPreferencesPayload {
  theme?: Record<string, any>;
  sidebarCollapsed?: boolean;
  audioFx?: boolean;
  customPreferences?: Record<string, any>;
  customLogos?: Record<string, string>;
}

export interface SystemSettingsPayload {
  brandName?: string;
  brandLogo?: string;
  customLogos?: Record<string, string>;
  [key: string]: any;
}

export class StorageService {
  private static instance: StorageService | null = null;
  private memoryCache: Map<string, any> = new Map();
  private isMigrated = false;

  private constructor() {}

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Safe One-Time Migration from localStorage to Backend Database
   * Reads existing client data, sends it to the server-side migration endpoint,
   * confirms persistence, and clears legacy localStorage keys.
   */
  public async migrateLegacyLocalStorage(authToken?: string | null): Promise<void> {
    if (this.isMigrated || typeof window === 'undefined') return;

    try {
      const keysToMigrate = [
        'arix_theme_settings_v4',
        'arix_theme_settings_v3',
        'mc_custom_logos',
        'mc_panel_brand_name',
        'mc_panel_brand_logo',
        'arix_sidebar_collapsed'
      ];

      const migrationPayload: Record<string, any> = {};
      let hasDataToMigrate = false;

      for (const key of keysToMigrate) {
        const val = window.localStorage.getItem(key);
        if (val !== null && val !== undefined) {
          hasDataToMigrate = true;
          try {
            migrationPayload[key] = JSON.parse(val);
          } catch {
            migrationPayload[key] = val;
          }
        }
      }

      if (hasDataToMigrate) {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        const res = await fetch('/api/user/migrate-localstorage', {
          method: 'POST',
          headers,
          body: JSON.stringify(migrationPayload)
        });

        if (res.ok) {
          // Clean up legacy keys from localStorage once securely persisted
          for (const key of keysToMigrate) {
            window.localStorage.removeItem(key);
          }
          console.log('[StorageService] Legacy localStorage migrated to server storage successfully.');
        }
      }

      this.isMigrated = true;
    } catch (err) {
      console.warn('[StorageService] Local storage migration skipped or failed:', err);
    }
  }

  /**
   * Fetch User Settings from Backend (PostgreSQL & Server File Storage)
   */
  public async getUserSettings(authToken?: string | null): Promise<UserPreferencesPayload> {
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/user/settings', {
        headers,
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        this.memoryCache.set('user_settings', data);
        return data;
      }
    } catch (err) {
      console.warn('[StorageService] Failed to load user settings from server:', err);
    }

    return this.memoryCache.get('user_settings') || {};
  }

  /**
   * Update User Settings on Backend (PostgreSQL & Server File Storage)
   */
  public async updateUserSettings(settings: Partial<UserPreferencesPayload>, authToken?: string | null): Promise<boolean> {
    try {
      // Update memory cache immediately
      const current = this.memoryCache.get('user_settings') || {};
      const merged = { ...current, ...settings };
      this.memoryCache.set('user_settings', merged);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(settings)
      });

      return res.ok;
    } catch (err) {
      console.error('[StorageService] Failed to update user settings on server:', err);
      return false;
    }
  }

  /**
   * Fetch System & Branding Settings from Backend
   */
  public async getSystemSettings(): Promise<SystemSettingsPayload> {
    try {
      const res = await fetch('/api/system-settings');
      if (res.ok) {
        const data = await res.json();
        this.memoryCache.set('system_settings', data);
        return data;
      }
    } catch (err) {
      console.warn('[StorageService] Failed to load system settings:', err);
    }

    return this.memoryCache.get('system_settings') || {
      brandName: 'Xorvila',
      brandLogo: '',
      customLogos: {}
    };
  }

  /**
   * Update System & Branding Settings on Backend
   */
  public async updateSystemSettings(settings: Partial<SystemSettingsPayload>, authToken?: string | null): Promise<boolean> {
    try {
      const current = this.memoryCache.get('system_settings') || {};
      const merged = { ...current, ...settings };
      this.memoryCache.set('system_settings', merged);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/system-settings', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(settings)
      });

      return res.ok;
    } catch (err) {
      console.error('[StorageService] Failed to update system settings:', err);
      return false;
    }
  }

  /**
   * Get User Isolated Storage Stats & Info
   */
  public async getUserStorageInfo(authToken?: string | null): Promise<any> {
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch('/api/user/storage', {
        headers,
        credentials: 'include'
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[StorageService] Failed to fetch user storage stats:', err);
    }
    return null;
  }
}
