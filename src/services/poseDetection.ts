import {
  FilesetResolver,
  ObjectDetector,
  PoseLandmarker,
  type Detection,
  type PoseLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

/**
 * Catégories utilisées par le frontend actuel.
 *
 * IMPORTANT :
 * Ces catégories représentent une estimation visuelle basée sur la
 * morphologie générale (taille réelle estimée, proportions épaules/hanches).
 * Elles ne déterminent pas le genre réel d'une personne et restent
 * approximatives, en particulier pour la distinction homme/femme.
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

  /**
   * Identifiant de suivi (tracker), stable d'une frame à l'autre pour
   * une même personne. Utile pour le vote majoritaire et, plus tard,
   * pour éviter le double comptage.
   */
  trackId: number;

  /**
   * Taille réelle estimée de la personne, en centimètres, quand des
   * points de pose ont pu être associés à la détection. `null` si
   * aucune pose n'a pu être appariée à cette bounding box.
   */
  estimatedHeightCm: number | null;
}

export interface CalibrationConfig {
  /**
   * Nombre de pixels correspondant à 1 cm réel, pour la distance
   * caméra "par défaut" (ex : caméra fixe à l'entrée, 3-4m).
   *
   * Comment l'ajuster :
   * 1. Filme une personne de taille connue (ex: 170cm) à la distance
   *    habituelle de la caméra.
   * 2. Mesure sa hauteur en pixels à l'écran (tête -> pieds).
   * 3. pixelsPerCm = hauteur_en_pixels / 170
   *
   * Valeur par défaut estimée pour une webcam standard à ~3.5m,
   * résolution 1280x720 — à recalibrer si les résultats sont décalés.
   */
  pixelsPerCm: number;
}

export interface PersonDetectorConfig {
  scoreThreshold: number;
  maxResults: number;
  delegate: "GPU" | "CPU";
  wasmPath: string;
  modelAssetPath: string;

  /**
   * Modèle MediaPipe Pose (détection multi-personnes des points clés
   * du corps : épaules, hanches, chevilles, tête...).
   */
  poseModelAssetPath: string;

  /**
   * Nombre maximum de squelettes calculés simultanément. Volontairement
   * séparé de `maxResults` (qui concerne l'ObjectDetector) car calculer
   * la pose complète est bien plus coûteux que juste détecter "il y a
   * une personne ici" — une valeur élevée ralentit fortement le temps
   * réel. À ajuster selon l'affluence typique de tes comptages.
   */
  maxPoses: number;

  calibration: CalibrationConfig;

  /**
   * Seuil de taille réelle (en cm) en-dessous duquel une personne est
   * considérée comme un enfant.
   */
  childHeightThresholdCm: number;

  /**
   * Ratio largeur-épaules / largeur-hanches au-dessus duquel une
   * personne est classée "homme", en-dessous "femme". Proche de 1 =
   * ambigu (confiance réduite dans ce cas).
   */
  shoulderHipRatioThreshold: number;

  /**
   * Score de visibilité minimum (0 à 1, fourni par MediaPipe pour
   * chaque point de pose) en-dessous duquel un point n'est pas utilisé
   * pour la classification. Un point avec une visibilité basse est
   * souvent mal placé (occlusion, flou, basse résolution caméra) et
   * fausse le ratio épaules/hanches plus qu'il n'aide.
   */
  minLandmarkVisibility: number;

  tracker: {
    /**
     * IoU minimum pour considérer qu'une détection correspond à une
     * personne déjà suivie d'une frame précédente.
     */
    iouMatchThreshold: number;

    /**
     * Nombre de frames sans détection avant d'abandonner un suivi.
     */
    maxMissedFrames: number;

    /**
     * Nombre de classifications conservées par personne suivie pour
     * le vote majoritaire.
     */
    historyLength: number;
  };
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

  poseModelAssetPath:
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",

  // Valeur volontairement modeste pour rester fluide en temps réel.
  // Augmente-la si tu comptes régulièrement de grands groupes qui
  // arrivent en même temps dans le cadre, en surveillant la fluidité.
  maxPoses: 8,

  calibration: {
    // Valeur par défaut à recalibrer selon l'installation caméra réelle.
    pixelsPerCm: 4.2,
  },

  childHeightThresholdCm: 140,

  shoulderHipRatioThreshold: 1.05,

  minLandmarkVisibility: 0.6,

