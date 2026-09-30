import { query } from '../client.js';
import { FirestoreDocument, SecurityRule, Product, UserBalance, Transaction } from '../schema.js';

export class FirestoreRepository {
  private static instance: FirestoreRepository | null = null;

  public static getInstance(): FirestoreRepository {
    if (!FirestoreRepository.instance) {
      FirestoreRepository.instance = new FirestoreRepository();
    }
    return FirestoreRepository.instance;
  }

  public async getCollections(): Promise<string[]> {
    const res = await query<any>('SELECT DISTINCT collection FROM firestore_documents ORDER BY collection ASC');
    return res.rows.map(r => r.collection);
  }

  public async getDocuments(collection: string): Promise<FirestoreDocument[]> {
    const res = await query<any>(`
      SELECT id, collection, data, created_at as "createdAt", updated_at as "updatedAt"
      FROM firestore_documents
      WHERE collection = $1
      ORDER BY created_at ASC
    `, [collection]);
    return res.rows;
  }

  public async getDocument(collection: string, docId: string): Promise<FirestoreDocument | null> {
    const res = await query<any>(`
      SELECT id, collection, data, created_at as "createdAt", updated_at as "updatedAt"
      FROM firestore_documents
      WHERE collection = $1 AND id = $2
      LIMIT 1
    `, [collection, docId]);
    return res.rows[0] || null;
  }

  public async createOrUpdateDocument(collection: string, docId: string, data: Record<string, any>): Promise<FirestoreDocument> {
    const now = new Date().toISOString();
    const res = await query<any>(`
      INSERT INTO firestore_documents (id, collection, data, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $4)
      ON CONFLICT (collection, id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW()
      RETURNING id, collection, data, created_at as "createdAt", updated_at as "updatedAt"
    `, [docId, collection, JSON.stringify(data), now]);
    return res.rows[0];
  }

  public async patchDocument(collection: string, docId: string, patch: Record<string, any>): Promise<FirestoreDocument | null> {
    const existing = await this.getDocument(collection, docId);
    if (!existing) return null;
    const merged = { ...existing.data, ...patch };
    return this.createOrUpdateDocument(collection, docId, merged);
  }

  public async deleteDocument(collection: string, docId: string): Promise<boolean> {
    const res = await query('DELETE FROM firestore_documents WHERE collection = $1 AND id = $2', [collection, docId]);
    return (res.rowCount || 0) > 0;
  }

  // --- Security Rules ---
  public async getSecurityRules(): Promise<SecurityRule[]> {
    const res = await query<any>(`
      SELECT id, collection, allow_read as "allowRead", allow_write as "allowWrite", created_at as "createdAt"
      FROM security_rules
      ORDER BY created_at ASC
    `);
    return res.rows;
  }

  public async setSecurityRules(rules: SecurityRule[]): Promise<void> {
    await query('DELETE FROM security_rules');
    for (const rule of rules) {
      await query(`
        INSERT INTO security_rules (id, collection, allow_read, allow_write, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [rule.id || `rule_${Date.now()}`, rule.collection, rule.allowRead || 'authenticated', rule.allowWrite || 'authenticated']);
    }
  }

  // --- Products & Store Economy ---
  public async getProducts(): Promise<Product[]> {
    const res = await query<any>(`
      SELECT id, title, price::numeric, category, in_stock as "inStock", tags, rating::numeric, metadata, created_at as "createdAt"
      FROM products
      ORDER BY created_at DESC
    `);
    return res.rows.map(r => ({
      ...r,
      price: Number(r.price),
      rating: Number(r.rating)
    }));
  }

  public async createProduct(prod: Product): Promise<Product> {
    const res = await query<any>(`
      INSERT INTO products (id, title, price, category, in_stock, tags, rating, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        price = EXCLUDED.price,
        category = EXCLUDED.category,
        in_stock = EXCLUDED.in_stock,
        tags = EXCLUDED.tags,
        rating = EXCLUDED.rating,
        metadata = EXCLUDED.metadata
      RETURNING id, title, price::numeric, category, in_stock as "inStock", tags, rating::numeric, metadata, created_at as "createdAt"
    `, [
      prod.id,
      prod.title,
      prod.price,
      prod.category || null,
      prod.inStock ?? true,
      prod.tags || [],
      prod.rating || 5.0,
      JSON.stringify(prod.metadata || {})
    ]);
    const r = res.rows[0];
    return {
      ...r,
      price: Number(r.price),
      rating: Number(r.rating)
    };
  }
}
