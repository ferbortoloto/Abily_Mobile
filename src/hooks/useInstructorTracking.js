import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCATION_TASK_NAME, INSTRUCTOR_ID_KEY } from '../tasks/locationTask';
import { getNextUpcomingClassAsInstructor } from '../services/events.service';

const ACTIVATE_MIN  = 30;  // começa a compartilhar 30 min antes
const DEACTIVATE_MIN = 60; // para de compartilhar 60 min após o início

export function useInstructorTracking(instructorId) {
  const [isTracking, setIsTracking]     = useState(false);
  const [upcomingClass, setUpcomingClass] = useState(null);
  const intervalRef = useRef(null);

  const stopTracking = useCallback(async () => {
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
      if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch {}
    await AsyncStorage.removeItem(INSTRUCTOR_ID_KEY).catch(() => {});
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(async (id) => {
    try {
      const { status: fg } = await Location.requestForegroundPermissionsAsync();
      if (fg !== 'granted') return;

      const { status: bg } = await Location.requestBackgroundPermissionsAsync();
      if (bg !== 'granted') return;

      await AsyncStorage.setItem(INSTRUCTOR_ID_KEY, id);

      const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
      if (!running) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy:                          Location.Accuracy.Balanced,
          timeInterval:                      10000,
          distanceInterval:                  15,
          showsBackgroundLocationIndicator:  true,
          foregroundService: {
            notificationTitle: 'Abily — Compartilhando localização',
            notificationBody:  'Seu aluno pode ver onde você está.',
            notificationColor: '#1D4ED8',
          },
        });
      }
      setIsTracking(true);
    } catch (e) {
      console.error('[useInstructorTracking] start failed', e);
    }
  }, []);

  const checkAndSync = useCallback(async () => {
    if (!instructorId) return;

    const windowMin = ACTIVATE_MIN + DEACTIVATE_MIN;
    const classData = await getNextUpcomingClassAsInstructor(instructorId, windowMin).catch(() => null);
    setUpcomingClass(classData ?? null);

    if (!classData?.start_datetime) {
      await stopTracking();
      return;
    }

    const diff = (new Date(classData.start_datetime) - Date.now()) / 60000;
    const shouldTrack = diff <= ACTIVATE_MIN && diff > -DEACTIVATE_MIN;

    if (shouldTrack) {
      await startTracking(instructorId);
    } else {
      await stopTracking();
    }
  }, [instructorId, startTracking, stopTracking]);

  useEffect(() => {
    checkAndSync();
    intervalRef.current = setInterval(checkAndSync, 60000);
    return () => {
      clearInterval(intervalRef.current);
    };
  }, [checkAndSync]);

  return { isTracking, upcomingClass };
}
