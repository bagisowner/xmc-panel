import { query } from '../client.js';
import { AuditLog, Alert } from '../schema.js';

export class AuditRepository {
  private static instance: AuditRepository | null = null;

  public static getInstance(): AuditRepository {
    if (!AuditRepository.instance) {
      AuditRepository.instance = new AuditRepository();
    }
    return AuditRepository.instance;
  }

  public async findAll(limit = 300): Promise<AuditLog[]> {
    const res = await query<any>(`
      SELECT id, user_id as "userId", user_email as "userEmail", server_id as "serverId",
             action, details, ip_address as "ipAddress", created_at as "createdAt"
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    return res.rows;
  }

  public async create(log: Omit<AuditLog, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<AuditLog> {
    const id = log.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const res = await query<any>(`
      INSERT INTO audit_logs (id, user_id, user_email, server_id, action, details, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, user_id as "userId", user_email as "userEmail", server_id as "serverId",
                action, details, ip_address as "ipAddress", created_at as "createdAt"
    `, [
      id,
      log.userId || null,
      log.userEmail || null,
      log.serverId || null,
      log.action,
      log.details,
      log.ipAddress || '127.0.0.1',
      log.createdAt || new Date().toISOString()
    ]);
    return res.rows[0];
  }

  // --- Alerts ---
  public async getAlerts(serverId?: string): Promise<Alert[]> {
    if (serverId) {
      const res = await query<any>(`
        SELECT id, server_id as "serverId", type, threshold::numeric, trigger_value::numeric as "triggerValue",
               status, created_at as "createdAt"
        FROM alerts
        WHERE server_id = $1
        ORDER BY created_at DESC
      `, [serverId]);
      return res.rows.map(r => ({
        ...r,
        threshold: Number(r.threshold),
        triggerValue: Number(r.triggerValue)
      }));
    }
    const res = await query<any>(`
      SELECT id, server_id as "serverId", type, threshold::numeric, trigger_value::numeric as "triggerValue",
             status, created_at as "createdAt"
      FROM alerts
      ORDER BY created_at DESC
    `);
    return res.rows.map(r => ({
      ...r,
      threshold: Number(r.threshold),
      triggerValue: Number(r.triggerValue)
    }));
  }

  public async createAlert(alert: Alert): Promise<Alert> {
    const res = await query<any>(`
      INSERT INTO alerts (id, server_id, type, threshold, trigger_value, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, server_id as "serverId", type, threshold::numeric, trigger_value::numeric as "triggerValue",
                status, created_at as "createdAt"
    `, [
      alert.id,
      alert.serverId,
      alert.type,
      alert.threshold,
      alert.triggerValue,
      alert.status || 'Active',
      alert.createdAt || new Date().toISOString()
    ]);
    const r = res.rows[0];
    return {
      ...r,
      threshold: Number(r.threshold),
      triggerValue: Number(r.triggerValue)
    };
  }
}
