import {
  FilesetResolver,
  ObjectDetector,
  type Detection,
} from "@mediapipe/tasks-vision";

/**
 * Catégories utilisées par le frontend actuel.
 *
 * IMPORTANT :
 * Ces catégories représentent une estimation visuelle.
 * Elles ne déterminent pas le genre réel d'une personne.
 */
export type GenderCategory = "men" | "women" | "children";

export interface PersonDetection {
  /**
   * Format conservé pour la compatibilité avec counting-ai/page.tsx
   *
   * [x, y, width, height]
   */
  bbox: [number, number, number, number];

  /**
   * Score de détection de la personne par MediaPipe.
   */
  score: number;

  /**
   * Classe détectée.
   */
  class: "person";

  /**
   * Classification actuelle utilisée par le frontend.
   */
  gender: GenderCategory;

  /**
   * Confiance de l'estimation.
   */
  confidence: number;

  /**
   * Surface de la bounding box.
   */
  size: number;

  /**
   * Ratio hauteur / largeur.
   */
  aspectRatio: number;

  /**
   * Raccourcis conservés pour le frontend existant.
   */
  isChild: boolean;
  isWoman: boolean;
  isMan: boolean;
}

export interface PersonDetectorConfig {
  scoreThreshold: number;
  maxResults: number;
  delegate: "GPU" | "CPU";
  wasmPath: string;
  modelAssetPath: string;
}

/**
 * Configuration par défaut.
 */
