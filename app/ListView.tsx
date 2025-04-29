import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Keyboard,
  SafeAreaView,
  StatusBar,
  Dimensions,
  ListRenderItemInfo,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNominatimSearch, NominatimResult } from '../hooks/useNominatimSearch';
import { router } from 'expo-router';
import useGeminiAPI from '@/hooks/useGenai';

// Définition des interfaces
interface ListItem {
  id: string;
  text: string;
  fullName?: string;
  lat?: string;
  lon?: string;
  confirmDelete?: boolean;
}

export default function MadagascarQuartiersView(): React.ReactElement {
  const [searchText, setSearchText] = useState<string>('');
  const [village, setVillage] = useState<string>(''); // Nom de votre village à Madagascar
  const [showVillageInput, setShowVillageInput] = useState<boolean>(false);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const { generateContent, loading } = useGeminiAPI();
  const [geminiLoading, setGeminiLoading] = useState<boolean>(false);

  // Utilisation du hook Nominatim spécialisé pour Madagascar
  const {
    results: searchResults,
    isLoading,
    error,
    search,
    clearResults
  } = useNominatimSearch({
    query: '',
    limit: 15,
    countryCode: 'mg',
    debounceMs: 400,
    addressDetails: true,
    inPlace: village // Contexte du village
  });

  // Mettre à jour la recherche lorsque searchText change
  useEffect(() => {
    if (searchText.length > 0) {
      search(searchText);
    } else {
      clearResults();
    }
  }, [searchText, search, clearResults]);

  const addItem = (text: string, fullName?: string, lat?: string, lon?: string): void => {
    if (text.trim() === '') return;
    
    // Vérifier si l'élément existe déjà
    const exists = listItems.some(item => 
      item.text.toLowerCase() === text.trim().toLowerCase()
    );
    
    if (exists) {
      Alert.alert('Doublon', 'Ce quartier est déjà dans votre liste');
      return;
    }
    
    const newItem: ListItem = {
      id: Date.now().toString(),
      text: text.trim(),
      fullName,
      lat,
      lon
    };
    
    setListItems([...listItems, newItem]);
    setSearchText('');
    clearResults();
    Keyboard.dismiss();
  };

  // Fonction pour gérer la suppression d'un élément
  const toggleConfirmDelete = (id: string): void => {
    const updatedItems = listItems.map(item => {
      if (item.id === id) {
        return { ...item, confirmDelete: !item.confirmDelete };
      } else {
        return { ...item, confirmDelete: false };
      }
    });
    setListItems(updatedItems);
  };

  const handleClickItineraires = async (): Promise<void> => {
    try {
      // Afficher l'indicateur de chargement
      setGeminiLoading(true);
      
      const prompt = JSON.stringify(listItems);
      
      const data = await generateContent(prompt);
      
      if (data && data.candidates && data.candidates[0]?.content?.parts) {
      const results =  JSON.stringify(data.candidates[0].content.parts[0].text)
      .replace(/```json|```/g, '')
      .replace(/\/\/.*$/gm, '')  
      .trim();
      const response = JSON.parse(results)
      console.log("Résultats de Gemini:", response);
      router.push(`/ItineraireScreen?items=${encodeURIComponent(response)}`);
      } else {
        Alert.alert(
          "Erreur",
          "Impossible de générer l'itinéraire. Veuillez réessayer.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Erreur lors de la génération:", error);
      Alert.alert(
        "Erreur",
        "Une erreur s'est produite. Veuillez réessayer plus tard.",
        [{ text: "OK" }]
      );
    } finally {
      // Masquer l'indicateur de chargement dans tous les cas
      setGeminiLoading(false);
    }
  };

  const confirmDelete = (id: string): void => {
    const updatedList = listItems.filter(item => item.id !== id);
    setListItems(updatedList);
  };

  const selectSearchResult = (result: NominatimResult): void => {
    // Extraction intelligente du nom du quartier ou lieu
    const placeName = extractMainName(result);
    const fullDisplayName = result.display_name;
    
    addItem(placeName, fullDisplayName, result.lat, result.lon);
  };

  
  // Fonction de navigation
  const handleNavigateMap = () => {
    const itemsString = JSON.stringify(listItems);
    router.push(`/MapScreen?items=${encodeURIComponent(itemsString)}`);
  };

  // Fonction pour extraire le nom le plus pertinent
  const extractMainName = (result: NominatimResult): string => {
    // Priorité aux quartiers et voisinages
    if (result.address?.suburb) return result.address.suburb;
    if (result.address?.neighbourhood) return result.address.neighbourhood;
    if (result.address?.locality) return result.address.locality;
    
    // Si c'est un quartier ou section (common dans les données OSM Madagascar)
    if (result.type === 'suburb' || result.type === 'quarter' || result.type === 'neighbourhood') {
      // Prendre le premier élément du display_name qui est généralement le nom direct
      return result.display_name.split(',')[0].trim();
    }
    
    // Nom du lieu tel qu'affiché en premier
    return result.display_name.split(',')[0].trim();
  };

  const renderItem = ({ item }: ListRenderItemInfo<ListItem>): React.ReactElement => (
    <View style={styles.listItem}>
      <View style={styles.listItemContent}>
        <Text style={styles.listItemText}>{item.text}</Text>
        {item.fullName && (
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.listItemSubtext}>
            {item.fullName}
          </Text>
        )}
        {item.lat && item.lon && (
          <Text style={styles.listItemCoords}>
            {item.lat.substring(0, 7)}, {item.lon.substring(0, 7)}
          </Text>
        )}
      </View>
      
      {item.confirmDelete ? (
        // Vue de confirmation
        <View style={styles.confirmDeleteContainer}>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => toggleConfirmDelete(item.id)}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.confirmButton} 
            onPress={() => confirmDelete(item.id)}
          >
            <Text style={styles.confirmButtonText}>Confirmer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Bouton de suppression normal
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => toggleConfirmDelete(item.id)}
        >
          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSearchResult = ({ item }: ListRenderItemInfo<NominatimResult>): React.ReactElement => {
    // Extraction intelligente du nom et des informations supplémentaires
    const mainName = extractMainName(item);
    
    // Informations contextuelles
    const locationInfo = [];
    if (item.address?.city) locationInfo.push(item.address.city);
    else if (item.address?.town) locationInfo.push(item.address.town);
    else if (item.address?.village) locationInfo.push(item.address.village);
    
    if (item.address?.county || item.address?.district) 
      locationInfo.push(item.address?.county || item.address?.district || '');
    
    if (item.address?.state) locationInfo.push(item.address.state);
    
    const locationStr = locationInfo.join(', ');
    
    const typeLabel = getTypeLabel(item.type, item.class);
    
    return (
      <TouchableOpacity 
        style={styles.suggestionItem} 
        onPress={() => selectSearchResult(item)}
      >
        <Text style={styles.suggestionText}>{mainName}</Text>
        {typeLabel && <Text style={styles.suggestionType}>{typeLabel}</Text>}
        {locationStr && (
          <Text style={styles.suggestionSubtext} numberOfLines={1} ellipsizeMode="tail">
            {locationStr}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // Fonction pour obtenir un libellé en français pour le type de lieu
  const getTypeLabel = (type: string, itemClass: string): string => {
    const typeLabels: Record<string, string> = {
      'suburb': 'Quartier',
      'neighbourhood': 'Voisinage',
      'quarter': 'Quartier',
      'locality': 'Localité',
      'hamlet': 'Hameau',
      'village': 'Village',
      'town': 'Ville',
      'city': 'Ville',
      'administrative': 'Zone administrative',
      'district': 'District',
      'region': 'Région',
      'county': 'Comté'
    };

    return typeLabels[type] || '';
  };

  // Calculate the top position for suggestionsContainer dynamically
  const suggestionsContainerStyle = {
    ...styles.suggestionsContainer,
    top: showVillageInput ? 185 : 130,
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#007AFF" barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes destinations</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setShowVillageInput(!showVillageInput)}
        >
          <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {showVillageInput && (
        <View style={styles.villageInputContainer}>
          <TextInput
            style={styles.villageInput}
            placeholder="Entrez le nom de votre village/ville"
            value={village}
            onChangeText={setVillage}
            returnKeyType="done"
          />
          <Text style={styles.villageHelp}>
            Précisez votre village pour des résultats plus précis
          </Text>
        </View>
      )}
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Rechercher un quartier..."
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (searchResults.length > 0) {
              selectSearchResult(searchResults[0]);
            } else if (searchText.trim()) {
              addItem(searchText);
            }
          }}
        />
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            if (searchText.trim()) {
              addItem(searchText);
            }
          }}
          disabled={!searchText.trim()}
        >
          <Ionicons 
            name="checkmark-circle" 
            size={28} 
            color={searchText.trim() ? "#007AFF" : "#CCCCCC"} 
          />
        </TouchableOpacity>
      </View>
      
      {searchText.length > 0 && (
        <View style={suggestionsContainerStyle}>
          {isLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loaderText}>Recherche en cours...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={24} color="#FF3B30" />
              <Text style={styles.errorText}>
                Erreur de recherche. Veuillez réessayer.
              </Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.emptyResultsContainer}>
              <Text style={styles.emptyResultsText}>
                Aucun destination trouvé pour "{searchText}"
              </Text>
              <TouchableOpacity 
                style={styles.addManualButton}
                onPress={() => addItem(searchText)}
              >
                <Text style={styles.addManualButtonText}>
                  Ajouter manuellement
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item: NominatimResult) => `place-${item.place_id}`}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={true}
              nestedScrollEnabled={true}
              maxToRenderPerBatch={10}
              windowSize={5}
            />
          )}
        </View>
      )}
      
      <FlatList
        data={listItems}
        renderItem={renderItem}
        keyExtractor={(item: ListItem) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContentContainer,
          listItems.length === 0 && styles.emptyListContentContainer
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={48} color="#CCCCCC" />
            <Text style={styles.emptyText}>
              Aucun quartier ajouté
            </Text>
            <Text style={styles.emptySubText}>
              Recherchez et ajoutez des quartiers de Madagascar
            </Text>
          </View>
        }
      />
      
      {/* Footer avec les boutons d'action */}
      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => handleNavigateMap()}
        >
          <Ionicons name="map" size={24} color="#FFFFFF" />
          <Text style={styles.footerButtonText}>
            Voir la carte
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.footerButton, styles.routeButton]}
          onPress={() => handleClickItineraires()}
        >
          <Ionicons name="git-branch-outline" size={24} color="#FFFFFF" />
          <Text style={styles.footerButtonText}>
            Mes itinéraires
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Overlay de chargement Gemini */}
      {geminiLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Génération de l'itinéraire...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F6FF',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  settingsButton: {
    padding: 5,
  },
  villageInputContainer: {
    backgroundColor: '#E1EAFF',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#D0DCFF',
  },
  villageInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#BBCAEF',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  villageHelp: {
    fontSize: 12,
    color: '#6688CC',
    marginTop: 5,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 25,
    paddingHorizontal: 20,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  addButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
    height: 50,
    marginLeft: 10,
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
    // top property removed from here and applied dynamically
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  suggestionType: {
    fontSize: 12,
    color: '#007AFF',
    backgroundColor: '#E6F2FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionSubtext: {
    fontSize: 14,
    color: '#777',
    marginTop: 2,
  },
  loaderContainer: {
    padding: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loaderText: {
    marginLeft: 10,
    color: '#555',
    fontSize: 14,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  errorText: {
    marginLeft: 10,
    color: '#FF3B30',
    fontSize: 14,
  },
  emptyResultsContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyResultsText: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginBottom: 10,
  },
  addManualButton: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 15,
  },
  addManualButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  list: {
    flex: 1,
    marginTop: 10,
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  emptyListContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  listItem: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listItemContent: {
    flex: 1,
  },
  listItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  listItemSubtext: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },
  listItemCoords: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  confirmDeleteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#E5E5EA',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 15,
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: '#BBB',
    textAlign: 'center',
  },
  // Nouveaux styles pour le footer avec les boutons
  footerContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  footerButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  routeButton: {
    backgroundColor: '#34C759',
    marginRight: 0,
    marginLeft: 8,
  },
  footerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Styles pour l'overlay de chargement
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    width: width * 0.8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
});