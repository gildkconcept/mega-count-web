'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const navItems = [
    { href: '/dashboard', label: '📊 Tableau de bord' },
    { href: '/counting', label: '📷 Comptage manuel' },
    { href: '/counting-ai', label: '🤖 Comptage IA' },
    { href: '/sessions', label: '📋 Mes sessions' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      {/* Header Mobile */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        background: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => setSidebarOpen(true)}
            style={{
              padding: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '24px'
            }}
          >
            ☰
          </button>
          <span style={{ fontWeight: 'bold', color: '#4f46e5', fontSize: '18px' }}>MEGA COUNT</span>
        </div>
        <span style={{ color: '#64748b', fontSize: '14px' }}>{user?.first_name}</span>
      </header>

      {/* Sidebar Mobile */}
      {sidebarOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex'
        }}>
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.5)'
            }}
            onClick={() => setSidebarOpen(false)}
          />
          <div style={{
            position: 'relative',
            width: '256px',
            background: 'white',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <span style={{ fontWeight: 'bold', color: '#4f46e5', fontSize: '20px' }}>MEGA COUNT</span>
              <button 
                onClick={() => setSidebarOpen(false)}
                style={{
                  padding: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px'
                }}
              >
                ✕
              </button>
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => {
                      router.push(item.href);
                      setSidebarOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '15px',
                      fontWeight: isActive ? '600' : '400',
                      background: isActive ? '#eef2ff' : 'transparent',
                      color: isActive ? '#4f46e5' : '#334155',
                      transition: 'all 0.2s'
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '15px',
                  color: '#ef4444',
                  background: 'transparent',
                  marginTop: 'auto'
                }}
              >
                🚪 Déconnexion
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Sidebar Desktop */}
      <aside style={{
        display: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '256px',
        background: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '28px' }}>⛪</span>
            <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '20px' }}>MEGA COUNT</span>
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Système de comptage</p>
        </div>

        <nav style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '15px',
                  fontWeight: isActive ? '600' : '400',
                  background: isActive ? '#eef2ff' : 'transparent',
                  color: isActive ? '#4f46e5' : '#334155',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#eef2ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              color: '#4f46e5'
            }}>
              {user?.first_name?.charAt(0) || 'U'}
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '500', color: '#0f172a' }}>
                {user?.first_name} {user?.last_name}
              </p>
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>{user?.username}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: '#fef2f2',
              color: '#ef4444',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fee2e2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fef2f2';
            }}
          >
            🚪 Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main>
        <div style={{ display: 'none' }} />
        {children}
      </main>

      <style>{`
        @media (min-width: 1024px) {
          aside {
            display: flex !important;
          }
          header {
            display: none !important;
          }
          main {
            margin-left: 256px;
          }
        }
      `}</style>
    </div>
  );
}