const DEFAULT_CONFIG: PersonDetectorConfig = {
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
 * Cette classe est volontairement responsable uniquement de :
 *
 * - l'initialisation de MediaPipe
 * - la détection des personnes
 * - la normalisation des données
 * - l'estimation actuelle utilisée par le frontend
 *
 * Le système pourra ensuite être amélioré avec :
 *
 * - un vrai tracker
 * - un modèle spécialisé de classification
 * - un système anti-double-comptage
 * - une analyse temporelle sur plusieurs frames
 */
export class PersonDetector {
  private detector: ObjectDetector | null = null;

  private isInitialized = false;

  private lastTimestamp = -1;

  private config: PersonDetectorConfig;

  constructor(config: Partial<PersonDetectorConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Initialise MediaPipe.
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized && this.detector) {
      return true;
    }

    try {
      console.log("🔄 Initialisation du détecteur MediaPipe...");

      const filesetResolver = await FilesetResolver.forVisionTasks(
        this.config.wasmPath
      );

      this.detector = await ObjectDetector.createFromOptions(
        filesetResolver,
        {
          baseOptions: {
            modelAssetPath: this.config.modelAssetPath,
            delegate: this.config.delegate,
          },

          runningMode: "VIDEO",

          scoreThreshold: this.config.scoreThreshold,

          maxResults: this.config.maxResults,
        }
      );

      this.isInitialized = true;

      this.lastTimestamp = -1;

      console.log("✅ Détecteur MediaPipe initialisé");

      return true;
    } catch (error) {
      console.error(
        "❌ Erreur d'initialisation MediaPipe :",
        error
      );

      this.detector = null;
      this.isInitialized = false;

      return false;
    }
  }

  /**
   * Détecte les personnes dans une frame vidéo.
   *
   * La structure retournée reste volontairement compatible
   * avec l'ancien counting-ai/page.tsx.
   */
  async detectPersons(
    video: HTMLVideoElement
  ): Promise<PersonDetection[]> {
    if (!this.isInitialized || !this.detector) {
      console.warn(
        "⚠️ Le détecteur MediaPipe n'est pas initialisé"
      );

      return [];
    }

    try {
      let timestamp = performance.now();

      /**
       * MediaPipe VIDEO attend des timestamps croissants.
       *
       * Cela évite les problèmes lorsque deux appels arrivent
       * avec le même timestamp.
       */
      if (timestamp <= this.lastTimestamp) {
        timestamp = this.lastTimestamp + 1;
      }

      this.lastTimestamp = timestamp;

      const result = this.detector.detectForVideo(
        video,
        timestamp
      );

      if (!result?.detections?.length) {
        return [];
      }

      return result.detections
        .filter((detection) =>
          this.isPersonDetection(detection)
        )
        .map((detection) =>
          this.convertDetection(detection)
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
   * Vérifie qu'une détection correspond bien à une personne.
   */
  private isPersonDetection(
    detection: Detection
  ): boolean {
    const category = detection.categories?.[0];

    if (!category) {
      return false;
    }

    const categoryName =
      category.categoryName?.toLowerCase();

    const score = category.score ?? 0;

    return (
      categoryName === "person" &&
      score >= this.config.scoreThreshold
    );
  }

  /**
   * Transforme une détection MediaPipe en objet compatible
   * avec le frontend actuel.
   */
  private convertDetection(
    detection: Detection
  ): PersonDetection {
    const bbox = detection.boundingBox;

    const x = bbox?.originX ?? 0;
    const y = bbox?.originY ?? 0;
    const width = bbox?.width ?? 0;
    const height = bbox?.height ?? 0;

    const score =
      detection.categories?.[0]?.score ?? 0;

    const size = width * height;

    const aspectRatio =
      width > 0 ? height / width : 0;

    /**
     * Classification actuelle.
     *
     * IMPORTANT :
     * cette partie reste une HEURISTIQUE afin de conserver
     * le fonctionnement actuel de ton application.
     *
     * Ce n'est pas un modèle IA de reconnaissance du genre.
     *
     * Elle pourra être remplacée plus tard par un véritable
     * modèle de classification sans modifier le contrat
     * utilisé par counting-ai/page.tsx.
     */
    const classification =
      this.estimateCategory(
        size,
        aspectRatio
      );

    return {
      /**
       * Format historique conservé.
       */
      bbox: [x, y, width, height],

      score,

      class: "person",

      gender: classification.gender,

      confidence: classification.confidence,

      size,

      aspectRatio,

      isChild:
        classification.gender === "children",

      isWoman:
        classification.gender === "women",

      isMan:
        classification.gender === "men",
    };
  }

  /**
   * Estimation actuelle de catégorie.
   *
   * Cette méthode est isolée afin de pouvoir être remplacée
   * ultérieurement par un vrai modèle de classification.
   */
  private estimateCategory(
    size: number,
    aspectRatio: number
  ): {
    gender: GenderCategory;
    confidence: number;
  } {
    /**
     * Seuils conservés de l'ancien système pour ne pas
     * changer brutalement le comportement de l'application.
     */
    const CHILD_THRESHOLD = 15000;

    const ADULT_MIN_SIZE = 20000;

    const WOMAN_ASPECT_RATIO = 1.35;

    /**
     * Très petite détection.
     */
    if (size < 8000) {
      return {
        gender: "children",
        confidence: 0.8,
      };
    }

    /**
     * Probablement un enfant.
     */
    if (size < CHILD_THRESHOLD) {
      return {
        gender: "children",
        confidence: 0.7,
      };
    }

    /**
     * Personne très proche de la caméra.
     *
     * On conserve le comportement historique pour
     * éviter de casser le frontend existant.
     */
    if (size > 60000) {
      return {
        gender: "men",
        confidence: 0.8,
      };
    }

    /**
     * Adulte avec grande bounding box.
     */
    if (size > ADULT_MIN_SIZE) {
      if (aspectRatio > WOMAN_ASPECT_RATIO) {
        return {
          gender: "women",
          confidence: 0.65,
        };
      }

      return {
        gender: "men",
        confidence: 0.65,
      };
    }

    /**
     * Zone intermédiaire.
     */
    if (aspectRatio > WOMAN_ASPECT_RATIO) {
      return {
        gender: "women",
        confidence: 0.55,
      };
    }

    return {
      gender: "men",
      confidence: 0.55,
    };
  }

  /**
   * Version simplifiée.
   *
   * Conservée pour ne pas casser les éventuels appels
   * existants dans l'application.
   */
  async detectPersonsSimple(
    video: HTMLVideoElement
  ): Promise<
    Array<{
      bbox: [number, number, number, number];
      score: number;
      class: "person";
    }>
  > {
    if (!this.isInitialized || !this.detector) {
      console.warn(
        "⚠️ Le détecteur MediaPipe n'est pas initialisé"
      );

      return [];
    }

    try {
      let timestamp = performance.now();

      if (timestamp <= this.lastTimestamp) {
        timestamp = this.lastTimestamp + 1;
      }

      this.lastTimestamp = timestamp;

      const result = this.detector.detectForVideo(
        video,
        timestamp
      );

      if (!result?.detections?.length) {
        return [];
      }

      return result.detections
        .filter((detection) =>
          this.isPersonDetection(detection)
        )
        .map((detection) => {
          const bbox = detection.boundingBox;

          return {
            bbox: [
              bbox?.originX ?? 0,
              bbox?.originY ?? 0,
              bbox?.width ?? 0,
              bbox?.height ?? 0,
            ],
            score:
              detection.categories?.[0]?.score ?? 0,
            class: "person" as const,
          };
        });
    } catch (error) {
      console.error(
        "❌ Erreur de détection simple :",
        error
      );

      return [];
    }
  }

  /**
   * Indique si le détecteur est prêt.
   */
  isReady(): boolean {
    return (
      this.isInitialized &&
      this.detector !== null
    );
  }

  /**
   * Retourne la configuration.
   */
  getConfig(): PersonDetectorConfig {
    return {
      ...this.config,
    };
  }

  /**
   * Arrête proprement le détecteur.
   */
  close(): void {
    if (this.detector) {
      this.detector.close();
    }

    this.detector = null;

    this.isInitialized = false;

    this.lastTimestamp = -1;

    console.log("🛑 Détecteur MediaPipe arrêté");
  }
}

/**
 * Instance globale utilisée par l'application.
 */
export const personDetector = new PersonDetector();