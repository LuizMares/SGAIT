/**
 * High-precision GPS & Reverse Geocoding Utilities with Neighborhood Sanitization
 */

// Blacklisted non-neighborhood administrative and continental terms returned by geocoding services
const INVALID_NEIGHBORHOOD_PATTERNS = [
  /am[ée]rica/i,
  /am[ée]rica do sul/i,
  /am[ée]rica latina/i,
  /am[ée]rica do norte/i,
  /sul-?americana/i,
  /continente/i,
  /planeta/i,
  /hemisf[ée]rio/i,
  /regi[ãa]o/i,
  /micro-?regi[ãa]o/i,
  /meso-?regi[ãa]o/i,
  /metropolitana/i,
  /intermedi[áa]ria/i,
  /imediata/i,
  /estado/i,
  /rep[úu]blica/i,
  /brasil/i,
  /bahia/i,
  /zona rural/i,
  /distrito sede/i,
  /1º distrito/i,
  /2º distrito/i,
  /subdistrito/i,
  /munic[íi]pio/i,
];

// Known street-to-neighborhood mapping for Pojuca to guarantee accurate neighborhood resolution
const STREET_NEIGHBORHOOD_MAP: Record<string, string> = {
  'antonio motta': 'Centro',
  'antônio motta': 'Centro',
  'antonio mota': 'Centro',
  'antônio mota': 'Centro',
  '15 de novembro': 'Centro',
  'quinze de novembro': 'Centro',
  'durvalina': 'Centro',
  'j j seabra': 'Centro',
  'jj seabra': 'Centro',
  'getulio vargas': 'Centro',
  'getúlio vargas': 'Centro',
  'almirante barroso': 'Centro',
  'consolação': 'Centro',
  'consolacao': 'Centro',
  'duque de caxias': 'Centro',
  'maracangalha': 'Retiro',
   'mario pinto': 'Nova Pojuca',
  'mário pinto': 'Nova Pojuca',
  'sao luiz': 'Parque São Luiz',
  'são luiz': 'Parque São Luiz',
};

// Known neighborhood aliases and proper canonical formatting for Pojuca & Region
const KNOWN_NEIGHBORHOODS_MAP: Record<string, string> = {
  'centro': 'Centro',
  'alto do eco': 'Alto do Eco',
  'nova pojuca': 'Nova Pojuca',
  'parque sao luiz': 'Parque São Luiz',
  'parque são luiz': 'Parque São Luiz',
  'parque sao luis': 'Parque São Luiz',
  'parque são luis': 'Parque São Luiz',
  'loteamento sao luiz': 'Loteamento São Luiz',
  'loteamento são luiz': 'Loteamento São Luiz',
  'retiro': 'Retiro',
  'shangri la': 'Shangri-Lá',
  'shangri-la': 'Shangri-Lá',
  'shangri-lá': 'Shangri-Lá',
  'shangrila': 'Shangri-Lá',
  'los angeles': 'Los Angeles',
  'los ângeles': 'Los Angeles',
  'teresa cristina': 'Tereza Cristina',
  'tereza cristina': 'Tereza Cristina',
  'cruzeiro': 'Cruzeiro',
  'pitangueiras': 'Pitangueiras',
  'mirante': 'Mirante',
  'palmeiras': 'Palmeiras',
  'parque das palmeiras': 'Parque das Palmeiras',
  'caboclo': 'Caboclo',
  'santo antonio': 'Santo Antônio',
  'santo antônio': 'Santo Antônio',
  'central': 'Central',
  'pojuca 2': 'Pojuca II',
  'pojuca ii': 'Pojuca II',
  'santiago': 'Santiago',
  'riachao': 'Riachão',
  'riachão': 'Riachão',
  'garoupa': 'Garoupa',
  'coracao de maria': 'Coração de Maria',
  'coração de maria': 'Coração de Maria',
  'loteamento vargas': 'Loteamento Vargas',
  'bairro novo': 'Bairro Novo',
  'distrito industrial': 'Distrito Industrial',
  'ponto do gado': 'Ponto do Gado',
  'santa cruz': 'Santa Cruz',
  'são francisco': 'São Francisco',
  'sao francisco': 'São Francisco',
  'bela vista': 'Bela Vista',
  'boa vista': 'Boa Vista',
};

