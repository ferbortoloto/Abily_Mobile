import { useState, useEffect, useRef, useContext } from 'react';
import { getInstructors } from '../services/instructors.service';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { haversineDistance } from '../utils/travelTime';

const MAX_DISTANCE_KM = 100;

function toAppInstructor(p) {
  return {
    id: p.id,
    name: p.name || '',
    photo: p.avatar_url || null,
    carModel: p.car_model || '',
    carYear: p.car_year || null,
    carColor: p.car_color || '',
    carPlate: p.car_plate || '',
    carOptions: p.car_options || 'instructor',
    vehicleType: p.vehicle_type || 'manual',
    motoModel: p.moto_model || '',
    motoYear: p.moto_year || null,
    motoColor: p.moto_color || '',
    motoPlate: p.moto_plate || '',
    licenseCategory: p.license_category || 'B',
    pricePerHour: p.price_per_hour || 0,
    pricePerHourMoto: p.price_per_hour_moto || null,
    rating: p.rating ?? 0,
    isVerified: p.is_verified ?? false,
    location: p.location || '',
    reviewsCount: p.reviews_count ?? 0,
    bio: p.bio || '',
    coordinates: p.coordinates ?? null,
    isAcceptingRequests: p.is_accepting_requests ?? true,
    gender: p.gender || 'undisclosed',
    avatar_url: p.avatar_url || null,
  };
}

export function useInstructorSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  const userCoordsRef = useRef(user?.coordinates);

  // Mantém ref atualizada para uso dentro do callback Realtime
  useEffect(() => {
    userCoordsRef.current = user?.coordinates;
  }, [user?.coordinates]);

  // Carrega lista inicial
  useEffect(() => {
    getInstructors()
      .then(data => {
        const instructors = data.map(toAppInstructor);
        const userCoords = user?.coordinates;
        if (!userCoords) return instructors;
        return instructors.filter(inst => {
          if (!inst.coordinates) return true;
          return haversineDistance(userCoords, inst.coordinates) <= MAX_DISTANCE_KM;
        });
      })
      .then(filtered => setResults(filtered))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [user?.coordinates]);

  // Realtime: atualiza coordenadas dos instrutores sem refetch completo
  useEffect(() => {
    const channel = supabase
      .channel('instructor_locations')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'role=eq.instructor' },
        (payload) => {
          const updated = payload.new;
          setResults(prev => {
            const exists = prev.some(inst => inst.id === updated.id);
            if (!exists) return prev;
            return prev.map(inst => {
              if (inst.id !== updated.id) return inst;
              const newCoords = updated.coordinates ?? inst.coordinates;
              const userCoords = userCoordsRef.current;
              if (userCoords && newCoords) {
                const dist = haversineDistance(userCoords, newCoords);
                if (dist > MAX_DISTANCE_KM) return null;
              }
              return { ...inst, coordinates: newCoords, pricePerHour: updated.price_per_hour ?? inst.pricePerHour };
            }).filter(Boolean);
          });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { instructors: results, loading };
}
