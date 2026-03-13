import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

// Fallback: Poços de Caldas
const DEFAULT_LOCATION = { latitude: -21.7895, longitude: -46.5613 };

export function useCurrentLocation() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const getLocation = async () => {
      try {
        // Web não suporta expo-location da mesma forma
        if (Platform.OS === 'web') {
          if (navigator?.geolocation) {
            navigator.geolocation.getCurrentPosition(
              pos => {
                if (!cancelled) {
                  setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                }
              },
              () => {
                if (!cancelled) setLocation(DEFAULT_LOCATION);
              },
              { timeout: 8000 },
            );
          } else {
            setLocation(DEFAULT_LOCATION);
          }
          setLoading(false);
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) {
            setError('Permissão de localização negada');
            setLocation(DEFAULT_LOCATION);
          }
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
        });

        if (!cancelled) {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setLocation(DEFAULT_LOCATION);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    getLocation();
    return () => { cancelled = true; };
  }, []);

  return { location, loading, error };
}