/**
 * Proper Title Case for Portuguese strings, keeping prepositions lowercase
 */
export function toPortugueseTitleCase(text: string): string {
  if (!text) return '';
  const lowerPrepositions = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'por', 'a', 'o']);
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, idx) => {
      if (idx > 0 && lowerPrepositions.has(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Cleans and validates a raw neighborhood string returned from geocoders
 */
export function cleanNeighborhoodName(rawName?: string, cityName: string = 'Pojuca'): string {
  if (!rawName) return '';
  let cleaned = rawName.trim();

  // Remove leading redundant prefix terms
  cleaned = cleaned
    .replace(/^(bairro|sub-?bairro|loteamento|conjunto)\s+/i, '')
    .replace(/^(bairro|sub-?bairro|loteamento|conjunto)\s+/i, '') // repeated prefix strip
    .trim();

  if (!cleaned) return '';

  // Check against invalid administrative patterns
  for (const pattern of INVALID_NEIGHBORHOOD_PATTERNS) {
    if (pattern.test(cleaned)) {
      return '';
    }
  }

  const lowerClean = cleaned.toLowerCase();
  const lowerCity = cityName.toLowerCase().trim();

  // If neighborhood name is identical to the city name or state name, reject
  if (lowerClean === lowerCity || lowerClean === 'bahia' || lowerClean === 'ba') {
    return '';
  }

  // Check known neighborhood canonical dictionary
  if (KNOWN_NEIGHBORHOODS_MAP[lowerClean]) {
    return KNOWN_NEIGHBORHOODS_MAP[lowerClean];
  }

  // Capitalize properly
  return toPortugueseTitleCase(cleaned);
}

/**
 * Sanitizes an existing address string by removing invalid macro neighborhoods (e.g., 'Bairro América do Sul')
 */
export function sanitizeFullAddress(address: string): string {
  if (!address) return '';

  let sanitized = address;

  // Remove invalid neighborhood segments
  sanitized = sanitized.replace(/,\s*Bairro\s+(Am[ée]rica do Sul|Am[ée]rica Latina|Am[ée]rica|Brasil|Bahia)\s*,/gi, ',');
  sanitized = sanitized.replace(/,\s*Bairro\s+(Am[ée]rica do Sul|Am[ée]rica Latina|Am[ée]rica|Brasil|Bahia)/gi, '');
  sanitized = sanitized.replace(/\s*Bairro\s+(Am[ée]rica do Sul|Am[ée]rica Latina|Am[ée]rica|Brasil|Bahia)\s*,?/gi, '');

  // Fix double commas
  sanitized = sanitized.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();

  // If street is Antonio Motta in Pojuca and neighborhood was stripped, insert Bairro Centro
  if (/ant[oô]nio motta/i.test(sanitized) && !/bairro/i.test(sanitized) && /pojuca/i.test(sanitized)) {
    sanitized = sanitized.replace(/(Rua Ant[oô]nio Motta(?:,\s*nº\s*\d+)?)(,\s*Pojuca)/i, '$1, Bairro Centro$2');
  }

  return sanitized;
}
export function formatAddress({
  road,
  houseNumber,
  neighbourhood,
  city = 'Pojuca',
  state = 'BA',
  postcode,
  latitude,
  longitude,
  accuracy,
}: {
  road?: string;
  houseNumber?: string;
  neighbourhood?: string;
  city?: string;
  state?: string;
  postcode?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
}): string {
  const latFixed = latitude.toFixed(6);
  const lonFixed = longitude.toFixed(6);
  const accuracyText = accuracy && accuracy > 0 ? ` [±${Math.round(accuracy)}m]` : '';

  const cleanCity = (city || 'Pojuca').trim();
  const cleanState = (state || 'BA').trim().toUpperCase().replace('BR-', '');
  const cleanNeighbourhood = cleanNeighborhoodName(neighbourhood, cleanCity);

  const parts: string[] = [];

  // Road & House Number
  if (road && road.trim()) {
    const cleanRoad = road.trim();
    if (houseNumber && houseNumber.trim()) {
      parts.push(`${cleanRoad}, nº ${houseNumber.trim()}`);
    } else {
      parts.push(cleanRoad);
    }
  }

  // Neighborhood
  if (cleanNeighbourhood) {
    parts.push(`Bairro ${cleanNeighbourhood}`);
  }

  // City & State
  parts.push(`${cleanCity} - ${cleanState}`);

  // Postcode
  if (postcode && postcode.trim()) {
    parts.push(`CEP ${postcode.trim()}`);
  }

  const baseAddress = parts.length > 0 ? parts.join(', ') : `${cleanCity} - ${cleanState}`;
  const fullAddress = `${baseAddress} (GPS: ${latFixed}, ${lonFixed}${accuracyText})`;
  return sanitizeFullAddress(fullAddress);
}

/**
 * Performs high-precision reverse geocoding with intelligent fallback and neighborhood cleaning
 */
export async function reverseGeocodeGps(
  latitude: number,
  longitude: number,
  accuracy?: number
): Promise<string> {
  let road = '';
  let houseNumber = '';
  let rawNeighbourhood = '';
  let city = 'Pojuca';
  let state = 'BA';
  let postcode = '';

  // 1. Primary: OpenStreetMap Nominatim jsonv2 API with full addressdetails
  try {
    const osmRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=pt-br`
    );
    if (osmRes.ok) {
      const osmData = await osmRes.json();
      const addr = osmData.address || {};

      road = addr.road || addr.pedestrian || addr.footway || addr.avenue || addr.street || addr.highway || addr.path || addr.square || '';
      houseNumber = addr.house_number || addr.building || '';
      city = addr.city || addr.town || addr.municipality || addr.village || addr.county || 'Pojuca';
      state = addr.state ? (addr.state.length === 2 ? addr.state.toUpperCase() : 'BA') : 'BA';
      postcode = addr.postcode || '';

      // Check neighborhood candidates in order of specificity
      const neighborhoodCandidates = [
        addr.suburb,
        addr.neighbourhood,
        addr.residential,
        addr.quarter,
        addr.city_district,
        addr.hamlet,
        addr.village,
      ];

      for (const candidate of neighborhoodCandidates) {
        if (candidate) {
          const cleaned = cleanNeighborhoodName(candidate, city);
          if (cleaned) {
            rawNeighbourhood = cleaned;
            break;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Nominatim geocode warning:', err);
  }

  // 2. Secondary: BigDataCloud Client API if road or neighborhood still missing
  if (!road || !rawNeighbourhood) {
    try {
      const bdcRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`
      );
      if (bdcRes.ok) {
        const bdcData = await bdcRes.json();
        if (bdcData) {
          if (!road && bdcData.street) road = bdcData.street;
          if (!houseNumber && bdcData.houseNumber) houseNumber = bdcData.houseNumber;
          if (!city && (bdcData.city || bdcData.locality)) city = bdcData.city || bdcData.locality;
          if (!postcode && bdcData.postcode) postcode = bdcData.postcode;

          if (!rawNeighbourhood && bdcData.localityInfo && Array.isArray(bdcData.localityInfo.informative)) {
            for (const item of bdcData.localityInfo.informative) {
              if (item && item.name) {
                const cleaned = cleanNeighborhoodName(item.name, city);
                if (cleaned) {
                  rawNeighbourhood = cleaned;
                  break;
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('BigDataCloud geocode warning:', err);
    }
  }

  // 3. Fallback: Lookup neighborhood by street name if neighborhood is still missing
  if (!rawNeighbourhood && road) {
    const lowerRoad = road.toLowerCase();
    for (const [streetKey, mappedBairro] of Object.entries(STREET_NEIGHBORHOOD_MAP)) {
      if (lowerRoad.includes(streetKey)) {
        rawNeighbourhood = mappedBairro;
        break;
      }
    }
  }

  return formatAddress({
    road,
    houseNumber,
    neighbourhood: rawNeighbourhood,
    city,
    state,
    postcode,
    latitude,
    longitude,
    accuracy,
  });
}
