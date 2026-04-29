import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export const LOCATION_TASK_NAME = 'instructor-location-task';
export const INSTRUCTOR_ID_KEY  = '@abily/tracking_instructor_id';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;

  const { locations } = data;
  const loc = locations?.[0];
  if (!loc) return;

  try {
    let instructorId = null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      instructorId = session?.user?.id ?? null;
    } catch {}

    if (!instructorId) {
      instructorId = await AsyncStorage.getItem(INSTRUCTOR_ID_KEY);
    }
    if (!instructorId) return;

    await supabase.from('instructor_locations').upsert({
      instructor_id: instructorId,
      latitude:      loc.coords.latitude,
      longitude:     loc.coords.longitude,
      heading:       loc.coords.heading ?? null,
      updated_at:    new Date().toISOString(),
    });
  } catch (e) {
    console.error('[LocationTask]', e);
  }
});
