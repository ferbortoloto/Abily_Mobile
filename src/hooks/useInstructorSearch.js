import { useState, useEffect } from 'react';
import { getInstructors } from '../services/instructors.service';

// Mapeia campos snake_case do DB para camelCase usado na UI
function toAppInstructor(p) {
  return {
    id: p.id,
    name: p.name || '',
    photo: p.avatar_url || null,
    carModel: p.car_model || '',
    carOptions: p.car_options || 'instructor',
    licenseCategory: p.license_category || 'B',
    pricePerHour: p.price_per_hour || 0,
    rating: p.rating ?? 0,
    isVerified: p.is_verified ?? false,
    location: p.location || '',
    reviewsCount: p.reviews_count ?? 0,
    bio: p.bio || '',
    coordinates: p.coordinates ?? { latitude: -23.5505, longitude: -46.6333 },
    isAcceptingRequests: p.is_accepting_requests ?? true,
  };
}

export function useInstructorSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInstructors()
      .then(data => setResults(data.map(toAppInstructor)))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  return { instructors: results, loading };
}
