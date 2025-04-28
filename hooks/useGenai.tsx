// hooks/useGeminiAPI.tsx
import { useState } from 'react';
import axios, { AxiosError } from 'axios';
import { GeminiResponse, GeminiError } from './types';

interface UseGeminiAPIReturn {
  generateContent: (prompt: string) => Promise<GeminiResponse | null>;
  loading: boolean;
  error: string | null;
  response: GeminiResponse | null;
}

const useGeminiAPI = (): UseGeminiAPIReturn => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<GeminiResponse | null>(null);

//   const apiKey = "AIzaSyA2VC1Q92QAmfPZaczALdtJ8BRTF8o5PYs"; // Remplace par ta vraie clé API

  const API_KEY = 'AIzaSyA2VC1Q92QAmfPZaczALdtJ8BRTF8o5PYs'; // À stocker de façon sécurisée
  const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  const generateContent = async (prompt: string): Promise<GeminiResponse | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await axios.post<GeminiResponse>(
        `${API_URL}?key=${API_KEY}`,
        {
          contents: [
            {
              parts: [
                {
                  text: `
                  suggerer moi les itineraires que je dois suivre pour bien organiser mon livraison et donne moi la distance et durée estime à chaque adresse. Le resultat sous json comme ça : 
                  {
                    id: string;
                    to: string;
                    from: string;
                    duration: string;
                    distance: string;
                  }
                  et pas d'autres textes.
                  et pour duration met chiffre de duration max min(2 min), distance : chiffre de distance max km (4 km)
                  voici les données : 
                  position actuelle Latitude et Longitude  : -18.89123,47.558731, Ankeranana, Antananarivo
                   [
                              { id: '1', name: 'Analakely', fullName: 'Analakely, Antananarivo', lat: '-18.9092', lon: '47.5235' },
                              { id: '2', name: 'Ambohimanarina', fullName: 'Ambohimanarina, Antananarivo', lat: '-18.8676', lon: '47.5046' },
                              { id: '3', name: 'Ankadifotsy', fullName: 'Ankadifotsy, Antananarivo', lat: '-18.9126', lon: '47.5312' },
                              { id: '4', name: 'Ambohipo', fullName: 'Ambohipo, Antananarivo', lat: '-18.9198', lon: '47.5389' },
                   ]


                  `
                }
              ]
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      setResponse(result.data);
      return result.data;
    } catch (err) {
      const axiosError = err as AxiosError<GeminiError>;
      const errorMessage = axiosError.response?.data?.error?.message || axiosError.message;
      setError(errorMessage);
      console.log(error)
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { generateContent, loading, error, response };
};

export default useGeminiAPI;