import { query, isDbConnected } from '../client.js';
import { BrandingSettings } from '../schema.js';
import fs from 'fs';
import path from 'path';

export class SettingsRepository {
  private static instance: SettingsRepository | null = null;
  private memorySettings: Map<string, any> = new Map();
  private memoryBranding: BrandingSettings = {
    id: 'default',
    brandName: 'Xorvila',
    brandLogo: '',
    customLogos: {},
    themeSettings: {},
    updatedAt: new Date().toISOString()
  };

  public static getInstance(): SettingsRepository {
    if (!SettingsRepository.instance) {
      SettingsRepository.instance = new SettingsRepository();
    }
    return SettingsRepository.instance;
  }

  // --- System Settings (Generic Key-Value JSONB) ---
  public async get<T = any>(key: string, defaultValue: T): Promise<T> {
    try {
      const res = await query<any>('SELECT value FROM system_settings WHERE key = $1 LIMIT 1', [key]);
      if (res.rows[0]?.value !== undefined) {
        return res.rows[0].value;
      }
    } catch {
      if (this.memorySettings.has(key)) {
        return this.memorySettings.get(key);
      }
    }
    return defaultValue;
  }

  public async set<T = any>(key: string, value: T): Promise<void> {
    this.memorySettings.set(key, value);
    try {
      await query(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [key, JSON.stringify(value)]);
    } catch {}
  }

  public async getAllSystemSettings(): Promise<Record<string, any>> {
    try {
      const res = await query<any>('SELECT key, value FROM system_settings');
      const result: Record<string, any> = {};
      for (const row of res.rows) {
        result[row.key] = row.value;
      }
      return result;
    } catch {
      const result: Record<string, any> = {};
      for (const [k, v] of this.memorySettings.entries()) {
        result[k] = v;
      }
      return result;
    }
  }

  // --- Branding Settings ---
  public async getBranding(): Promise<BrandingSettings> {
    try {
      const res = await query<any>(`
        SELECT id, brand_name as "brandName", brand_logo as "brandLogo",
               custom_logos as "customLogos", theme_settings as "themeSettings", updated_at as "updatedAt"
        FROM branding_settings
        WHERE id = 'default'
        LIMIT 1
      `);
      if (res.rows[0]) {
        this.memoryBranding = res.rows[0];
        return res.rows[0];
      }
    } catch {}

    return this.memoryBranding;
  }

  public async updateBranding(updates: Partial<BrandingSettings>): Promise<BrandingSettings> {
    const current = await this.getBranding();
    const merged: BrandingSettings = {
      ...current,
      ...updates,
      customLogos: updates.customLogos !== undefined ? updates.customLogos : current.customLogos,
      themeSettings: updates.themeSettings !== undefined ? updates.themeSettings : current.themeSettings,
      updatedAt: new Date().toISOString()
    };
    this.memoryBranding = merged;

    try {
      const res = await query<any>(`
        INSERT INTO branding_settings (id, brand_name, brand_logo, custom_logos, theme_settings, updated_at)
        VALUES ('default', $1, $2, $3, $4, NOW())
        ON CONFLICT (id) DO UPDATE SET
          brand_name = EXCLUDED.brand_name,
          brand_logo = EXCLUDED.brand_logo,
          custom_logos = EXCLUDED.custom_logos,
          theme_settings = EXCLUDED.theme_settings,
          updated_at = NOW()
        RETURNING id, brand_name as "brandName", brand_logo as "brandLogo",
                  custom_logos as "customLogos", theme_settings as "themeSettings", updated_at as "updatedAt"
      `, [
        merged.brandName,
        merged.brandLogo,
        JSON.stringify(merged.customLogos || {}),
        JSON.stringify(merged.themeSettings || {})
      ]);

      if (res.rows[0]) {
        return res.rows[0];
      }
    } catch {}

    return merged;
  }
}
