import { useState, useEffect, useCallback } from 'react';

// Définition des interfaces pour les résultats de recherche Nominatim
export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: string[];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
  icon?: string;
  address?: {
    suburb?: string;  // Pour les quartiers
    neighbourhood?: string;  // Pour les voisinages
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    municipality?: string;
    state?: string;
    region?: string;
    county?: string;
    district?: string;  // Important pour Madagascar
    locality?: string;  // Peut contenir des quartiers
    country?: string;
    country_code?: string;
    [key: string]: string | undefined;
  };
}

interface UseNominatimSearchProps {
  query: string;
  limit?: number;
  countryCode?: string;
  viewbox?: string;  // Boîte de délimitation pour restreindre la recherche
  format?: 'json' | 'xml' | 'html' | 'jsonv2';
  addressDetails?: boolean;
  debounceMs?: number;
  enabled?: boolean;
  // Nouvelle option: village ou ville spécifique pour contextualiser la recherche
  inPlace?: string;
}

interface UseNominatimSearchResult {
  results: NominatimResult[];
  isLoading: boolean;
  error: Error | null;
  search: (searchTerm: string) => void;
  clearResults: () => void;
}

/**
 * Hook personnalisé pour rechercher des quartiers à Madagascar via l'API Nominatim OpenStreetMap
 */
export const useNominatimSearch = ({
  query = '',
  limit = 15,  // Augmenté pour avoir plus de résultats
  countryCode = 'mg',  // Par défaut Madagascar
  viewbox = '',  // Optionnel, peut être utilisé pour restreindre à une zone
  format = 'json',
  addressDetails = true,
  debounceMs = 300,
  enabled = true,
  inPlace = ''  // Village ou ville spécifique
}: UseNominatimSearchProps): UseNominatimSearchResult => {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(query);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  // Fonction pour construire l'URL avec les paramètres adaptés à Madagascar
  const buildUrl = useCallback((q: string): string => {
    // Si on recherche dans un lieu spécifique, ajouter ce contexte à la requête
    const searchQuery = inPlace ? `${q}, ${inPlace}, Madagascar` : `${q}, Madagascar`;
    
    const params = new URLSearchParams();
    
    // Utilisation de q= pour des recherches générales
    params.append('q', searchQuery);
    
    // Alternative: recherche structurée qui peut être plus précise pour des quartiers
    // params.append('street', q);
    // if (inPlace) params.append('city', inPlace);
    // params.append('country', 'Madagascar');
    
    params.append('format', format);
    params.append('limit', limit.toString());
    params.append('countrycodes', countryCode);
    
    if (viewbox) {
      params.append('viewbox', viewbox);
      params.append('bounded', '1');
    }
    
    if (addressDetails) {
      params.append('addressdetails', '1');
    }
    
    // Demander plus de détails
    params.append('extratags', '1');
    params.append('namedetails', '1');
    
    return `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  }, [format, limit, countryCode, addressDetails, viewbox, inPlace]);

  // Fonction pour effectuer la recherche
  const fetchResults = useCallback(async (q: string): Promise<void> => {
    if (!q.trim() || !enabled) {
      setResults([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const url = buildUrl(q);
      
      // Ajout d'un User-Agent plus spécifique et meilleur pour Madagascar
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MadagascarQuartiersApp/1.0',
          'Accept-Language': 'fr-FR,fr;q=0.9,mg;q=0.8,en;q=0.7'
        }
      });

      if (!response.ok) {
        throw new Error(`Erreur réseau: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Traitement spécial pour Madagascar: prioritiser certains types de résultats
      const processedResults = data.sort((a: NominatimResult, b: NominatimResult) => {
        // Prioriser les quartiers (suburb) et voisinages (neighbourhood)
        const aIsSuburb = a.address?.suburb || a.address?.neighbourhood || 
                         (a.type === 'suburb' || a.type === 'neighbourhood' || 
                          a.class === 'place' && (a.type === 'quarter' || a.type === 'locality'));
        
        const bIsSuburb = b.address?.suburb || b.address?.neighbourhood || 
                         (b.type === 'suburb' || b.type === 'neighbourhood' || 
                          b.class === 'place' && (b.type === 'quarter' || b.type === 'locality'));
                          
        if (aIsSuburb && !bIsSuburb) return -1;
        if (!aIsSuburb && bIsSuburb) return 1;
        
        // Ensuite par importance
        return b.importance - a.importance;
      });
      
      setResults(processedResults);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Une erreur est survenue'));
      console.error('Erreur lors de la recherche Nominatim:', err);
    } finally {
      setIsLoading(false);
    }
  }, [buildUrl, enabled]);

  // Effet pour gérer la recherche avec debounce
  useEffect(() => {
    if (timer) {
      clearTimeout(timer);
    }

    if (searchTerm && enabled) {
      const newTimer = setTimeout(() => {
        fetchResults(searchTerm);
      }, debounceMs);
      
      setTimer(newTimer);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchTerm, fetchResults, debounceMs, enabled]);

  // Fonction pour déclencher une recherche
  const search = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  // Fonction pour effacer les résultats
  const clearResults = useCallback(() => {
    setResults([]);
    setSearchTerm('');
  }, []);

  return {
    results,
    isLoading,
    error,
    search,
    clearResults
  };
};
