'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { personDetector } from '../../../services/poseDetection';

// Configuration
const DETECTION_INTERVAL_MS = 300;
const TRACK_MAX_AGE_MS = 1000;
const IOU_THRESHOLD = 0.3;

interface Track {
  id: string;
  bbox: number[];
  hits: number;
  counted: boolean;
  gender: 'men' | 'women' | 'children';
  lastSeen: number;
}

export default function CountingAIPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isModelReady, setIsModelReady] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [count, setCount] = useState(0);
  const [menCount, setMenCount] = useState(0);
  const [womenCount, setWomenCount] = useState(0);
  const [childrenCount, setChildrenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [fps, setFps] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const [selectedAssembly, setSelectedAssembly] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedEntrance, setSelectedEntrance] = useState('');
  const [assemblies, setAssemblies] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [entrances, setEntrances] = useState<any[]>([]);

  const countRef = useRef(0);
  const menCountRef = useRef(0);
  const womenCountRef = useRef(0);
  const childrenCountRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>();
  const tracksRef = useRef<Map<string, Track>>(new Map());
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());
  const isCountingRef = useRef(false);
  const lastDetectionAtRef = useRef(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth < 768);
    }
    
    initializeAI();
    loadData();

    return () => {
      stopCamera();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const initializeAI = async () => {
    try {
      setLoading(true);
      console.log('🔄 Initialisation de MediaPipe...');
      const success = await personDetector.initialize();
      if (success) {
        setIsModelReady(true);
        console.log('✅ MediaPipe prêt!');
      } else {
        setError('Erreur d\'initialisation de MediaPipe');
      }
    } catch (err) {
      console.error('❌ Erreur:', err);
      setError('Erreur de chargement du modèle');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [assembliesRes, servicesRes, entrancesRes] = await Promise.all([
        fetch('http://localhost:3001/api/assemblies', {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()),
        fetch('http://localhost:3001/api/services', {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()),
        fetch('http://localhost:3001/api/entrances', {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json())
      ]);

      if (assembliesRes.success) setAssemblies(assembliesRes.data);
      if (servicesRes.success) setServices(servicesRes.data);
      if (entrancesRes.success) setEntrances(entrancesRes.data);
    } catch (error) {
      console.error('Erreur chargement:', error);
    }
  };

  const checkAndEndActiveSession = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3001/api/sessions?entrance_id=${selectedEntrance}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();

      if (!data.success) return false;

      const activeStatuses = ['started', 'in_progress'];
      const activeSessions = (data.data || []).filter((s: any) => activeStatuses.includes(s.status));

      for (const session of activeSessions) {
        await fetch(
          `http://localhost:3001/api/sessions/${session.id}/end`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              total_count: session.total_count || 0,
              status: 'interrupted'
            })
          }
        );
      }
      return true;
    } catch (error) {
      console.error('❌ Erreur:', error);
      return false;
    }
  };

  const startCamera = async () => {
    try {
      const isMobile = window.innerWidth < 768;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: isMobile ? 360 : 480 },
          height: { ideal: isMobile ? 480 : 640 },
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('❌ Erreur caméra:', err);
      setError('Impossible d\'accéder à la caméra');
      return false;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const calculateIoU = (box1: number[], box2: number[]): number => {
    const [x1, y1, w1, h1] = box1;
    const [x2, y2, w2, h2] = box2;
    
    const xLeft = Math.max(x1, x2);
    const yTop = Math.max(y1, y2);
    const xRight = Math.min(x1 + w1, x2 + w2);
    const yBottom = Math.min(y1 + h1, y2 + h2);
    
    if (xRight < xLeft || yBottom < yTop) return 0;
    
    const intersection = (xRight - xLeft) * (yBottom - yTop);
    const area1 = w1 * h1;
    const area2 = w2 * h2;
    const union = area1 + area2 - intersection;
    
    return intersection / union;
  };

  const findBestMatch = (bbox: number[], tracks: Map<string, Track>): string | null => {
    let bestId: string | null = null;
    let bestIoU = 0;

    for (const [id, track] of tracks) {
      const iou = calculateIoU(bbox, track.bbox);
      if (iou > bestIoU && iou > IOU_THRESHOLD) {
        bestIoU = iou;
        bestId = id;
      }
    }

    return bestId;
  };

  const detectAndCount = async () => {
    if (!isCountingRef.current || !videoRef.current || !personDetector.isReady()) {
      animationRef.current = requestAnimationFrame(detectAndCount);
      return;
    }

    try {
      const video = videoRef.current;
      if (!video || video.readyState !== 4) {
        animationRef.current = requestAnimationFrame(detectAndCount);
        return;
      }

      const now = Date.now();

      if (now - lastDetectionAtRef.current >= DETECTION_INTERVAL_MS) {
        lastDetectionAtRef.current = now;

        try {
          const persons = await personDetector.detectPersons(video);
          const tracks = tracksRef.current;
          const matchedIds = new Set<string>();

          console.log(`📊 ${persons.length} personnes détectées`);

          for (const person of persons) {
            const matchId = findBestMatch(person.bbox, tracks);
            
            if (matchId) {
              matchedIds.add(matchId);
              const track = tracks.get(matchId)!;
              track.bbox = person.bbox;
              track.hits++;
              track.lastSeen = now;

              if (!track.counted && track.hits >= 2) {
                track.counted = true;
                
                if (person.gender === 'men') {
                  menCountRef.current++;
                  setMenCount(menCountRef.current);
                } else if (person.gender === 'women') {
                  womenCountRef.current++;
                  setWomenCount(womenCountRef.current);
                } else {
                  childrenCountRef.current++;
                  setChildrenCount(childrenCountRef.current);
                }
                
                countRef.current++;
                setCount(countRef.current);
                
                console.log(`✅ Personne comptée! Total: ${countRef.current} (👨 ${menCountRef.current}, 👩 ${womenCountRef.current}, 👶 ${childrenCountRef.current})`);
              }
            }
          }

          for (const person of persons) {
            const matchId = findBestMatch(person.bbox, tracks);
            if (!matchId) {
              const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              tracks.set(id, {
                id,
                bbox: person.bbox,
                hits: 1,
                counted: false,
                gender: person.gender || 'men',
                lastSeen: now
              });
            }
          }

          for (const [id, track] of tracks) {
            if (now - track.lastSeen > TRACK_MAX_AGE_MS) {
              tracks.delete(id);
            }
          }

        } catch (err) {
          console.error('❌ Erreur détection async:', err);
        }
      }

      drawFrame(video);

      frameCountRef.current++;
      const nowMs = Date.now();
      if (nowMs - lastFpsUpdateRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = nowMs;
      }

      animationRef.current = requestAnimationFrame(detectAndCount);
    } catch (error) {
      console.error('❌ Erreur détection:', error);
      animationRef.current = requestAnimationFrame(detectAndCount);
    }
  };

  const drawFrame = (video: HTMLVideoElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.drawImage(video, 0, 0);

    const tracks = tracksRef.current;
    for (const [id, track] of tracks) {
      // ⭐ VÉRIFICATION DE SECURITE pour éviter les erreurs
      const bbox = track.bbox || [0, 0, 0, 0];
      const [x, y, w, h] = bbox;
      
      let color = '#facc15';
      if (track.gender === 'men') color = '#3b82f6';
      else if (track.gender === 'women') color = '#ec4899';
      else if (track.gender === 'children') color = '#22c55e';
      
      const label = track.counted ? '✅' : '⏳';
      
      ctx.strokeStyle = color;
      ctx.lineWidth = isMobile ? 3 : 2;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y - 24, 28, 20);
      
      ctx.fillStyle = color;
      ctx.font = isMobile ? '14px Arial' : '12px Arial';
      ctx.fillText(label, x + 4, y - 7);
    }

    // Compteur
    const counterFontSize = isMobile ? 28 : 24;
    
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath();
    ctx.roundRect(canvas.width - 200, 16, 185, 110, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('COMPTAGE', canvas.width - 107, 34);
    
    ctx.fillStyle = '#4ade80';
    ctx.font = `bold ${counterFontSize}px Arial`;
    ctx.fillText(`${countRef.current}`, canvas.width - 107, 62);
    
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(`👨 ${menCountRef.current}`, canvas.width - 185, 82);
    ctx.fillStyle = '#ec4899';
    ctx.fillText(`👩 ${womenCountRef.current}`, canvas.width - 140, 82);
    ctx.fillStyle = '#22c55e';
    ctx.fillText(`👶 ${childrenCountRef.current}`, canvas.width - 95, 82);
    ctx.textAlign = 'left';

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(12, 12, 60, 22, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = isMobile ? '11px Arial' : '10px Arial';
    ctx.fillText(`⚡ ${fps}`, 18, 28);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(12, canvas.height - 28, isMobile ? 140 : 160, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = isMobile ? '11px Arial' : '10px Arial';
    ctx.fillText(`👥 ${tracks.size} personnes`, 18, canvas.height - 13);
  };

  // ⭐ Vérification de roundRect
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
      if (r > w/2) r = w/2;
      if (r > h/2) r = h/2;
      this.beginPath();
      this.moveTo(x + r, y);
      this.lineTo(x + w - r, y);
      this.quadraticCurveTo(x + w, y, x + w, y + r);
      this.lineTo(x + w, y + h - r);
      this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      this.lineTo(x + r, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - r);
      this.lineTo(x, y + r);
      this.quadraticCurveTo(x, y, x + r, y);
      this.closePath();
      return this;
    };
  }

  const startCounting = async () => {
    if (!selectedAssembly || !selectedService || !selectedEntrance) {
      setError('Veuillez sélectionner toutes les options');
      return;
    }

    if (!isModelReady) {
      setError('Modèle non chargé');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

      await checkAndEndActiveSession();

      const response = await fetch('http://localhost:3001/api/sessions/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assembly_id: selectedAssembly,
          worship_service_id: selectedService,
          entrance_id: selectedEntrance,
          method: 'auto',
          device_info: {
            device: navigator.userAgent || 'unknown',
            ai_model: 'COCO-SSD',
            type: 'automatic_counting_with_gender'
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        setSessionId(data.data.id);
        isCountingRef.current = true;
        setIsCounting(true);
        countRef.current = 0;
        menCountRef.current = 0;
        womenCountRef.current = 0;
        childrenCountRef.current = 0;
        setCount(0);
        setMenCount(0);
        setWomenCount(0);
        setChildrenCount(0);
        tracksRef.current.clear();

        await startCamera();

        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }

        console.log('🚀 Comptage démarré!');
        setTimeout(() => {
          detectAndCount();
        }, 500);
      } else {
        setError(data.message || 'Erreur de démarrage');
      }
    } catch (err: any) {
      console.error('❌ Erreur détaillée:', err);
      setError('Erreur: ' + (err.message || 'Inconnue'));
    } finally {
      setLoading(false);
    }
  };

  const stopCounting = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const finalCount = countRef.current;

      const response = await fetch(`http://localhost:3001/api/sessions/${sessionId}/end`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          total_count: finalCount,
          men_count: menCountRef.current,
          women_count: womenCountRef.current,
          children_count: childrenCountRef.current
        })
      });

      const data = await response.json();

      if (data.success) {
        stopCamera();
        isCountingRef.current = false;
        setIsCounting(false);
        setSessionId(null);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        console.log(`📊 Session terminée: ${finalCount} personnes (👨 ${menCountRef.current}, 👩 ${womenCountRef.current}, 👶 ${childrenCountRef.current})`);
        router.push('/sessions');
      } else {
        setError(data.message || 'Erreur de terminaison');
      }
    } catch (err: any) {
      console.error('❌ Erreur terminaison:', err);
      setError('Erreur de terminaison');
    } finally {
      setLoading(false);
    }
  };

  const cancelCounting = () => {
    stopCamera();
    isCountingRef.current = false;
    setIsCounting(false);
    setSessionId(null);
    countRef.current = 0;
    menCountRef.current = 0;
    womenCountRef.current = 0;
    childrenCountRef.current = 0;
    setCount(0);
    setMenCount(0);
    setWomenCount(0);
    setChildrenCount(0);
    tracksRef.current.clear();
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  if (loading && !isModelReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin" style={{
            width: '48px',
            height: '48px',
            border: '4px solid #4f46e5',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#64748b' }}>Chargement du modèle...</p>
        </div>
      </div>
    );
  }

  if (isCounting) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#0f172a',
        padding: isMobile ? 0 : '16px',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}>
        <div style={{ 
          maxWidth: '1280px', 
          margin: '0 auto',
          height: '100%',
          width: '100%',
        }}>
          <div style={{
            position: 'relative',
            background: '#000',
            borderRadius: isMobile ? 0 : '16px',
            overflow: 'hidden',
            height: isMobile ? '100%' : '100%',
            aspectRatio: isMobile ? 'auto' : '4/3',
          }}>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)'
              }}
              playsInline
              autoPlay
              muted
            />
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                position: 'absolute',
                top: 0,
                left: 0
              }}
            />

            {!cameraActive && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'white',
                textAlign: 'center',
                zIndex: 5,
              }}>
                <div className="animate-spin" style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #4f46e5',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  margin: '0 auto 16px'
                }}></div>
                <p style={{ fontSize: isMobile ? '16px' : '18px' }}>Activation de la caméra...</p>
              </div>
            )}

            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: isMobile ? '16px' : '12px',
              zIndex: 10,
              width: isMobile ? '90%' : 'auto',
              justifyContent: 'center',
            }}>
              <button
                onClick={stopCounting}
                disabled={loading}
                style={{
                  padding: isMobile ? '16px 24px' : '12px 24px',
                  background: '#10b981',
                  color: 'white',
                  borderRadius: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: isMobile ? '18px' : '16px',
                  opacity: loading ? 0.5 : 1,
                  minHeight: isMobile ? '56px' : '48px',
                  flex: isMobile ? 1 : 'none',
                }}
              >
                ⏹ Terminer
              </button>
              <button
                onClick={cancelCounting}
                style={{
                  padding: isMobile ? '16px 24px' : '12px 24px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: isMobile ? '18px' : '16px',
                  minHeight: isMobile ? '56px' : '48px',
                  flex: isMobile ? 1 : 'none',
                }}
              >
                ❌ Annuler
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: 'rgba(239,68,68,0.1)',
              borderRadius: '12px',
              color: '#f87171',
              position: isMobile ? 'absolute' : 'relative',
              bottom: isMobile ? '100px' : 'auto',
              left: isMobile ? '16px' : 'auto',
              right: isMobile ? '16px' : 'auto',
              zIndex: 20,
              backdropFilter: 'blur(8px)',
              background: 'rgba(239,68,68,0.2)',
              border: '1px solid rgba(239,68,68,0.3)',
              textAlign: 'center',
              fontSize: isMobile ? '14px' : '16px',
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f1f5f9', 
      padding: isMobile ? '16px' : '24px',
      paddingBottom: isMobile ? '80px' : '24px',
    }}>
      <div style={{ maxWidth: '672px', margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          borderRadius: '16px',
          padding: isMobile ? '20px' : '24px',
          color: 'white',
          marginBottom: '16px',
        }}>
          <h1 style={{ 
            fontSize: isMobile ? '22px' : '28px', 
            fontWeight: 'bold',
            textAlign: isMobile ? 'center' : 'left',
          }}>
            🤖 Comptage Automatique
          </h1>
          <p style={{ 
            opacity: 0.8, 
            marginTop: '4px',
            fontSize: isMobile ? '14px' : '16px',
            textAlign: isMobile ? 'center' : 'left',
          }}>
            Détection en temps réel avec distinction Hommes/Femmes/Enfants
            {isModelReady && <span style={{ 
              marginLeft: '12px', 
              fontSize: '14px', 
              background: 'rgba(255,255,255,0.2)', 
              padding: '2px 12px', 
              borderRadius: '12px' 
            }}>✅ Modèle chargé</span>}
          </p>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: isMobile ? '16px' : '24px',
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: isMobile ? '16px' : '14px', 
              fontWeight: '600', 
              color: '#334155', 
              marginBottom: '6px' 
            }}>
              Assemblée
            </label>
            <select
              value={selectedAssembly}
              onChange={(e) => setSelectedAssembly(e.target.value)}
              className="select"
              style={{
                fontSize: isMobile ? '16px' : '14px',
                padding: isMobile ? '14px 16px' : '12px 16px',
              }}
            >
              <option value="">Sélectionner</option>
              {assemblies.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: isMobile ? '16px' : '14px', 
              fontWeight: '600', 
              color: '#334155', 
              marginBottom: '6px' 
            }}>
              Culte
            </label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="select"
              disabled={!selectedAssembly}
              style={{
                fontSize: isMobile ? '16px' : '14px',
                padding: isMobile ? '14px 16px' : '12px 16px',
              }}
            >
              <option value="">Sélectionner</option>
              {services
                .filter((s: any) => s.assembly_id === selectedAssembly)
                .map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.title} - {new Date(s.date).toLocaleDateString()}
                  </option>
                ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: isMobile ? '16px' : '14px', 
              fontWeight: '600', 
              color: '#334155', 
              marginBottom: '6px' 
            }}>
              Entrée
            </label>
            <select
              value={selectedEntrance}
              onChange={(e) => setSelectedEntrance(e.target.value)}
              className="select"
              disabled={!selectedAssembly}
              style={{
                fontSize: isMobile ? '16px' : '14px',
                padding: isMobile ? '14px 16px' : '12px 16px',
              }}
            >
              <option value="">Sélectionner</option>
              {entrances
                .filter((e: any) => e.assembly_id === selectedAssembly)
                .map((e: any) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
            </select>
          </div>

          {error && (
            <div style={{
              padding: '12px',
              background: '#fee2e2',
              borderRadius: '8px',
              color: '#dc2626',
              marginBottom: '16px',
              fontSize: isMobile ? '15px' : '14px',
            }}>
              {error}
            </div>
          )}

          <button
            onClick={startCounting}
            disabled={loading || !selectedAssembly || !selectedService || !selectedEntrance || !isModelReady}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: 'white',
              padding: isMobile ? '18px' : '14px',
              borderRadius: '14px',
              border: 'none',
              cursor: (loading || !selectedAssembly || !selectedService || !selectedEntrance || !isModelReady) ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: isMobile ? '18px' : '16px',
              opacity: (loading || !selectedAssembly || !selectedService || !selectedEntrance || !isModelReady) ? 0.5 : 1,
              minHeight: isMobile ? '56px' : '48px',
            }}
          >
            🤖 {loading ? 'Démarrage...' : 'Démarrer le comptage'}
          </button>

          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: '#f8fafc',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '12px',
            color: '#64748b',
          }}>
            <p>📌 <strong>Comment ça marche :</strong></p>
            <ul style={{ marginTop: '8px', paddingLeft: '20px', listStyle: 'disc' }}>
              <li>👨 <span style={{ color: '#3b82f6' }}>Hommes</span> - Détectés automatiquement</li>
              <li>👩 <span style={{ color: '#ec4899' }}>Femmes</span> - Détectées automatiquement</li>
              <li>👶 <span style={{ color: '#22c55e' }}>Enfants</span> - Détectés automatiquement</li>
              <li>✅ Chaque personne est comptée <strong>une seule fois</strong></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}