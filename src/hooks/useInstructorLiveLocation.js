import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useInstructorLiveLocation(instructorId) {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    if (!instructorId) return;

    supabase
      .from('instructor_locations')
      .select('*')
      .eq('instructor_id', instructorId)
      .maybeSingle()
      .then(({ data }) => { if (data) setLocation(data); });

    const channel = supabase
      .channel(`instructor_loc_${instructorId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'instructor_locations',
        filter: `instructor_id=eq.${instructorId}`,
      }, (payload) => {
        if (payload.new) setLocation(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [instructorId]);

  return location; // { instructor_id, latitude, longitude, heading, updated_at }
}
