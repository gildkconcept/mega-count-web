import {
  FilesetResolver,
  ObjectDetector,
  Detection,
} from "@mediapipe/tasks-vision";

/**
 * Catégories d'estimation.
 *
 * Important :
 * "men" / "women" ne doivent pas être considérés comme
 * le genre réel d'une personne. Ce sont des classifications
 * visuelles estimées par un modèle.
 */
export type AppearanceCategory =
  | "men"
  | "women"
  | "children"
  | "unknown";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PersonDetection {
  id: string;

  bbox: BoundingBox;

  detectionScore: number;

  category: "person";

  appearance: {
    category: AppearanceCategory;
    confidence: number;
  };

  timestamp: number;
}

export interface DetectorConfig {
  scoreThreshold: number;
  maxResults: number;
  delegate: "GPU" | "CPU";
  modelAssetPath: string;
  wasmPath: string;
}

const DEFAULT_CONFIG: DetectorConfig = {
  scoreThreshold: 0.5,
  maxResults: 20,
  delegate: "GPU",

  wasmPath:
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",

  modelAssetPath:
    "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
};

/**
 * Détecteur de personnes.
 *
 * Responsabilités :
 * 1. Initialiser MediaPipe
 * 2. Détecter les personnes
 * 3. Normaliser les bounding boxes
 * 4. Fournir une structure exploitable par un tracker
 * 5. Préparer l'intégration d'un modèle de classification
 *
 * La classification d'apparence est volontairement séparée
 * de la détection.
 */
export class PersonDetector {
  private detector: ObjectDetector | null = null;

  private initialized = false;

  private config: DetectorConfig;

  private lastTimestamp = -1;

  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Initialise MediaPipe.
   */
  async initialize(): Promise<boolean> {
    if (this.initialized && this.detector) {
      return true;
    }

    try {
      console.log("🔄 Initialisation du détecteur...");

      const vision = await FilesetResolver.forVisionTasks(
        this.config.wasmPath
      );

      this.detector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: this.config.modelAssetPath,
          delegate: this.config.delegate,
        },

        runningMode: "VIDEO",

        scoreThreshold: this.config.scoreThreshold,

        maxResults: this.config.maxResults,
      });

      this.initialized = true;

      console.log("✅ Détecteur MediaPipe initialisé");

      return true;
    } catch (error) {
      this.initialized = false;
      this.detector = null;

      console.error(
        "❌ Impossible d'initialiser le détecteur :",
        error
      );

      return false;
    }
  }

  /**
   * Détecte les personnes présentes dans une frame vidéo.
   */
  detectPersons(
    video: HTMLVideoElement,
    timestamp: number = performance.now()
  ): PersonDetection[] {
    if (!this.detector || !this.initialized) {
      console.warn("⚠️ Le détecteur n'est pas initialisé");
      return [];
    }

    /**
     * MediaPipe VIDEO nécessite des timestamps
     * monotoniquement croissants.
     */
    if (timestamp <= this.lastTimestamp) {
      timestamp = this.lastTimestamp + 1;
    }

    this.lastTimestamp = timestamp;

    try {
      const result = this.detector.detectForVideo(
        video,
        timestamp
      );

      if (!result.detections?.length) {
        return [];
      }

      return result.detections
        .filter((detection) => this.isPerson(detection))
        .map((detection, index) =>
          this.normalizeDetection(
            detection,
            timestamp,
            index
          )
        );
    } catch (error) {
      console.error(
        "❌ Erreur pendant la détection :",
        error
      );

      return [];
    }
  }

  /**
   * Vérifie qu'une détection correspond à une personne.
   */
  private isPerson(detection: Detection): boolean {
    const category = detection.categories?.[0];

    if (!category) {
      return false;
    }

    return (
      category.categoryName?.toLowerCase() === "person" &&
      category.score >= this.config.scoreThreshold
    );
  }

  /**
   * Transforme la réponse MediaPipe en structure
   * indépendante du moteur de détection.
   */
  private normalizeDetection(
    detection: Detection,
    timestamp: number,
    index: number
  ): PersonDetection {
    const bbox = detection.boundingBox;

    const x = bbox?.originX ?? 0;
    const y = bbox?.originY ?? 0;
    const width = bbox?.width ?? 0;
    const height = bbox?.height ?? 0;

    const score =
      detection.categories?.[0]?.score ?? 0;

    return {
      /**
       * ID temporaire.
       *
       * Ce n'est PAS encore un vrai tracking ID.
       * Le tracker pourra ensuite remplacer cette valeur.
       */
      id: `detection-${timestamp}-${index}`,

      bbox: {
        x,
        y,
        width,
        height,
      },

      detectionScore: score,

      category: "person",

      /**
       * La classification est volontairement "unknown".
       *
       * Un modèle spécialisé pourra ensuite remplir
       * cette propriété.
       */
      appearance: {
        category: "unknown",
        confidence: 0,
      },

      timestamp,
    };
  }

  /**
   * Vérifie si le moteur est prêt.
   */
  isReady(): boolean {
    return this.initialized && this.detector !== null;
  }

  /**
   * Retourne la configuration actuelle.
   */
  getConfig(): DetectorConfig {
    return {
      ...this.config,
    };
  }

  /**
   * Libère les ressources MediaPipe.
   */
  close(): void {
    if (this.detector) {
      this.detector.close();
      this.detector = null;
    }

    this.initialized = false;
    this.lastTimestamp = -1;

    console.log("🛑 Détecteur arrêté");
  }
}

/**
 * Instance globale utilisable dans l'application.
 */
export const personDetector = new PersonDetector();