  tracker: {
    iouMatchThreshold: 0.3,
    maxMissedFrames: 10,
    historyLength: 15,
  },
};

/**
 * Indices des points clés MediaPipe Pose utilisés.
 * (modèle à 33 points ; on n'utilise que ceux nécessaires ici)
 */
const LANDMARK = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

interface BodyMetrics {
  estimatedHeightCm: number | null;
  shoulderHipRatio: number | null;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Personne suivie d'une frame à l'autre, avec historique de
 * classifications pour le vote majoritaire.
 */
interface Track {
  id: number;
  lastBbox: Rect;
  missedFrames: number;
  genderHistory: GenderCategory[];
}

/**
 * Tracker simple par recouvrement (IoU) entre frames successives.
 *
 * Rôle :
 * - associer une détection de la frame courante à une personne déjà
 *   suivie (ou en créer une nouvelle sinon)
 * - lisser la classification homme/femme/enfant sur plusieurs frames
 *   via un vote majoritaire, pour éviter qu'elle change sans arrêt
 *   d'une frame à l'autre
 */
class PersonTracker {
  private tracks: Map<number, Track> = new Map();
  private nextId = 1;

  constructor(
    private iouMatchThreshold: number,
    private maxMissedFrames: number,
    private historyLength: number
  ) {}

  /**
   * Calcule l'IoU (Intersection over Union) entre deux rectangles.
   */
  private computeIoU(a: Rect, b: Rect): number {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.width, b.x + b.width);
    const y2 = Math.min(a.y + a.height, b.y + b.height);

    const intersectionWidth = Math.max(0, x2 - x1);
    const intersectionHeight = Math.max(0, y2 - y1);
    const intersectionArea = intersectionWidth * intersectionHeight;

    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    const unionArea = areaA + areaB - intersectionArea;

    if (unionArea <= 0) return 0;
    return intersectionArea / unionArea;
  }

  /**
   * Retourne, pour une classification instantanée donnée, l'id de
   * suivi associé et la classification finale (après vote majoritaire).
   */
  update(
    bbox: Rect,
    instantGender: GenderCategory
  ): { trackId: number; votedGender: GenderCategory } {
    let bestTrackId: number | null = null;
    let bestIoU = 0;

    for (const track of this.tracks.values()) {
      const iou = this.computeIoU(bbox, track.lastBbox);
      if (iou > bestIoU) {
        bestIoU = iou;
        bestTrackId = track.id;
      }
    }

    let track: Track;

    if (bestTrackId !== null && bestIoU >= this.iouMatchThreshold) {
      track = this.tracks.get(bestTrackId)!;
      track.lastBbox = bbox;
      track.missedFrames = 0;
    } else {
      track = {
        id: this.nextId++,
        lastBbox: bbox,
        missedFrames: 0,
        genderHistory: [],
      };
      this.tracks.set(track.id, track);
    }

    track.genderHistory.push(instantGender);
    if (track.genderHistory.length > this.historyLength) {
      track.genderHistory.shift();
    }

    return {
      trackId: track.id,
      votedGender: this.majorityVote(track.genderHistory),
    };
  }

  /**
   * À appeler une fois par frame, après avoir traité toutes les
   * détections, pour faire vieillir les suivis non retrouvés et
   * nettoyer ceux qui ont disparu depuis trop longtemps.
   */
  pruneStaleTracks(matchedTrackIds: Set<number>): void {
    for (const track of this.tracks.values()) {
      if (!matchedTrackIds.has(track.id)) {
        track.missedFrames++;
        if (track.missedFrames > this.maxMissedFrames) {
          this.tracks.delete(track.id);
        }
      }
    }
  }

  private majorityVote(history: GenderCategory[]): GenderCategory {
    const counts: Record<GenderCategory, number> = {
      men: 0,
      women: 0,
      children: 0,
    };
    for (const g of history) counts[g]++;

    let winner: GenderCategory = history[history.length - 1];
    let winnerCount = -1;
    (Object.keys(counts) as GenderCategory[]).forEach((key) => {
      if (counts[key] > winnerCount) {
        winnerCount = counts[key];
        winner = key;
      }
    });
    return winner;
  }

  reset(): void {
    this.tracks.clear();
    this.nextId = 1;
  }
}

