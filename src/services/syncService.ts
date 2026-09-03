// src/services/syncService.ts

interface SyncQueueItem {
  id: string;
  endpoint: string;
  method: string;
  data: any;
  timestamp: number;
}

class SyncService {
  private readonly STORAGE_KEY = 'syncQueue';

  getQueue(): SyncQueueItem[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveQueue(queue: SyncQueueItem[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
  }

  async addToQueue(endpoint: string, method: string, data: any): Promise<void> {
    const queue = this.getQueue();
    queue.push({
      id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      endpoint,
      method,
      data,
      timestamp: Date.now()
    });
    this.saveQueue(queue);
    console.log(`📥 Ajouté à la file d'attente: ${endpoint}`);
  }

  async sync(): Promise<void> {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    console.log(`🔄 Synchronisation de ${queue.length} action(s)...`);
    const token = localStorage.getItem('token');
    const successful: string[] = [];

    for (const item of queue) {
      try {
        const response = await fetch(`http://localhost:3001${item.endpoint}`, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(item.data)
        });

        if (response.ok) {
          successful.push(item.id);
          console.log(`✅ Sync réussie: ${item.endpoint}`);
        }
      } catch (error) {
        console.error(`❌ Erreur sync: ${item.endpoint}`, error);
      }
    }

    if (successful.length > 0) {
      const newQueue = queue.filter(item => !successful.includes(item.id));
      this.saveQueue(newQueue);
    }
  }

  hasPending(): boolean {
    return this.getQueue().length > 0;
  }

  count(): number {
    return this.getQueue().length;
  }

  clear(): void {
    this.saveQueue([]);
    console.log('🧹 File d\'attente vidée');
  }
}

export const syncService = new SyncService();