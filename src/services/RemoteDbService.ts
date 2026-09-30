import axios from 'axios';

const REMOTE_URL = 'https://xbase.fxtun.ru/api/v1';
const API_TOKEN = 'mc_live_76cc64db7573e65bcd04d298cde1654b15091e52afd3c052';

export class RemoteDbService {
  private static instance: RemoteDbService;
  private client = axios.create({
    baseURL: REMOTE_URL,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  private constructor() {}

  public static getInstance(): RemoteDbService {
    if (!RemoteDbService.instance) {
      RemoteDbService.instance = new RemoteDbService();
    }
    return RemoteDbService.instance;
  }

  async getServers() {
    try {
      const response = await this.client.get('/servers');
      return response.data;
    } catch (error) {
      console.error('[RemoteDb] Error fetching servers:', error);
      return [];
    }
  }

  async saveServer(serverData: any) {
    try {
      const response = await this.client.post('/servers', serverData);
      return response.data;
    } catch (error) {
      console.error('[RemoteDb] Error saving server:', error);
      return null;
    }
  }

  // Generic collection operations
  async getCollection(collection: string) {
    try {
      const response = await this.client.get(`/documents/${collection}`);
      return response.data;
    } catch (error) {
      console.error(`[RemoteDb] Error fetching collection ${collection}:`, error);
      return [];
    }
  }

  async getDocument(collection: string, docId: string) {
    try {
      const response = await this.client.get(`/documents/${collection}/${docId}`);
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async saveDocument(collection: string, docId: string, data: any) {
    try {
      const response = await this.client.post(`/documents/${collection}/${docId}`, { data });
      return response.data;
    } catch (error) {
      console.error(`[RemoteDb] Error saving document ${collection}/${docId}:`, error);
      return null;
    }
  }

  // Auth helper: get current user from remote if token is valid
  async getCurrentUser() {
    try {
      const response = await this.client.get('/auth/me');
      return response.data;
    } catch (error) {
      return null;
    }
  }
}
