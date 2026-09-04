'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await fetch('https://floors-amino-steel-nine.trycloudflare.com/api/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setSessions(data.data);
      }
    } catch (error) {
      console.error('Erreur chargement sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status: string) => {
    const styles: Record<string, { bg: string; color: string; border: string }> = {
      completed: { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
      started: { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
      validated: { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
      locked: { bg: '#f3f4f6', color: '#4b5563', border: '#e5e7eb' },
      cancelled: { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
      pending_validation: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
      planned: { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' },
      interrupted: { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
      paused: { bg: '#ede9fe', color: '#5b21b6', border: '#ddd6fe' },
    };
    return styles[status] || styles.planned;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      completed: '✅ Terminée',
      started: '🔄 En cours',
      validated: '✔️ Validée',
      locked: '🔒 Verrouillée',
      cancelled: '❌ Annulée',
      pending_validation: '⏳ En attente',
      planned: '📅 Planifiée',
      interrupted: '⏹️ Interrompue',
      paused: '⏸️ Pausée',
    };
    return labels[status] || status;
  };

  if (loading) {
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
          <p style={{ color: '#64748b' }}>Chargement des sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', padding: '24px' }}>
      <div style={{ maxWidth: '896px', margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)',
          borderRadius: '20px',
          padding: '28px 36px',
          marginBottom: '24px',
          color: 'white',
          boxShadow: '0 20px 60px rgba(79,70,229,0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>📊 Mes sessions</h1>
            <p style={{ opacity: 0.85, marginTop: '4px' }}>{sessions.length} session(s) au total</p>
          </div>
          <button
            onClick={() => router.push('/counting')}
            style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '10px 24px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.3s',
              backdropFilter: 'blur(10px)'
            }}
          >
            + Nouveau comptage
          </button>
        </div>

        {sessions.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '48px',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏰</div>
            <p style={{ color: '#475569', fontWeight: '500', fontSize: '18px' }}>Aucune session pour le moment</p>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Commencez votre premier comptage</p>
            <button
              onClick={() => router.push('/counting')}
              style={{
                marginTop: '20px',
                background: '#4f46e5',
                color: 'white',
                padding: '12px 28px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500',
                boxShadow: '0 4px 15px rgba(79,70,229,0.3)'
              }}
            >
              Démarrer un comptage
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sessions.map((session) => {
              const statusStyle = getStatusStyle(session.status);
              return (
                <div
                  key={session.id}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = '#4f46e5';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  onClick={() => router.push(`/sessions/${session.id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#0f172a' }}>
                          {session.session_identifier}
                        </span>
                        <span style={{
                          padding: '4px 14px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: statusStyle.bg,
                          color: statusStyle.color,
                          border: `1px solid ${statusStyle.border}`
                        }}>
                          {getStatusLabel(session.status)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '14px', color: '#64748b' }}>
                        <span>📅 {new Date(session.start_time).toLocaleDateString('fr-FR', { 
                          day: '2-digit', 
                          month: 'long', 
                          year: 'numeric' 
                        })}</span>
                        <span>⏰ {new Date(session.start_time).toLocaleTimeString('fr-FR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}</span>
                        <span>👥 <strong style={{ color: '#0f172a' }}>{session.total_count}</strong> personnes</span>
                        <span style={{ 
                          background: '#f1f5f9', 
                          padding: '2px 10px', 
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#64748b'
                        }}>
                          📱 {session.method === 'auto' ? 'Automatique' : 'Manuel'}
                        </span>
                      </div>
                    </div>
                    <div style={{ 
                      color: '#94a3b8', 
                      fontSize: '20px',
                      padding: '8px',
                      borderRadius: '8px',
                      transition: 'all 0.3s'
                    }}>→</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ 
          marginTop: '40px', 
          textAlign: 'center', 
          color: '#94a3b8', 
          fontSize: '14px', 
          borderTop: '1px solid #e2e8f0', 
          paddingTop: '20px' 
        }}>
          © 2026 MEGA COUNT - Système de comptage d'église v2.0.0
        </div>
      </div>
    </div>
  );
}