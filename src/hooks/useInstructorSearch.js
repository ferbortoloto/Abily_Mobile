import { useState, useEffect, useContext } from 'react';
import { getInstructors } from '../services/instructors.service';
import { AuthContext } from '../context/AuthContext';
import { haversineDistance } from '../utils/travelTime';

const MAX_DISTANCE_KM = 100;

// Mapeia campos snake_case do DB para camelCase usado na UI
function toAppInstructor(p) {
  return {
    id: p.id,
    name: p.name || '',
    photo: p.avatar_url || null,
    carModel: p.car_model || '',
    carYear: p.car_year || null,
    carOptions: p.car_options || 'instructor',
    vehicleType: p.vehicle_type || 'manual',
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
  };
}

export function useInstructorSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);

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

  return { instructors: results, loading };
}
