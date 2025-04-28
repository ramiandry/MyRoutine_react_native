import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
  Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { PDFDocument, PDFPage } from 'react-native-pdf-lib';
import * as Sharing from 'expo-sharing';
import { useRoute } from '@react-navigation/native';

// Using the provided interface definition
interface AddressItem {
  id: string;
  to: string;
  from: string;
  duration?: string;
  distance?: string;
}

// Define the route params interface
interface RouteParams {
  items: string;
}

export default function ItineraireScreen(): React.ReactElement {
  const localParams = useLocalSearchParams();
  const route = useRoute();
  const routeParams = route.params as RouteParams | undefined;
  const [loading, setLoading] = useState<boolean>(true);
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    try {
      // Récupérer les données depuis les deux sources possibles
      let itemsData = '';
      
      // Debug information collection
      let debugData = 'Checking data sources:\n';
      
      // Essayer de récupérer depuis route.params
      if (routeParams?.items) {
        itemsData = routeParams.items;
        debugData += `- Route params found: ${itemsData.substring(0, 50)}...\n`;
      } else {
        debugData += '- No data in route.params\n';
      }
      
      // Si rien dans route.params, essayer useLocalSearchParams
      if (!itemsData && localParams?.items) {
        itemsData = localParams.items as string;
        debugData += `- Local params found: ${itemsData.substring(0, 50)}...\n`;
      } else if (!itemsData) {
        debugData += '- No data in localParams\n';
      }
      
      // Si on a des données, tenter de les parser
      if (itemsData) {
        try {
          // Essayer de décoder l'URL si nécessaire
          let decodedItems = itemsData;
          if (itemsData.includes('%')) {
            try {
              decodedItems = decodeURIComponent(itemsData);
              debugData += `- Successfully decoded URI component\n`;
            } catch (decodeError) {
              debugData += `- Error decoding URI: ${decodeError}\n`;
              // Continuer avec les données d'origine
              decodedItems = itemsData;
            }
          }
          
          // Essayer différentes méthodes de parsing
          let parsedItems;
          try {
            parsedItems = JSON.parse(decodedItems);
            debugData += `- Successfully parsed JSON\n`;
          } catch (jsonError) {
            debugData += `- JSON parse failed: ${jsonError}\n`;
            
            // Essayer de traiter les données comme un tableau directement
            if (typeof decodedItems === 'object') {
              parsedItems = decodedItems;
              debugData += `- Data is already an object, using directly\n`;
            }
          }
          
          // Vérifier si parsedItems est un tableau
          if (parsedItems && Array.isArray(parsedItems)) {
            debugData += `- Data is an array with ${parsedItems.length} items\n`;
            
            // Valider et traiter chaque item
            const validAddresses = parsedItems.map((item: any, index: number) => {
              debugData += `- Processing item ${index}: ${JSON.stringify(item).substring(0, 50)}...\n`;
              
              return {
                id: item.id || String(Math.random()),
                from: item.from || 'Unknown location',
                to: item.to || 'Unknown location',
                duration: item.duration || 'N/A',
                distance: item.distance || 'N/A'
              };
            });
            
            debugData += `- Generated ${validAddresses.length} valid address items\n`;
            setAddresses(validAddresses);
          } else if (parsedItems && typeof parsedItems === 'object') {
            // Si c'est un objet unique, le mettre dans un tableau
            debugData += `- Data is a single object, converting to array\n`;
            const validAddress = {
              id: parsedItems.id || String(Math.random()),
              from: parsedItems.from || 'Unknown location',
              to: parsedItems.to || 'Unknown location',
              duration: parsedItems.duration || 'N/A',
              distance: parsedItems.distance || 'N/A'
            };
            setAddresses([validAddress]);
          } else {
            debugData += `- Failed to process data: not an array or object\n`;
            console.error("Parsed items is not an array or object:", parsedItems);
            setAddresses([]);
            Alert.alert(
              "Format Error",
              "The route data is not in the expected format"
            );
          }
        } catch (parseError) {
          debugData += `- Error processing data: ${parseError}\n`;
          console.error("Error parsing items:", parseError);
          setAddresses([]);
          Alert.alert(
            "Parse Error",
            "Failed to parse the route data"
          );
        }
      } else {
        debugData += `- No data found in any parameter source\n`;
        console.warn("No items found in params");
        setAddresses([]);
      }
      
      // Save debug info for display
      setDebugInfo(debugData);
      
    } catch (error) {
      console.error("Erreur lors du chargement de l'itinéraire:", error);
      setDebugInfo(`Fatal error: ${error}`);
      Alert.alert(
        "Erreur",
        "Impossible de charger l'itinéraire. Veuillez réessayer.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  }, [routeParams, localParams]);

  // Fonction pour créer et exporter le PDF
  const exportToPDF = async () => {
    try {
      setExportLoading(true);

      // Créer un nouveau document PDF
      const pdfDoc = await PDFDocument.create();
      
      // Ajouter une page
      const page = PDFPage.create()
        .setMediaBox(595.28, 841.89); // Format A4
      
      // Titre
      page.drawText('Itinéraire Madagascar', {
        x: 50,
        y: 800,
        color: '#007AFF',
        fontSize: 24
      });
      
      // Date d'exportation
      const today = new Date();
      page.drawText(`Exporté le ${today.toLocaleDateString()}`, {
        x: 50,
        y: 770,
        color: '#666666',
        fontSize: 12
      });
      
      // Résumé
      page.drawText(`Nombre de destinations: ${addresses.length + 1}`, {
        x: 50,
        y: 740,
        fontSize: 14
      });
      
      page.drawText(`Distance totale: ${calculateTotalDistance()} km`, {
        x: 50,
        y: 720,
        fontSize: 14
      });
      
      page.drawText(`Durée estimée: ${calculateTotalDuration()} min`, {
        x: 50,
        y: 700,
        fontSize: 14
      });
      
      // Séparateur
      page.drawLine({
        x1: 50,
        y1: 680, 
        x2: 545,
        y2: 680,
        color: '#CCCCCC'
      });
      
      // Détails de l'itinéraire
      let yPosition = 650;
      
      addresses.forEach((address, index) => {
        // Déterminer s'il reste assez d'espace pour ce segment
        // Si non, créer une nouvelle page
        if (yPosition < 100) {
          pdfDoc.addPage(page);
          yPosition = 800;
        }
        
        // Point numéro
        page.drawCircle(60, yPosition, 10, { color: '#007AFF', fill: true });
        page.drawText(`${index + 1}`, {
          x: 56,
          y: yPosition - 3,
          color: '#FFFFFF',
          fontSize: 12
        });
        
        // Adresse de départ
        const fromText = address?.from ? address.from.split(',')[0] : 'Unknown';
        page.drawText(fromText, {
          x: 80, 
          y: yPosition,
          fontSize: 14
        });
        
        // Ligne verticale
        page.drawLine({
          x1: 60,
          y1: yPosition - 10,
          x2: 60,
          y2: yPosition - 40,
          color: '#CCCCCC'
        });
        
        // Distance et durée
        page.drawText(`Distance: ${address.distance || 'N/A'} | Durée: ${address.duration || 'N/A'}`, {
          x: 80,
          y: yPosition - 25,
          fontSize: 12,
          color: '#666666'
        });
        
        // Point numéro suivant
        page.drawCircle(60, yPosition - 50, 10, { color: '#007AFF', fill: true });
        page.drawText(`${index + 2}`, {
          x: 56,
          y: yPosition - 53,
          color: '#FFFFFF',
          fontSize: 12
        });
        
        // Adresse d'arrivée
        const toText = address?.to ? address.to.split(',')[0] : 'Unknown';
        page.drawText(toText, {
          x: 80,
          y: yPosition - 50,
          fontSize: 14
        });
        
        // Mise à jour de la position Y pour le prochain segment
        yPosition -= 80;
      });
      
      // Ajouter la page au document
      pdfDoc.addPage(page);
      
      // Créer le chemin de fichier temporaire
      const pdfPath = `${FileSystem.cacheDirectory}itineraire_madagascar.pdf`;
      
      // Sauvegarder le PDF dans le système de fichiers
      const pdfBytes = await pdfDoc.save();
      await FileSystem.writeAsStringAsync(pdfPath, pdfBytes, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      // Partager le PDF
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(pdfPath, {
            mimeType: 'application/pdf',
            dialogTitle: 'Partager votre itinéraire'
          });
        } else {
          Alert.alert(
            "Partage indisponible",
            "Le partage n'est pas disponible sur votre appareil"
          );
        }
      } else {
        // Pour les plateformes web ou autres
        Alert.alert(
          "Exportation terminée",
          "Le PDF a été généré avec succès"
        );
      }
    } catch (error) {
      console.error("Erreur lors de l'exportation du PDF:", error);
      Alert.alert(
        "Erreur",
        "Impossible d'exporter l'itinéraire en PDF"
      );
    } finally {
      setExportLoading(false);
    }
  };

  const renderRouteSegment = ({ item, index }: { item: AddressItem, index: number }) => (
    <View style={styles.routeContainer}>
      {/* Point de départ */}
      <View style={styles.addressContainer}>
        <View style={styles.addressCircle}>
          <Text style={styles.addressNumber}>{index + 1}</Text>
        </View>
        <View style={styles.addressContent}>
          <Text style={styles.addressName}>{item?.from ? item.from.split(',')[0] : 'Unknown'}</Text>
        </View>
      </View>
      
      {/* Ligne de connexion avec distance */}
      <View style={styles.connectionLine}>
        <View style={styles.verticalLine} />
        <View style={styles.distanceInfoContainer}>
          <Text style={styles.distanceText}>distance : {item.distance || 'N/A'}</Text>
          <Text style={styles.durationText}>durée estimée : {item.duration || 'N/A'}</Text>
        </View>
      </View>
      
      {/* Point d'arrivée */}
      <View style={styles.addressContainer}>
        <View style={styles.addressCircle}>
          <Text style={styles.addressNumber}>{index + 2}</Text>
        </View>
        <View style={styles.addressContent}>
          <Text style={styles.addressName}>{item?.to ? item.to.split(',')[0] : 'Unknown'}</Text>
        </View>
      </View>
      
      {/* Séparateur si ce n'est pas le dernier élément */}
      {index < addresses.length - 1 && (
        <View style={styles.segmentSeparator} />
      )}
    </View>
  );

  // Calcul des totaux pour l'affichage du résumé
  const calculateTotalDistance = () => {
    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) return 0;
    return addresses.reduce((total, item) => {
      const distance = parseInt(item.distance?.replace(/[^0-9]/g, '') || '0');
      return total + (isNaN(distance) ? 0 : distance);
    }, 0);
  };

  const calculateTotalDuration = () => {
    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) return 0;
    return addresses.reduce((total, item) => {
      const durationText = item.duration || '0';
      const durationMatch = durationText.match(/\d+/);
      const duration = durationMatch ? parseInt(durationMatch[0]) : 0;
      return total + (isNaN(duration) ? 0 : duration);
    }, 0);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#007AFF" barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon Itinéraire</Text>
        <TouchableOpacity style={styles.mapButton} onPress={() => {
          // Naviguer vers la carte avec tous les points
          if (addresses && addresses.length > 0) {
            const addressesString = JSON.stringify(addresses);
            router.push(`/MapScreen?items=${encodeURIComponent(addressesString)}&showRoute=true`);
          } else {
            Alert.alert("Aucun itinéraire", "Il n'y a pas de destinations à afficher sur la carte.");
          }
        }}>
          <Ionicons name="map-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Chargement de l'itinéraire...</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryItem}>
              <Ionicons name="flag-outline" size={20} color="#007AFF" />
              <Text style={styles.summaryText}>
                {addresses && Array.isArray(addresses) && addresses.length > 0 ? addresses.length + 1 : 1} destinations
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="speedometer-outline" size={20} color="#007AFF" />
              <Text style={styles.summaryText}>
                {calculateTotalDistance()} km
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="time-outline" size={20} color="#007AFF" />
              <Text style={styles.summaryText}>
                {calculateTotalDuration()} min
              </Text>
            </View>
          </View>
          
          {addresses && addresses.length > 0 ? (
            <FlatList
              data={addresses}
              renderItem={renderRouteSegment}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContentContainer}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="git-network-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyText}>
                Aucun itinéraire disponible
              </Text>
              <Text style={styles.emptySubText}>
                Ajoutez au moins deux destinations pour générer un itinéraire
              </Text>
              
              {/* Debug information - can be removed in production */}
              <TouchableOpacity 
                style={styles.debugButton}
                onPress={() => Alert.alert("Debug Info", debugInfo)}
              >
                <Text style={styles.debugButtonText}>Afficher les infos de débogage</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.footerContainer}>
            <TouchableOpacity
              style={[
                styles.footerButton, 
                (!addresses || !Array.isArray(addresses) || addresses.length === 0) ? styles.disabledButton : {}
              ]}
              onPress={exportToPDF}
              disabled={exportLoading || !addresses || !Array.isArray(addresses) || addresses.length === 0}
            >
              {exportLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.footerButtonText}>Exporter en PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
};
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
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: 5,
  },
  mapButton: {
    padding: 5,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#444',
    fontWeight: '500',
  },
  listContentContainer: {
    paddingVertical: 15,
  },
  routeContainer: {
    marginHorizontal: 15,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  addressCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  addressNumber: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  addressContent: {
    flex: 1,
  },
  addressName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  connectionLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    marginVertical: 3,
  },
  verticalLine: {
    width: 1,
    height: 30,
    backgroundColor: '#DDD',
    marginLeft: 14.5,
    position: 'absolute',
  },
  distanceInfoContainer: {
    marginLeft: 30,
    backgroundColor: '#F5F5F5',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flex: 1,
  },
  distanceText: {
    fontSize: 12,
    color: '#666',
  },
  durationText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  segmentSeparator: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginTop: 10,
  },
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
  },
  footerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#AAAAAA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
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
    marginBottom: 30,
  },
  debugButton: {
    backgroundColor: '#E5E5E5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 20,
  },
  debugButtonText: {
    color: '#666',
    fontSize: 12,
  },
});