import { query } from '../client.js';
import { Schedule } from '../schema.js';

export class ScheduleRepository {
  private static instance: ScheduleRepository | null = null;

  public static getInstance(): ScheduleRepository {
    if (!ScheduleRepository.instance) {
      ScheduleRepository.instance = new ScheduleRepository();
    }
    return ScheduleRepository.instance;
  }

  public async findAll(): Promise<Schedule[]> {
    const res = await query<any>(`
      SELECT id, server_id as "serverId", name, cron_expression as "cronExpression",
             action, is_active as "isActive", last_run as "lastRun", next_run as "nextRun",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM schedules
      ORDER BY created_at DESC
    `);
    return res.rows;
  }

  public async findByServerId(serverId: string): Promise<Schedule[]> {
    const res = await query<any>(`
      SELECT id, server_id as "serverId", name, cron_expression as "cronExpression",
             action, is_active as "isActive", last_run as "lastRun", next_run as "nextRun",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM schedules
      WHERE server_id = $1
      ORDER BY created_at DESC
    `, [serverId]);
    return res.rows;
  }

  public async findById(id: string): Promise<Schedule | null> {
    const res = await query<any>(`
      SELECT id, server_id as "serverId", name, cron_expression as "cronExpression",
             action, is_active as "isActive", last_run as "lastRun", next_run as "nextRun",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM schedules
      WHERE id = $1
      LIMIT 1
    `, [id]);
    return res.rows[0] || null;
  }

  public async create(schedule: Schedule): Promise<Schedule> {
    const now = new Date().toISOString();
    const res = await query<any>(`
      INSERT INTO schedules (id, server_id, name, cron_expression, action, is_active, last_run, next_run, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        cron_expression = EXCLUDED.cron_expression,
        action = EXCLUDED.action,
        is_active = EXCLUDED.is_active,
        last_run = EXCLUDED.last_run,
        next_run = EXCLUDED.next_run,
        updated_at = NOW()
      RETURNING id, server_id as "serverId", name, cron_expression as "cronExpression",
                action, is_active as "isActive", last_run as "lastRun", next_run as "nextRun",
                created_at as "createdAt", updated_at as "updatedAt"
    `, [
      schedule.id,
      schedule.serverId,
      schedule.name,
      schedule.cronExpression,
      schedule.action,
      schedule.isActive ?? true,
      schedule.lastRun || null,
      schedule.nextRun || null,
      schedule.createdAt || now,
      schedule.updatedAt || now
    ]);
    return res.rows[0];
  }

  public async update(id: string, updates: Partial<Schedule>): Promise<Schedule | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.cronExpression !== undefined) {
      fields.push(`cron_expression = $${idx++}`);
      values.push(updates.cronExpression);
    }
    if (updates.action !== undefined) {
      fields.push(`action = $${idx++}`);
      values.push(updates.action);
    }
    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(updates.isActive);
    }
    if (updates.lastRun !== undefined) {
      fields.push(`last_run = $${idx++}`);
      values.push(updates.lastRun);
    }
    if (updates.nextRun !== undefined) {
      fields.push(`next_run = $${idx++}`);
      values.push(updates.nextRun);
    }

    fields.push(`updated_at = NOW()`);

    if (fields.length === 1) {
      return this.findById(id);
    }

    values.push(id);
    const sql = `
      UPDATE schedules
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING id, server_id as "serverId", name, cron_expression as "cronExpression",
                action, is_active as "isActive", last_run as "lastRun", next_run as "nextRun",
                created_at as "createdAt", updated_at as "updatedAt"
    `;

    const res = await query<any>(sql, values);
    return res.rows[0] || null;
  }

  public async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM schedules WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  }
}
