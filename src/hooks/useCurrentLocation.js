import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

const DEFAULT_LOCATION = { latitude: -21.7895, longitude: -46.5613 };

export function useCurrentLocation({ highFrequency = false } = {}) {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let subscription = null;

    const startWatching = async () => {
      try {
        if (Platform.OS === 'web') {
          if (navigator?.geolocation) {
            navigator.geolocation.getCurrentPosition(
              pos => {
                if (!cancelled) {
                  setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                  setLoading(false);
                }
              },
              () => {
                if (!cancelled) { setLocation(DEFAULT_LOCATION); setLoading(false); }
              },
              { timeout: 8000 },
            );
          } else {
            setLocation(DEFAULT_LOCATION);
            setLoading(false);
          }
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) {
            setError('Permissão de localização negada');
            setLocation(DEFAULT_LOCATION);
            setLoading(false);
          }
          return;
        }

        // Posição inicial rápida
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (!cancelled) {
            setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            setLoading(false);
          }
        } catch {}

        // Monitoramento contínuo: alta frequência em telas de rastreamento
        subscription = await Location.watchPositionAsync(
          {
            accuracy: highFrequency ? Location.Accuracy.High : Location.Accuracy.Balanced,
            distanceInterval: highFrequency ? 5 : 30,
            timeInterval: highFrequency ? 8000 : 60000,
          },
          (pos) => {
            if (!cancelled) {
              setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
              setLoading(false);
            }
          },
        );
      } catch (e) {
        if (!cancelled) {
          setError('Não foi possível obter a localização.');
          setLocation(DEFAULT_LOCATION);
          setLoading(false);
        }
      }
    };

    startWatching();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return { location, loading, error };
}
