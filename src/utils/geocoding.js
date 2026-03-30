const NOMINATIM_HEADERS = {
  'Accept-Language': 'pt-BR',
  'User-Agent': 'AbilyMOBILE/1.0',
};

/**
 * Busca sugestões de endereço com detalhes estruturados (para autocomplete).
 * Aceita um contexto de cidade para refinar os resultados em cidades menores.
 */
export async function searchAddresses(query, cityContext = '') {
  const fullQuery = cityContext.trim()
    ? `${query}, ${cityContext.trim()}, Brasil`
    : `${query}, Brasil`;
  const q = encodeURIComponent(fullQuery);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&countrycodes=br&addressdetails=1`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return [];
  return res.json();
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
 * Geocoding via Nominatim (OpenStreetMap) — gratuito, sem chave de API.
 * Converte um endereço de texto em { latitude, longitude }.
 */
export async function geocodeAddress(address) {
  const query = encodeURIComponent(`${address}, Brasil`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br`;

  const response = await fetch(url, { headers: NOMINATIM_HEADERS });

  if (!response.ok) throw new Error('Erro ao consultar geocoding');

  const data = await response.json();
  if (!data || data.length === 0) return null;

  return {
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}
