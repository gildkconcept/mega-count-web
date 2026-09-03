
export class PersonDetector {
  private detector: any = null;
  private faceDetector: any = null;
  private isInitialized = false;

  async initialize() {
    try {
      console.log('🔄 Initialisation des détecteurs MediaPipe...');
      
      // Importer MediaPipe
      const vision = await import('@mediapipe/tasks-vision');
      const { FilesetResolver, ObjectDetector } = vision;
      
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      
      // Détecteur d'objets (personnes)
      this.detector = await ObjectDetector.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        scoreThreshold: 0.5
      });
      
      this.isInitialized = true;
      console.log('✅ Détecteur MediaPipe initialisé!');
      return true;
    } catch (error) {
      console.error('❌ Erreur d\'initialisation MediaPipe:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Détecter les personnes dans une image avec estimation du genre
   */
  async detectPersons(video: HTMLVideoElement) {
    if (!this.isInitialized || !this.detector) {
      console.log('⚠️ Détecteur non initialisé');
      return [];
    }

    try {
      const detections = this.detector.detectForVideo(video, performance.now());
      
      if (!detections || !detections.detections) {
        return [];
      }

      const persons = detections.detections
        .filter((d: any) => {
          const category = d.categories && d.categories[0];
          return category && category.categoryName === 'person' && category.score > 0.5;
        })
        .map((d: any) => {
          const bbox = d.boundingBox;
          const [x, y, width, height] = [bbox.originX, bbox.originY, bbox.width, bbox.height];
          const score = d.categories[0]?.score || 0;
          
          // ⭐ ESTIMATION DU GENRE BASÉE SUR LA MORPHOLOGIE
          const size = width * height;
          const aspectRatio = height / width;
          
          // Seuils ajustables
          const CHILD_THRESHOLD = 15000;    // Enfants : taille < 15000 pixels²
          const ADULT_MIN_SIZE = 20000;     // Adultes : taille > 20000 pixels²
          const WOMAN_ASPECT_RATIO = 1.35;  // Femmes : ratio hauteur/largeur > 1.35
          
          let gender = 'men';
          let confidence = 0.6;
          
          if (size < CHILD_THRESHOLD) {
            gender = 'children';
            confidence = 0.7;
          } else if (size > ADULT_MIN_SIZE) {
            if (aspectRatio > WOMAN_ASPECT_RATIO) {
              gender = 'women';
              confidence = 0.65;
            } else {
              gender = 'men';
              confidence = 0.65;
            }
          } else {
            if (aspectRatio > WOMAN_ASPECT_RATIO) {
              gender = 'women';
              confidence = 0.55;
            } else {
              gender = 'men';
              confidence = 0.55;
            }
          }
          
          // Ajustement si la personne est très proche (taille très grande)
          if (size > 60000) {
            gender = 'men';
            confidence = 0.8;
          }
          
          // Ajustement si la personne est très petite (probablement enfant)
          if (size < 8000) {
            gender = 'children';
            confidence = 0.8;
          }
          
          return {
            bbox: [x, y, width, height],
            score: score,
            class: 'person',
            gender: gender,
            confidence: confidence,
            size: size,
            aspectRatio: aspectRatio,
            isChild: gender === 'children',
            isWoman: gender === 'women',
            isMan: gender === 'men'
          };
        });

      return persons;
    } catch (error) {
      console.error('❌ Erreur détection:', error);
      return [];
    }
  }

  /**
   * Version simplifiée sans classification de genre
   */
  async detectPersonsSimple(video: HTMLVideoElement) {
    if (!this.isInitialized || !this.detector) {
      return [];
    }

    try {
      const detections = this.detector.detectForVideo(video, performance.now());
      
      if (!detections || !detections.detections) {
        return [];
      }

      return detections.detections
        .filter((d: any) => {
          const category = d.categories && d.categories[0];
          return category && category.categoryName === 'person' && category.score > 0.5;
        })
        .map((d: any) => {
          const bbox = d.boundingBox;
          return {
            bbox: [bbox.originX, bbox.originY, bbox.width, bbox.height],
            score: d.categories[0]?.score || 0,
            class: 'person'
          };
        });
    } catch (error) {
      console.error('Erreur détection:', error);
      return [];
    }
  }

  isReady() {
    return this.isInitialized;
  }
}

export const personDetector = new PersonDetector();