/**
 * Détecteur de personnes.
 *
 * Pipeline de classification :
 * 1. ObjectDetector (EfficientDet) repère les personnes -> bounding boxes
 * 2. PoseLandmarker calcule les points clés du corps pour chaque
 *    personne visible dans la frame
 * 3. Les points de pose sont appariés aux bounding boxes (par
 *    inclusion du centre du buste dans la box)
 * 4. Enfant / adulte : à partir de la taille réelle estimée
 *    (tête -> chevilles, convertie en cm via la calibration caméra)
 * 5. Homme / femme (adultes uniquement) : à partir du ratio largeur
 *    épaules / largeur hanches
 * 6. Un tracker (IoU + vote majoritaire) lisse la classification sur
 *    plusieurs frames pour une même personne
 *
 * Si aucune pose n'a pu être appariée à une détection (occlusion,
 * personne partiellement hors-champ...), on retombe sur l'ancienne
 * heuristique taille/ratio du bounding box brut, en confiance réduite.
 */
export class PersonDetector {
  private detector: ObjectDetector | null = null;
  private poseLandmarker: PoseLandmarker | null = null;

  private isInitialized = false;

  private lastTimestamp = -1;

  private config: PersonDetectorConfig;

  private tracker: PersonTracker;

  constructor(config: Partial<PersonDetectorConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      calibration: {
        ...DEFAULT_CONFIG.calibration,
        ...config.calibration,
      },
      tracker: {
        ...DEFAULT_CONFIG.tracker,
        ...config.tracker,
      },
    };

