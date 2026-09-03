import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSSD from '@tensorflow-models/coco-ssd';

export interface Detection {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

export interface PersonDetection {
  id: string;
  bbox: [number, number, number, number];
  confidence: number;
  timestamp: number;
}

export class AIService {
  private model: any = null;
  private isModelLoaded: boolean = false;
  private trackingId: number = 0;
  private trackedPersons: Map<string, PersonDetection> = new Map();
  private count: number = 0;
  private countingLine: number = 0.5; // Position de la ligne de comptage (50% de l'écran)
  private onPersonCountChange?: (count: number) => void;

  constructor() {}

  /**
   * Initialiser le modèle TensorFlow.js
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 Initialisation de TensorFlow.js...');
      
      // Initialiser le backend WebGL
      await tf.setBackend('webgl');
      await tf.ready();
      
      console.log('✅ TensorFlow.js initialisé avec backend:', tf.getBackend());
      
      // Charger le modèle COCO-SSD
      console.log('🔄 Chargement du modèle COCO-SSD...');
      this.model = await cocoSSD.load({
        base: 'mobilenet_v2',
        modelUrl: undefined
      });
      
      this.isModelLoaded = true;
      console.log('✅ Modèle COCO-SSD chargé avec succès!');
      
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de TensorFlow.js:', error);
      return false;
    }
  }

  /**
   * Détecter les personnes dans une image
   */
  async detectPersons(imageData: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<Detection[]> {
    if (!this.isModelLoaded || !this.model) {
      console.warn('⚠️ Modèle non chargé');
      return [];
    }

    try {
      const predictions = await this.model.detect(imageData);
      
      // Filtrer uniquement les personnes
      const persons = predictions.filter(
        (pred: any) => pred.class === 'person' && pred.score > 0.5
      );
      
      return persons.map((p: any) => ({
        bbox: p.bbox,
        class: p.class,
        score: p.score
      }));
    } catch (error) {
      console.error('❌ Erreur lors de la détection:', error);
      return [];
    }
  }

  /**
   * Suivre les personnes et compter les passages
   */
  trackAndCount(
    detections: Detection[],
    frameWidth: number,
    frameHeight: number
  ): { count: number; trackedPersons: PersonDetection[] } {
    const currentTime = Date.now();
    const trackingThreshold = 1000; // 1 seconde sans détection = personne perdue
    const iouThreshold = 0.4; // Seuil IoU pour le matching
    
    // Nettoyer les personnes trop âgées
    const trackedIds = Array.from(this.trackedPersons.keys());
    for (const id of trackedIds) {
      const person = this.trackedPersons.get(id);
      if (person && currentTime - person.timestamp > trackingThreshold) {
        this.trackedPersons.delete(id);
      }
    }

    // Matcher les détections avec les personnes suivies
    const newDetections: PersonDetection[] = detections.map((det, index) => {
      const centerX = det.bbox[0] + det.bbox[2] / 2;
      const centerY = det.bbox[1] + det.bbox[3] / 2;
      
      // Calculer la position relative (0-1)
      const relX = centerX / frameWidth;
      const relY = centerY / frameHeight;
      
      // Trouver la meilleure correspondance
      let bestMatchId: string | null = null;
      let bestIoU = 0;
      
      for (const [id, tracked] of this.trackedPersons) {
        const trackedCenterX = tracked.bbox[0] + tracked.bbox[2] / 2;
        const trackedCenterY = tracked.bbox[1] + tracked.bbox[3] / 2;
        
        // Calculer l'intersection over union
        const iou = this.calculateIoU(
          [det.bbox[0], det.bbox[1], det.bbox[0] + det.bbox[2], det.bbox[1] + det.bbox[3]],
          [tracked.bbox[0], tracked.bbox[1], tracked.bbox[0] + tracked.bbox[2], tracked.bbox[1] + tracked.bbox[3]]
        );
        
        if (iou > iouThreshold && iou > bestIoU) {
          bestIoU = iou;
          bestMatchId = id;
        }
      }
      
      let id: string;
      let isNew = false;
      
      if (bestMatchId) {
        id = bestMatchId;
        const tracked = this.trackedPersons.get(id)!;
        
        // Vérifier si la personne a traversé la ligne de comptage
        const prevY = tracked.bbox[1] / frameHeight;
        const currentY = det.bbox[1] / frameHeight;
        
        if (prevY < this.countingLine && currentY >= this.countingLine) {
          this.count++;
          console.log(`✅ Personne comptée! Total: ${this.count}`);
          if (this.onPersonCountChange) {
            this.onPersonCountChange(this.count);
          }
        }
      } else {
        id = `person_${this.trackingId++}`;
        isNew = true;
      }
      
      // Mettre à jour la position
      const person: PersonDetection = {
        id,
        bbox: det.bbox,
        confidence: det.score,
        timestamp: currentTime
      };
      
      this.trackedPersons.set(id, person);
      
      return person;
    });
    
    return {
      count: this.count,
      trackedPersons: Array.from(this.trackedPersons.values())
    };
  }

  /**
   * Calculer l'Intersection over Union (IoU) entre deux boîtes
   */
  private calculateIoU(box1: number[], box2: number[]): number {
    const [x1_1, y1_1, x2_1, y2_1] = box1;
    const [x1_2, y1_2, x2_2, y2_2] = box2;
    
    const x_left = Math.max(x1_1, x1_2);
    const y_top = Math.max(y1_1, y1_2);
    const x_right = Math.min(x2_1, x2_2);
    const y_bottom = Math.min(y2_1, y2_2);
    
    if (x_right < x_left || y_bottom < y_top) return 0;
    
    const intersection = (x_right - x_left) * (y_bottom - y_top);
    const area1 = (x2_1 - x1_1) * (y2_1 - y1_1);
    const area2 = (x2_2 - x1_2) * (y2_2 - y1_2);
    const union = area1 + area2 - intersection;
    
    return intersection / union;
  }

  /**
   * Définir la position de la ligne de comptage (0-1)
   */
  setCountingLine(position: number): void {
    this.countingLine = Math.max(0, Math.min(1, position));
    console.log(`📏 Ligne de comptage définie à ${Math.round(this.countingLine * 100)}%`);
  }

  /**
   * Réinitialiser le compteur
   */
  resetCount(): void {
    this.count = 0;
    this.trackedPersons.clear();
    this.trackingId = 0;
    console.log('🔄 Compteur réinitialisé');
  }

  /**
   * Définir le callback pour les changements de comptage
   */
  onCountChange(callback: (count: number) => void): void {
    this.onPersonCountChange = callback;
  }

  /**
   * Obtenir le nombre actuel
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Obtenir les personnes suivies
   */
  getTrackedPersons(): PersonDetection[] {
    return Array.from(this.trackedPersons.values());
  }

  /**
   * Vérifier si le modèle est chargé
   */
  isReady(): boolean {
    return this.isModelLoaded;
  }
}

// Export d'une instance unique (Singleton)
export const aiService = new AIService();