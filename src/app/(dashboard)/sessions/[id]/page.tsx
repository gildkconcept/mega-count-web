'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function SessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;
  
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/sessions/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setSession(data.data);
      } else {
        setError('Session non trouvée');
      }
    } catch (error) {
      console.error('Erreur chargement session:', error);
      setError('Erreur lors du chargement de la session');
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
          <p style={{ color: '#64748b' }}>Chargement de la session...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😕</div>
          <p style={{ color: '#64748b', fontSize: '18px' }}>{error || 'Session non trouvée'}</p>
          <button
            onClick={() => router.push('/sessions')}
            style={{
              marginTop: '16px',
              padding: '10px 24px',
              background: '#4f46e5',
              color: 'white',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Retour aux sessions
          </button>
        </div>
      </div>
    );
  }

  const statusStyle = getStatusStyle(session.status);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', padding: '24px' }}>
      <div style={{ maxWidth: '896px', margin: '0 auto' }}>
        {/* En-tête */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>{session.session_identifier}</h1>
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
            <p style={{ opacity: 0.85, marginTop: '4px', fontSize: '14px' }}>
              {session.assembly_name} • {session.entrance_name}
            </p>
          </div>
          <button
            onClick={() => router.push('/sessions')}
            style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '8px 20px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.3s'
            }}
          >
            ← Retour
          </button>
        </div>

        {/* Statistiques */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a' }}>{session.total_count}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Hommes</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>{session.men_count || 0}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Femmes</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ec4899' }}>{session.women_count || 0}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Enfants</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#22c55e' }}>{session.children_count || 0}</div>
          </div>
        </div>

        {/* Détails */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '16px' }}>📋 Détails de la session</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Assemblée</div>
              <div style={{ fontWeight: '500', color: '#0f172a' }}>{session.assembly_name}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Entrée</div>
              <div style={{ fontWeight: '500', color: '#0f172a' }}>{session.entrance_name}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Culte</div>
              <div style={{ fontWeight: '500', color: '#0f172a' }}>{session.service_title || 'N/A'}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Méthode</div>
              <div style={{ fontWeight: '500', color: '#0f172a', textTransform: 'capitalize' }}>{session.method}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Début</div>
              <div style={{ fontWeight: '500', color: '#0f172a' }}>{formatDate(session.start_time)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Fin</div>
              <div style={{ fontWeight: '500', color: '#0f172a' }}>
                {session.end_time ? formatDate(session.end_time) : 'En cours'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Durée</div>
              <div style={{ fontWeight: '500', color: '#0f172a' }}>
                {session.duration ? `${Math.floor(session.duration / 60)}m ${session.duration % 60}s` : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Utilisateur</div>
              <div style={{ fontWeight: '500', color: '#0f172a' }}>{session.user_name || 'N/A'}</div>
            </div>
          </div>

          {session.validation_notes && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Notes de validation</div>
              <div style={{ fontWeight: '400', color: '#0f172a' }}>{session.validation_notes}</div>
            </div>
          )}
        </div>

        {/* Actions */}
        {session.status === 'completed' && (
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                // Valider la session
                fetch(`http://localhost:3001/api/sessions/${session.id}/validate`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ validation_notes: 'Validé depuis l\'interface' })
                }).then(() => {
                  loadSession();
                }).catch(console.error);
              }}
              style={{
                padding: '10px 24px',
                background: '#10b981',
                color: 'white',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              ✅ Valider la session
            </button>
            <button
              onClick={() => {
                // Verrouiller la session
                fetch(`http://localhost:3001/api/sessions/${session.id}/lock`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ lock_reason: 'Verrouillé depuis l\'interface' })
                }).then(() => {
                  loadSession();
                }).catch(console.error);
              }}
              style={{
                padding: '10px 24px',
                background: '#6b7280',
                color: 'white',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              🔒 Verrouiller
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          © 2026 MEGA COUNT - Système de comptage d'église
        </div>
      </div>
    </div>
  );
}