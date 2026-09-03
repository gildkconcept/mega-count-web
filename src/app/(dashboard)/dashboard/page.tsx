'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }

    loadDashboard();
  }, [router]);

  const loadDashboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/statistics/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setLoading(false);
    }
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
          <p style={{ color: '#64748b' }}>Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { title: "Comptages aujourd'hui", value: stats?.today?.count || 0, icon: '📈', color: '#3b82f6', bg: '#eff6ff' },
    { title: "Sessions aujourd'hui", value: stats?.today?.sessions || 0, icon: '⏰', color: '#10b981', bg: '#ecfdf5' },
    { title: 'Compteurs actifs', value: stats?.active_counters || 0, icon: '👥', color: '#8b5cf6', bg: '#f5f3ff' },
    { title: 'Validations en attente', value: stats?.pending_validations || 0, icon: '⚠️', color: '#f59e0b', bg: '#fffbeb' },
  ];

  const totalCards = [
    { title: 'Assemblées', value: stats?.total?.assemblies || 0, icon: '⛪', color: '#4f46e5', bg: '#eef2ff' },
    { title: 'Utilisateurs', value: stats?.total?.users || 0, icon: '👤', color: '#ec4899', bg: '#fdf2f8' },
    { title: 'Sessions totales', value: stats?.total?.sessions || 0, icon: '📅', color: '#06b6d4', bg: '#ecfeff' },
    { title: 'Personnes comptées', value: stats?.total?.count || 0, icon: '✅', color: '#22c55e', bg: '#f0fdf4' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', padding: '24px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        
        {/* En-tête */}
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)',
          borderRadius: '20px',
          padding: '32px 40px',
          marginBottom: '28px',
          color: 'white',
          boxShadow: '0 20px 60px rgba(79,70,229,0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: '-50%',
            right: '-20%',
            width: '400px',
            height: '400px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '50%'
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: '-60%',
            left: '-10%',
            width: '300px',
            height: '300px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '50%'
          }}></div>
          
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                <span style={{ fontSize: '28px' }}>👋</span>
                <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>
                  Bonjour, {user?.first_name || 'Utilisateur'} !
                </h1>
              </div>
              <p style={{ opacity: 0.85, fontSize: '15px' }}>
                {new Date().toLocaleDateString('fr-FR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            {stats?.active_assemblies > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)',
                padding: '8px 20px',
                borderRadius: '9999px',
                fontSize: '14px',
                fontWeight: '500',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                🏛️ {stats.active_assemblies} assemblée(s) active(s)
              </div>
            )}
          </div>
        </div>

        {/* Actions rapides */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
          <button 
            onClick={() => router.push('/counting')}
            style={{
              background: 'white',
              padding: '20px 24px',
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s',
              border: '2px solid transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#4f46e5';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(79,70,229,0.15)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                color: 'white'
              }}>
                📷
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '16px' }}>Nouveau comptage</div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>Démarrer une session</div>
              </div>
            </div>
            <div style={{ color: '#94a3b8', fontSize: '20px' }}>→</div>
          </button>

          <button 
            onClick={() => router.push('/sessions')}
            style={{
              background: 'white',
              padding: '20px 24px',
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s',
              border: '2px solid transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#8b5cf6';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(139,92,246,0.15)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                color: 'white'
              }}>
                📊
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '16px' }}>Mes sessions</div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>Voir l'historique</div>
              </div>
            </div>
            <div style={{ color: '#94a3b8', fontSize: '20px' }}>→</div>
          </button>
        </div>

        {/* Statistiques du jour */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
          {statCards.map((card, index) => (
            <div key={index} style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px 24px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
              borderLeft: `4px solid ${card.color}`,
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.08)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>{card.title}</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>{card.value}</div>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: card.bg,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Totaux */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {totalCards.map((card, index) => (
            <div key={index} style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px 24px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
              transition: 'all 0.3s',
              border: '1px solid #f1f5f9'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.08)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>{card.title}</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>{card.value}</div>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: card.bg,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
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