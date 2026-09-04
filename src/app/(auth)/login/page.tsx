'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('https://floors-amino-steel-nine.trycloudflare.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/dashboard');
      } else {
        setError(data.message || 'Erreur de connexion');
      }
    } catch (err: any) {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)',
      padding: '16px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: '-30%',
        right: '-20%',
        width: '600px',
        height: '600px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '50%'
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '-40%',
        left: '-10%',
        width: '500px',
        height: '500px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '50%'
      }}></div>

      <div style={{
        maxWidth: '448px',
        width: '100%',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 25px 80px rgba(0,0,0,0.2)',
        position: 'relative',
        zIndex: 1,
        animation: 'fadeIn 0.5s ease-out'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '96px',
            height: '96px',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '48px',
            boxShadow: '0 8px 30px rgba(79,70,229,0.3)'
          }}>
            ⛪
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f172a' }}>MEGA COUNT</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>Système de comptage d'église</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#334155', 
              marginBottom: '6px' 
            }}>
              Nom d'utilisateur
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '16px',
                transition: 'all 0.3s',
                background: '#f8fafc'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#4f46e5';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.1)';
                e.currentTarget.style.background = 'white';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.background = '#f8fafc';
              }}
              placeholder="Entrez votre nom d'utilisateur"
              required
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#334155', 
              marginBottom: '6px' 
            }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '16px',
                transition: 'all 0.3s',
                background: '#f8fafc'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#4f46e5';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.1)';
                e.currentTarget.style.background = 'white';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.background = '#f8fafc';
              }}
              placeholder="Entrez votre mot de passe"
              required
            />
          </div>

          {error && (
            <div style={{
              padding: '12px 16px',
              background: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              color: '#dc2626',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: 'white',
              borderRadius: '12px',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: '0 4px 15px rgba(79,70,229,0.3)'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(79,70,229,0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(79,70,229,0.3)';
            }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div style={{ 
          marginTop: '24px', 
          textAlign: 'center', 
          color: '#94a3b8', 
          fontSize: '12px' 
        }}>
          Version 2.0.0
        </div>
      </div>
    </div>
  );
}