// src/app/register-sw.tsx
'use client';

import { useEffect } from 'react';

export function RegisterSW() {
  useEffect(() => {
    // Vérifier que le Service Worker est supporté
    if ('serviceWorker' in navigator) {
      // Attendre que la page soit chargée
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('✅ Service Worker enregistré avec succès:', registration);
          })
          .catch((error) => {
            console.error('❌ Erreur lors de l\'enregistrement du Service Worker:', error);
          });
      });
    } else {
      console.log('⚠️ Service Worker non supporté par ce navigateur');
    }
  }, []);

  return null;
}