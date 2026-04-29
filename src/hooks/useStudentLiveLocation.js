import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Subscribes to a student's live GPS position via profiles.coordinates (Realtime)
export function useStudentLiveLocation(studentId) {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    if (!studentId) return;

    supabase
      .from('profiles')
      .select('coordinates, updated_at')
      .eq('id', studentId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.coordinates) setLocation(data.coordinates);
      });

    const channel = supabase
      .channel(`student_loc_${studentId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'profiles',
        filter: `id=eq.${studentId}`,
      }, (payload) => {
        if (payload.new?.coordinates) setLocation(payload.new.coordinates);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [studentId]);

  return location; // { latitude, longitude } or null
}
