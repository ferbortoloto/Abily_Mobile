import { MAPBOX_TOKEN } from '../lib/mapbox';

const GEOCODING_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

// Converte um feature do Mapbox para o formato Nominatim usado pelo UserProfileScreen.
function toNominatim(feature) {
  const context = feature.context || [];
  const placeCtx  = context.find(c => c.id.startsWith('place.'));
  const regionCtx = context.find(c => c.id.startsWith('region.'));
  const shortCode = regionCtx?.short_code || ''; // ex: "BR-SP"
  const uf = shortCode.includes('-') ? shortCode.split('-')[1] : (regionCtx?.text || '');
  return {
    place_id:     feature.id,
    display_name: feature.place_name,
    lat:          String(feature.geometry.coordinates[1]),
    lon:          String(feature.geometry.coordinates[0]),
    address: {
      road:              feature.text || '',
      house_number:      feature.properties?.address || '',
      city:              placeCtx?.text || '',
      'ISO3166-2-lvl4': shortCode,
      state:             uf,
    },
  };
}

/**
 * Busca sugestões de endereço com detalhes estruturados (para autocomplete).
 * Aceita um contexto de cidade para refinar os resultados em cidades menores.
 */
export async function searchAddresses(query, cityContext = '') {
  const fullQuery = cityContext.trim() ? `${query}, ${cityContext.trim()}` : query;
  const url =
    `${GEOCODING_BASE}/${encodeURIComponent(fullQuery)}.json` +
    `?country=br&language=pt&limit=5&types=address&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features || []).map(toNominatim);
}

/**
 * Busca endereço pelo CEP via ViaCEP (https://viacep.com.br).
 * Retorna { logradouro, bairro, localidade, uf } ou null se não encontrado.
 */
export async function searchByCep(cep) {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.erro) return null;
  return data;
}

/**
 * Geocoding via Mapbox — converte endereço em { latitude, longitude, displayName }.
 */
export async function geocodeAddress(address) {
  const url =
    `${GEOCODING_BASE}/${encodeURIComponent(`${address}, Brasil`)}.json` +
    `?country=br&language=pt&limit=1&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Erro ao consultar geocoding');
  const data = await res.json();
  if (!data.features || data.features.length === 0) return null;
  const [lng, lat] = data.features[0].geometry.coordinates;
  return {
    latitude:    lat,
    longitude:   lng,
    displayName: data.features[0].place_name,
  };
}