    this.tracker = new PersonTracker(
      this.config.tracker.iouMatchThreshold,
      this.config.tracker.maxMissedFrames,
      this.config.tracker.historyLength
    );
  }

  /**
   * Initialise MediaPipe (détecteur d'objets + détecteur de pose).
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized && this.detector && this.poseLandmarker) {
      return true;
    }

    try {
      console.log("🔄 Initialisation des détecteurs MediaPipe...");

      const filesetResolver = await FilesetResolver.forVisionTasks(
        this.config.wasmPath
      );

      // Chargement en parallèle des deux modèles (au lieu de l'un
      // après l'autre) pour réduire le délai de démarrage.
      const [detector, poseLandmarker] = await Promise.all([
        ObjectDetector.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: this.config.modelAssetPath,
            delegate: this.config.delegate,
          },
          runningMode: "VIDEO",
          scoreThreshold: this.config.scoreThreshold,
          maxResults: this.config.maxResults,
        }),
        PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: this.config.poseModelAssetPath,
            delegate: this.config.delegate,
          },
          runningMode: "VIDEO",
          numPoses: this.config.maxPoses,
        }),
      ]);

      this.detector = detector;
      this.poseLandmarker = poseLandmarker;

      this.isInitialized = true;
      this.lastTimestamp = -1;
      this.tracker.reset();

      console.log("✅ Détecteurs MediaPipe initialisés (objets + pose)");

      return true;
    } catch (error) {
      console.error("❌ Erreur d'initialisation MediaPipe :", error);

      this.detector = null;
      this.poseLandmarker = null;
      this.isInitialized = false;

      return false;
    }
  }

  /**
   * Détecte les personnes dans une frame vidéo et retourne leur
   * classification (homme/femme/enfant), lissée par le tracker.
   *
   * La structure retournée reste volontairement compatible avec
   * l'ancien counting-ai/page.tsx (champs bbox, score, class, gender,
   * confidence, isChild/isWoman/isMan), avec deux champs en plus :
   * trackId et estimatedHeightCm.
   */
  async detectPersons(video: HTMLVideoElement): Promise<PersonDetection[]> {
    if (!this.isInitialized || !this.detector || !this.poseLandmarker) {
      console.warn("⚠️ Les détecteurs MediaPipe ne sont pas initialisés");
      return [];
    }

    try {
      let timestamp = performance.now();

      // MediaPipe VIDEO attend des timestamps croissants.
      if (timestamp <= this.lastTimestamp) {
        timestamp = this.lastTimestamp + 1;
      }
      this.lastTimestamp = timestamp;

      const objectResult = this.detector.detectForVideo(video, timestamp);
      const poseResult = this.poseLandmarker.detectForVideo(video, timestamp);

      if (!objectResult?.detections?.length) {
        this.tracker.pruneStaleTracks(new Set());
        return [];
      }

      const personDetections = objectResult.detections.filter((d) =>
        this.isPersonDetection(d)
      );

      const matchedTrackIds = new Set<number>();

      const results = personDetections.map((detection) => {
        const { converted, trackId } = this.convertDetection(
          detection,
          poseResult,
          video
        );
        matchedTrackIds.add(trackId);
        return converted;
      });

      this.tracker.pruneStaleTracks(matchedTrackIds);

      return results;
    } catch (error) {
      console.error("❌ Erreur pendant la détection :", error);
      return [];
    }
  }

  /**
   * Vérifie qu'une détection correspond bien à une personne.
   */
  private isPersonDetection(detection: Detection): boolean {
    const category = detection.categories?.[0];
    if (!category) return false;

    const categoryName = category.categoryName?.toLowerCase();
    const score = category.score ?? 0;

    return categoryName === "person" && score >= this.config.scoreThreshold;
  }

  /**
   * Trouve, parmi toutes les poses détectées dans la frame, celle dont
   * le buste (milieu épaules/hanches) tombe à l'intérieur de la
   * bounding box donnée. Retourne `null` si aucune ne correspond.
   */
  private matchPoseToBbox(
    bbox: Rect,
    poseResult: PoseLandmarkerResult,
    videoWidth: number,
    videoHeight: number
  ): NormalizedLandmark[] | null {
    if (!poseResult?.landmarks?.length) return null;

    for (const landmarks of poseResult.landmarks) {
      const leftShoulder = landmarks[LANDMARK.LEFT_SHOULDER];
      const rightShoulder = landmarks[LANDMARK.RIGHT_SHOULDER];
      const leftHip = landmarks[LANDMARK.LEFT_HIP];
      const rightHip = landmarks[LANDMARK.RIGHT_HIP];

      if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) continue;

      const centerX =
        ((leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4) *
        videoWidth;
      const centerY =
        ((leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4) *
        videoHeight;

      const insideBbox =
        centerX >= bbox.x &&
        centerX <= bbox.x + bbox.width &&
        centerY >= bbox.y &&
        centerY <= bbox.y + bbox.height;

      if (insideBbox) return landmarks;
    }

    return null;
  }

  /**
   * Vérifie qu'un point de pose est suffisamment fiable pour être
   * utilisé dans un calcul. `visibility` est `undefined` sur certains
   * modèles/versions — dans ce cas on considère le point utilisable
   * par défaut (on ne pénalise pas l'absence du champ lui-même).
   */
  private isLandmarkReliable(landmark: NormalizedLandmark | undefined): boolean {
    if (!landmark) return false;
    if (landmark.visibility === undefined) return true;
    return landmark.visibility >= this.config.minLandmarkVisibility;
  }

  /**
   * Calcule la taille réelle estimée (cm) et le ratio épaules/hanches
   * à partir des points de pose d'une personne. Les points dont la
   * visibilité est insuffisante sont écartés plutôt qu'utilisés tels
   * quels — mieux vaut une métrique absente (repli sur l'heuristique
   * bounding box) qu'une métrique calculée sur des points mal placés.
   */
  private computeBodyMetrics(
    landmarks: NormalizedLandmark[],
    videoWidth: number,
    videoHeight: number
  ): BodyMetrics {
    const nose = landmarks[LANDMARK.NOSE];
    const leftAnkle = landmarks[LANDMARK.LEFT_ANKLE];
    const rightAnkle = landmarks[LANDMARK.RIGHT_ANKLE];
    const leftShoulder = landmarks[LANDMARK.LEFT_SHOULDER];
    const rightShoulder = landmarks[LANDMARK.RIGHT_SHOULDER];
    const leftHip = landmarks[LANDMARK.LEFT_HIP];
    const rightHip = landmarks[LANDMARK.RIGHT_HIP];

    const reliableNose = this.isLandmarkReliable(nose) ? nose : undefined;
    const reliableLeftAnkle = this.isLandmarkReliable(leftAnkle)
      ? leftAnkle
      : undefined;
    const reliableRightAnkle = this.isLandmarkReliable(rightAnkle)
      ? rightAnkle
      : undefined;
    const reliableLeftShoulder = this.isLandmarkReliable(leftShoulder)
      ? leftShoulder
      : undefined;
    const reliableRightShoulder = this.isLandmarkReliable(rightShoulder)
      ? rightShoulder
      : undefined;
    const reliableLeftHip = this.isLandmarkReliable(leftHip)
      ? leftHip
      : undefined;
    const reliableRightHip = this.isLandmarkReliable(rightHip)
      ? rightHip
      : undefined;

    let estimatedHeightCm: number | null = null;

    if (reliableNose && (reliableLeftAnkle || reliableRightAnkle)) {
      const ankleY =
        reliableLeftAnkle && reliableRightAnkle
          ? (reliableLeftAnkle.y + reliableRightAnkle.y) / 2
          : (reliableLeftAnkle ?? reliableRightAnkle)!.y;

      const pixelHeight = Math.abs(ankleY - reliableNose.y) * videoHeight;
      estimatedHeightCm =
        pixelHeight / this.config.calibration.pixelsPerCm;
    }

    let shoulderHipRatio: number | null = null;

    // Les 4 points (épaules + hanches) doivent TOUS être fiables pour
    // calculer le ratio — un seul point mal placé suffit à fausser
    // significativement le résultat.
    if (
      reliableLeftShoulder &&
      reliableRightShoulder &&
      reliableLeftHip &&
      reliableRightHip
    ) {
      const shoulderWidth =
        Math.abs(reliableLeftShoulder.x - reliableRightShoulder.x) *
        videoWidth;
      const hipWidth =
        Math.abs(reliableLeftHip.x - reliableRightHip.x) * videoWidth;

      if (hipWidth > 0) {
        shoulderHipRatio = shoulderWidth / hipWidth;
      }
    }

    return { estimatedHeightCm, shoulderHipRatio };
  }

  /**
   * Transforme une détection MediaPipe (+ pose associée si trouvée)
   * en objet compatible avec le frontend actuel, et le fait passer
   * par le tracker pour le lissage multi-frames.
   */
  private convertDetection(
    detection: Detection,
    poseResult: PoseLandmarkerResult,
    video: HTMLVideoElement
  ): { converted: PersonDetection; trackId: number } {
    const bboxRaw = detection.boundingBox;

    const x = bboxRaw?.originX ?? 0;
    const y = bboxRaw?.originY ?? 0;
    const width = bboxRaw?.width ?? 0;
    const height = bboxRaw?.height ?? 0;

    const score = detection.categories?.[0]?.score ?? 0;
    const size = width * height;
    const aspectRatio = width > 0 ? height / width : 0;

    const bboxRect: Rect = { x, y, width, height };

    const matchedPose = this.matchPoseToBbox(
      bboxRect,
      poseResult,
      video.videoWidth,
      video.videoHeight
    );

    let classification: { gender: GenderCategory; confidence: number };
    let estimatedHeightCm: number | null = null;

    if (matchedPose) {
      const metrics = this.computeBodyMetrics(
        matchedPose,
        video.videoWidth,
        video.videoHeight
      );
      estimatedHeightCm = metrics.estimatedHeightCm;

      classification = this.classifyFromBodyMetrics(
        metrics,
        size,
        aspectRatio
      );
    } else {
      // Repli sur l'ancienne heuristique si aucune pose n'a pu être
      // appariée à cette détection (confiance réduite).
      classification = this.classifyFromBoundingBox(size, aspectRatio);
    }

    const { trackId, votedGender } = this.tracker.update(
      bboxRect,
      classification.gender
    );

    const converted: PersonDetection = {
      bbox: [x, y, width, height],
      score,
      class: "person",
      gender: votedGender,
      confidence: classification.confidence,
      size,
      aspectRatio,
      isChild: votedGender === "children",
      isWoman: votedGender === "women",
      isMan: votedGender === "men",
      trackId,
      estimatedHeightCm,
    };

    return { converted, trackId };
  }

  /**
   * Classification principale : taille réelle (enfant/adulte) puis,
   * pour les adultes, ratio épaules/hanches (homme/femme). Si le
   * ratio n'a pas pu être calculé (points filtrés pour manque de
   * fiabilité), on retombe sur l'heuristique bounding box — c'est un
   * signal moins bon, mais plus fiable qu'un défaut arbitraire.
   */
  private classifyFromBodyMetrics(
    metrics: BodyMetrics,
    bboxSize: number,
    bboxAspectRatio: number
  ): {
    gender: GenderCategory;
    confidence: number;
  } {
    if (metrics.estimatedHeightCm !== null) {
      if (metrics.estimatedHeightCm < this.config.childHeightThresholdCm) {
        return { gender: "children", confidence: 0.75 };
      }
    }

    if (metrics.shoulderHipRatio !== null) {
      const ratio = metrics.shoulderHipRatio;
      const threshold = this.config.shoulderHipRatioThreshold;

      // Plus on s'éloigne du seuil, plus la confiance augmente
      // (proche de 1 = ambigu, on réduit la confiance).
      const distanceFromThreshold = Math.abs(ratio - threshold);
      const confidence = Math.min(0.75, 0.5 + distanceFromThreshold);

      if (ratio > threshold) {
        return { gender: "men", confidence };
      }
      return { gender: "women", confidence };
    }

    // Taille exploitable (donc adulte confirmé) mais ratio épaules/
    // hanches non disponible : on retombe sur l'heuristique bounding
    // box plutôt que de deviner "homme" par défaut.
    return this.classifyFromBoundingBox(bboxSize, bboxAspectRatio);
  }

  /**
   * Ancienne heuristique (taille/ratio du bounding box brut), utilisée
   * uniquement en repli quand aucune pose n'a pu être appariée à la
   * détection. Confiance volontairement plafonnée plus bas que la
   * classification par pose.
   */
  private classifyFromBoundingBox(
    size: number,
    aspectRatio: number
  ): { gender: GenderCategory; confidence: number } {
    const CHILD_THRESHOLD = 15000;
    const ADULT_MIN_SIZE = 20000;
    const WOMAN_ASPECT_RATIO = 1.35;

    if (size < 8000) {
      return { gender: "children", confidence: 0.5 };
    }
    if (size < CHILD_THRESHOLD) {
      return { gender: "children", confidence: 0.45 };
    }
    if (size > 60000) {
      return { gender: "men", confidence: 0.5 };
    }
    if (size > ADULT_MIN_SIZE) {
      if (aspectRatio > WOMAN_ASPECT_RATIO) {
        return { gender: "women", confidence: 0.4 };
      }
      return { gender: "men", confidence: 0.4 };
    }
    if (aspectRatio > WOMAN_ASPECT_RATIO) {
      return { gender: "women", confidence: 0.35 };
    }
    return { gender: "men", confidence: 0.35 };
  }

  /**
   * Version simplifiée.
   *
   * Conservée pour ne pas casser les éventuels appels existants dans
   * l'application.
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
      console.warn("⚠️ Le détecteur MediaPipe n'est pas initialisé");
      return [];
    }

    try {
      let timestamp = performance.now();
      if (timestamp <= this.lastTimestamp) {
        timestamp = this.lastTimestamp + 1;
      }
      this.lastTimestamp = timestamp;

      const result = this.detector.detectForVideo(video, timestamp);

      if (!result?.detections?.length) return [];

      return result.detections
        .filter((detection) => this.isPersonDetection(detection))
        .map((detection) => {
          const bbox = detection.boundingBox;
          return {
            bbox: [
              bbox?.originX ?? 0,
              bbox?.originY ?? 0,
              bbox?.width ?? 0,
              bbox?.height ?? 0,
            ] as [number, number, number, number],
            score: detection.categories?.[0]?.score ?? 0,
            class: "person" as const,
          };
        });
    } catch (error) {
      console.error("❌ Erreur de détection simple :", error);
      return [];
    }
  }

  /**
   * Indique si le détecteur est prêt.
   */
  isReady(): boolean {
    return (
      this.isInitialized &&
      this.detector !== null &&
      this.poseLandmarker !== null
    );
  }

  /**
   * Retourne la configuration.
   */
  getConfig(): PersonDetectorConfig {
    return { ...this.config };
  }

  /**
   * Met à jour la calibration caméra (pixels par cm) sans réinitialiser
   * les modèles MediaPipe.
   */
  setCalibration(pixelsPerCm: number): void {
    this.config.calibration.pixelsPerCm = pixelsPerCm;
  }

  /**
   * Arrête proprement les détecteurs.
   */
  close(): void {
    if (this.detector) {
      this.detector.close();
    }
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
    }

    this.detector = null;
    this.poseLandmarker = null;
    this.isInitialized = false;
    this.lastTimestamp = -1;
    this.tracker.reset();

    console.log("🛑 Détecteurs MediaPipe arrêtés");
  }
}

/**
 * Instance globale utilisée par l'application.
 */
export const personDetector = new PersonDetector();