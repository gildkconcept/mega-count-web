'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function CountingPage() {
  const router = useRouter();
  const [assemblies, setAssemblies] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [entrances, setEntrances] = useState<any[]>([]);
  const [selectedAssembly, setSelectedAssembly] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedEntrance, setSelectedEntrance] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCounting, setIsCounting] = useState(false);
  const [count, setCount] = useState({ men: 0, women: 0, children: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
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
      console.error('Erreur chargement données:', error);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      setError("Impossible d'accéder à la caméra. Veuillez autoriser l'accès.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  const startSession = async () => {
    if (!selectedAssembly || !selectedService || !selectedEntrance) {
      setError('Veuillez sélectionner une assemblée, un culte et une entrée');
      return;
    }

    setLoading(true);
    setError('');

    try {
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
            device: navigator.userAgent,
            browser: navigator.userAgent,
            os: navigator.platform,
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        setSessionId(data.data.id);
        setIsCounting(true);
        setCount({ men: 0, women: 0, children: 0, total: 0 });
        await startCamera();
      } else {
        setError(data.message || 'Erreur lors du démarrage');
      }
    } catch (err: any) {
      setError('Erreur lors du démarrage');
    } finally {
      setLoading(false);
    }
  };

  const addCount = (type: 'men' | 'women' | 'children') => {
    setCount(prev => {
      const newCount = { ...prev };
      newCount[type] += 1;
      newCount.total += 1;
      return newCount;
    });
  };

  const removeCount = (type: 'men' | 'women' | 'children') => {
    setCount(prev => {
      if (prev[type] === 0) return prev;
      const newCount = { ...prev };
      newCount[type] -= 1;
      newCount.total -= 1;
      return newCount;
    });
  };

  const endSession = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/sessions/${sessionId}/end`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          total_count: count.total,
          men_count: count.men,
          women_count: count.women,
          children_count: count.children
        })
      });

      const data = await response.json();

      if (data.success) {
        stopCamera();
        setIsCounting(false);
        setSessionId(null);
        router.push('/sessions');
      } else {
        setError(data.message || 'Erreur lors de la terminaison');
      }
    } catch (err: any) {
      setError('Erreur lors de la terminaison');
    } finally {
      setLoading(false);
    }
  };

  const cancelSession = () => {
    stopCamera();
    setIsCounting(false);
    setSessionId(null);
    setCount({ men: 0, women: 0, children: 0, total: 0 });
  };

  if (isCounting) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', padding: '16px' }}>
        <div style={{ maxWidth: '896px', margin: '0 auto' }}>
          <div style={{
            position: 'relative',
            background: '#000000',
            borderRadius: '16px',
            overflow: 'hidden',
            aspectRatio: '16/9',
            marginBottom: '16px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
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
            />
            {!cameraActive && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)'
              }}>
                <button
                  onClick={startCamera}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '16px'
                  }}
                >
                  📷 Activer la caméra
                </button>
              </div>
            )}
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: cameraActive ? '#22c55e' : '#ef4444'
              }}></span>
              {cameraActive ? 'Caméra active' : 'Caméra inactive'}
            </div>
            <div style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: '#4f46e5',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}>
              {count.total} personnes
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {['men', 'women', 'children'].map((type) => {
              const labels = { men: 'Hommes', women: 'Femmes', children: 'Enfants' };
              const icons = { men: '👤', women: '👩', children: '👶' };
              const colors = { men: '#3b82f6', women: '#ec4899', children: '#22c55e' };
              const bgColors = { men: '#dbeafe', women: '#fce7f3', children: '#dcfce7' };
              return (
                <div key={type} style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '16px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', color: '#1e293b' }}>
                      <span>{icons[type as keyof typeof icons]}</span>
                      <span>{labels[type as keyof typeof labels]}</span>
                    </div>
                    <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>
                      {count[type as keyof typeof count]}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => removeCount(type as 'men' | 'women' | 'children')}
                      style={{
                        flex: 1,
                        background: '#fee2e2',
                        color: '#dc2626',
                        padding: '8px',
                        borderRadius: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '18px'
                      }}
                    >
                      −
                    </button>
                    <button
                      onClick={() => addCount(type as 'men' | 'women' | 'children')}
                      style={{
                        flex: 1,
                        background: bgColors[type as keyof typeof bgColors],
                        color: colors[type as keyof typeof colors],
                        padding: '8px',
                        borderRadius: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '18px'
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={endSession}
              disabled={loading || count.total === 0}
              style={{
                flex: 1,
                background: '#10b981',
                color: 'white',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                cursor: (loading || count.total === 0) ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: (loading || count.total === 0) ? 0.5 : 1
              }}
            >
              ⏹ {loading ? 'Terminaison...' : 'Terminer le comptage'}
            </button>
            <button
              onClick={cancelSession}
              style={{
                padding: '12px 24px',
                background: '#ef4444',
                color: 'white',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '16px'
              }}
            >
              ❌
            </button>
          </div>

          {error && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '12px',
              color: '#f87171',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '24px' }}>
      <div style={{ maxWidth: '672px', margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          borderRadius: '16px',
          padding: '24px 32px',
          marginBottom: '24px',
          color: 'white',
          boxShadow: '0 4px 15px rgba(79,70,229,0.3)'
        }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>📷 Nouveau comptage</h1>
          <p style={{ opacity: 0.8, marginTop: '4px' }}>Configurez votre session de comptage</p>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Assemblée
            </label>
            <select
              value={selectedAssembly}
              onChange={(e) => {
                setSelectedAssembly(e.target.value);
                setSelectedService('');
                setSelectedEntrance('');
              }}
              className="select"
            >
              <option value="">Sélectionner une assemblée</option>
              {assemblies.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Culte
            </label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="select"
              disabled={!selectedAssembly}
            >
              <option value="">Sélectionner un culte</option>
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
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Entrée
            </label>
            <select
              value={selectedEntrance}
              onChange={(e) => setSelectedEntrance(e.target.value)}
              className="select"
              disabled={!selectedAssembly}
            >
              <option value="">Sélectionner une entrée</option>
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
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#dc2626',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            onClick={startSession}
            disabled={loading || !selectedAssembly || !selectedService || !selectedEntrance}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: 'white',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              cursor: (loading || !selectedAssembly || !selectedService || !selectedEntrance) ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: (loading || !selectedAssembly || !selectedService || !selectedEntrance) ? 0.5 : 1,
              transition: 'all 0.3s',
              boxShadow: '0 4px 15px rgba(79,70,229,0.3)'
            }}
          >
            📷 {loading ? 'Démarrage...' : 'Démarrer le comptage'}
          </button>
        </div>
      </div>
    </div>
  );
}