import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Text, 
  Dimensions, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRoute } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

// Définition des types pour les éléments de la liste
interface ListItem {
  id: string;
  text: string;
  fullName?: string;
  lat?: string;
  lon?: string;
}

// Interface pour les paramètres de route
interface RouteParams {
  items?: string;
}

const MapScreen = () => {
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);
  const footerHeight = useRef(new Animated.Value(0.35 * height)).current;
  
  const [region, setRegion] = useState<Region>({
    latitude: 48.8566,
    longitude: 2.3522,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Récupération des paramètres de route
  const route = useRoute();
  const params = route.params as RouteParams;

  useEffect(() => {
    if (params && params.items) {
      try {
        // Parser les éléments JSON
        const parsedItems: any[] = JSON.parse(decodeURIComponent(params.items));
        
        // Mapper les éléments en format ListItem
        const formattedItems = parsedItems.map((item) => ({
          id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
          text: item.text,
          fullName: item.fullName || item.text,
          lat: item.lat,
          lon: item.lon
        }));
        
        setListItems(formattedItems);
        
        // Centrer la carte sur les éléments s'ils ont des coordonnées
        const itemsWithCoords = formattedItems.filter(item => item.lat && item.lon);
        if (itemsWithCoords.length > 0) {
          fitMapToMarkers(itemsWithCoords);
        }
      } catch (error) {
        console.error("Erreur lors de l'analyse des éléments:", error);
        Alert.alert("Erreur", "Impossible de charger les éléments.");
      }
    }
    
    // Obtenir la position actuelle de l'utilisateur
    getCurrentLocation();
  }, [params]);

  // Obtenir la position actuelle de l'utilisateur
  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } catch (error) {
      console.error("Erreur de localisation:", error);
    } finally {
      setLoading(false);
    }
  };

  // Ajuster la carte pour montrer tous les marqueurs
  const fitMapToMarkers = (items: ListItem[]) => {
    if (mapRef.current && items.length > 0) {
      const coordinates = items
        .filter(item => item.lat && item.lon)
        .map(item => ({
          latitude: parseFloat(item.lat!),
          longitude: parseFloat(item.lon!)
        }));
      
      if (coordinates.length > 0) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(coordinates, {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true
          });
        }, 500);
      }
    }
  };

  // Centrer la carte sur un marqueur spécifique avec animation améliorée
  const focusMarker = (item: ListItem) => {
    if (item.lat && item.lon) {
      const latitude = parseFloat(item.lat);
      const longitude = parseFloat(item.lon);
      
      // Vérifier si les coordonnées sont valides
      if (!isNaN(latitude) && !isNaN(longitude)) {
        // D'abord mettre à jour l'état selectedItem
        setSelectedItem(item.id);
        
        // Ajouter un petit délai pour s'assurer que la carte est prête
        setTimeout(() => {
          // Animation plus fluide avec animateToRegion
          mapRef.current?.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: 0.005, // Zoom plus précis
            longitudeDelta: 0.005,
          }, 500); // Durée de l'animation en ms
        }, 100);
      }
    }
  };
  // Fonction pour basculer l'affichage de la liste
  const toggleListView = () => {
    setExpanded(!expanded);
    Animated.timing(footerHeight, {
      toValue: expanded ? 0.35 * height : 0.65 * height,
      duration: 300,
      useNativeDriver: false
    }).start();
  };

  // Rendu d'un élément de la liste
  const renderItem = ({ item }: { item: ListItem }): React.ReactElement => (
    <TouchableOpacity 
      style={[
        styles.listItem,
        selectedItem === item.id && styles.selectedListItem
      ]}
      onPress={() => focusMarker(item)}
    >
      <View style={styles.listItemContent}>
        <Ionicons 
          name="location" 
          size={22} 
          color={selectedItem === item.id ? "#FFFFFF" : "#007AFF"} 
          style={styles.locationIcon}
        />
        <View style={styles.textContainer}>
          <Text 
            style={[
              styles.listItemText, 
              selectedItem === item.id && styles.selectedItemText
            ]}
            numberOfLines={1}
          >
            {item.text}
          </Text>
          {item.fullName !== item.text && (
            <Text 
              style={[
                styles.listItemSubtext,
                selectedItem === item.id && styles.selectedItemText
              ]}
              numberOfLines={1}
            >
              {item.fullName}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const getMapHeight = () => {
    // Calcul dynamique de la hauteur de la carte basée sur la hauteur du footer
    return { height: Animated.subtract(new Animated.Value(height), footerHeight) };
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Chargement de la carte...</Text>
        </View>
      ) : (
        <Animated.View style={[styles.mapContainer, getMapHeight()]}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={region}
            onRegionChangeComplete={setRegion}
            showsUserLocation
            showsMyLocationButton
            showsCompass
          >
            {/* Marqueurs pour chaque élément de la liste */}
            {listItems.map((item) => {
              if (item.lat && item.lon) {
                const latitude = parseFloat(item.lat);
                const longitude = parseFloat(item.lon);
                
                if (!isNaN(latitude) && !isNaN(longitude)) {
                  return (
                    <Marker
                      key={item.id}
                      coordinate={{
                        latitude,
                        longitude
                      }}
                      title={item.text}
                      description={item.fullName}
                      pinColor={selectedItem === item.id ? "#FF9500" : "#007AFF"}
                      onPress={() => setSelectedItem(item.id)}
                    />
                  );
                }
              }
              return null;
            })}
          </MapView>
        </Animated.View>
      )}

      <Animated.View style={[styles.footerContainer, { height: footerHeight }]}>
        {/* Bouton pour basculer l'affichage de la liste */}
        <TouchableOpacity 
          style={styles.expandButton}
          onPress={toggleListView}
        >
          <Ionicons 
            name={expanded ? "chevron-down" : "chevron-up"} 
            size={22} 
            color="#777777" 
          />
        </TouchableOpacity>

        {/* Bouton pour centrer la carte sur les marqueurs */}
        {listItems.length > 0 && (
          <TouchableOpacity 
            style={styles.fitButton}
            onPress={() => fitMapToMarkers(listItems)}
          >
            <Ionicons name="expand-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        
        {/* Liste des quartiers */}
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>
            {listItems.length > 0 
              ? `Quartiers (${listItems.length})` 
              : "Aucun quartier ajouté"}
          </Text>
          
          <FlatList
            data={listItems}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={[
              styles.listContentContainer,
              listItems.length === 0 && styles.emptyListContainer
            ]}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={48} color="#CCCCCC" />
                <Text style={styles.emptyText}>
                  Aucun quartier à afficher
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F6FF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F6FF',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#007AFF',
  },
  mapContainer: {
    width: width,
    backgroundColor: '#F0F6FF',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  footerContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingTop: 25,
    paddingBottom: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  expandButton: {
    position: 'absolute',
    top: 5,
    alignSelf: 'center',
    width: 60,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  fitButton: {
    position: 'absolute',
    top: -20,
    right: 20,
    backgroundColor: '#007AFF',
    borderRadius: 30,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 1,
  },
  listContainer: {
    flex: 1,
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    marginLeft: 5,
  },
  list: {
    flex: 1,
  },
  listContentContainer: {
    paddingBottom: 5,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  listItem: {
    backgroundColor: '#F8F8F8',
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  selectedListItem: {
    backgroundColor: '#007AFF',
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationIcon: {
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
  },
  listItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  listItemSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  selectedItemText: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 15,
    textAlign: 'center',
  }
});

export default MapScreen;