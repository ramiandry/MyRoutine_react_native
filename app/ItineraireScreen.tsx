import { useState, useEffect } from 'react';
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
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as IntentLauncher from 'expo-intent-launcher'; // Pour Android
import * as WebBrowser from 'expo-web-browser'; // Pour iOS
import { useRoute } from '@react-navigation/native';

// Interface pour les points de l'itinéraire
interface AddressItem {
  id: string;
  to: string;
  from: string;
  duration?: string;
  distance?: string;
}

// Interface pour les paramètres de route
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
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [dataProcessed, setDataProcessed] = useState<boolean>(false);

  useEffect(() => {
    // Éviter le retraitement des données
    if (dataProcessed) return;
    
    try {
      // Récupérer les données depuis les deux sources possibles
      let itemsData = '';
      
      // Collecte des informations de débogage
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
            const validAddresses = parsedItems.map((item, index) => {
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
      
      // Enregistrer les infos de débogage
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
      // Marquer les données comme traitées
      setDataProcessed(true);
    }
  }, [routeParams, localParams, dataProcessed]); 

  // Fonction pour générer le contenu HTML du PDF avec un design amélioré
  const generatePdfHtml = () => {
    const totalDistance = calculateTotalDistance();
    const totalDuration = calculateTotalDuration();
    const currentDate = new Date().toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // En-tête du document HTML
    let html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Itinéraire Madagascar</title>
        <style>
          body {
            font-family: 'Helvetica', Arial, sans-serif;
            margin: 40px;
            color: #333333;
            line-height: 1.6;
          }
          .header {
            margin-bottom: 30px;
          }
          .logo {
            font-size: 14px;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
          }
          .title {
            color: #007AFF;
            font-size: 26px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .export-date {
            color: #666666;
            font-size: 12px;
            margin-bottom: 20px;
          }
          .summary {
            background-color: #F5F9FF;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
            border: 1px solid #E0E9FF;
          }
          .summary-title {
            font-size: 16px;
            font-weight: bold;
            color: #007AFF;
            margin-bottom: 10px;
          }
          .summary-grid {
            display: flex;
            justify-content: space-between;
          }
          .summary-item {
            flex: 1;
          }
          .summary-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 3px;
          }
          .summary-value {
            font-size: 18px;
            font-weight: bold;
            color: #333;
          }
          .separator {
            height: 1px;
            background-color: #E0E9FF;
            margin: 30px 0;
          }
          .route-title {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 20px;
          }
          .route-segment {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          .address-row {
            display: flex;
            align-items: center;
            margin-bottom: 5px;
          }
          .circle {
            width: 24px;
            height: 24px;
            background-color: #007AFF;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
            font-size: 12px;
            font-weight: bold;
            margin-right: 15px;
          }
          .address-name {
            font-size: 16px;
            font-weight: 500;
          }
          .connection {
            display: flex;
            margin: 8px 0;
          }
          .vertical-line {
            width: 2px;
            height: 40px;
            background-color: #E0E9FF;
            margin-left: 11px;
          }
          .distance-info {
            margin-left: 25px;
            background-color: #F5F9FF;
            padding: 10px 15px;
            border-radius: 6px;
            font-size: 14px;
            color: #555;
            border: 1px solid #E0E9FF;
          }
          .distance-value, .duration-value {
            font-weight: bold;
            color: #007AFF;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #E0E9FF;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Voyage à Madagascar</div>
          <div class="title">Itinéraire de Voyage</div>
          <div class="export-date">Document généré le ${currentDate}</div>
        </div>
        
        <div class="summary">
          <div class="summary-title">Résumé du trajet</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Destinations</div>
              <div class="summary-value">${addresses.length + 1}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Distance totale</div>
              <div class="summary-value">${totalDistance} km</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Durée estimée</div>
              <div class="summary-value">${totalDuration} min</div>
            </div>
          </div>
        </div>
        
        <div class="route-title">Détails de l'itinéraire</div>
    `;
    
    // Générer chaque segment de route avec un style amélioré
    addresses.forEach((address, index) => {
      const fromText = address?.from ? address.from.split(',')[0] : 'Unknown';
      const toText = address?.to ? address.to.split(',')[0] : 'Unknown';
      
      html += `
        <div class="route-segment">
          <div class="address-row">
            <div class="circle">${index + 1}</div>
            <div class="address-name">${fromText}</div>
          </div>
          
          <div class="connection">
            <div class="vertical-line"></div>
            <div class="distance-info">
              <div>Distance: <span class="distance-value">${address.distance || 'N/A'}</span></div>
              <div>Durée: <span class="duration-value">${address.duration || 'N/A'}</span></div>
            </div>
          </div>
          
          <div class="address-row">
            <div class="circle">${index + 2}</div>
            <div class="address-name">${toText}</div>
          </div>
        </div>
        
        ${index < addresses.length - 1 ? '<div class="separator"></div>' : ''}
      `;
    });
    
    // Pied de page et fermeture du document HTML
    html += `
        <div class="footer">
          © ${new Date().getFullYear()} - Itinéraire Madagascar - Tous droits réservés
        </div>
      </body>
      </html>
    `;
    
    return html;
  };

  // Fonction pour ouvrir un fichier PDF selon la plateforme
  const openPDF = async (filePath: string) => {
    try {
      if (Platform.OS === 'ios') {
        // Sur iOS, utiliser WebBrowser pour ouvrir le PDF
        await WebBrowser.openBrowserAsync(`file://${filePath}`);
        
      } else if (Platform.OS === 'android') {
        // Sur Android, utiliser IntentLauncher pour ouvrir le PDF avec l'application par défaut
        const contentUri = await FileSystem.getContentUriAsync(filePath);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/pdf',
        });
      } else {
        // Pour d'autres plateformes (web, etc.), essayer de partager le fichier
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath);
        } else {
          console.warn('Sharing is not available on this platform');
        }
      }
    } catch (error) {
      console.error("Error opening PDF:", error);
      // Si l'ouverture automatique échoue, proposer à l'utilisateur de partager le fichier
      if (await Sharing.isAvailableAsync()) {
        Alert.alert(
          "Impossible d'ouvrir le PDF",
          "Voulez-vous le partager à la place ?",
          [
            { text: "Annuler", style: "cancel" },
            { 
              text: "Partager", 
              onPress: () => Sharing.shareAsync(filePath)
            }
          ]
        );
      } else {
        Alert.alert(
          "Erreur",
          "Impossible d'ouvrir ou de partager le PDF. Le fichier a été enregistré dans le dossier des documents."
        );
      }
    }
  };

  // Fonction améliorée pour créer et partager le PDF
  const exportToPDF = async () => {
    try {
      setExportLoading(true);
      
      // Générer le HTML pour le PDF
      const htmlContent = generatePdfHtml();
      
      // Options avancées pour la génération du PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
        width: 595.28, // Largeur A4 en points (72dpi)
        height: 841.89, // Hauteur A4 en points (72dpi)
        margins: {
          left: 40,
          top: 40,
          right: 40,
          bottom: 40
        }
      });
      
      // Stocker l'URI du PDF généré
      setPdfUri(uri);
      
      // Créer un nom de fichier avec timestamp pour éviter les doublons
      const timestamp = new Date().getTime();
      const fileName = `itineraire_madagascar_${timestamp}.pdf`;
      
      // Définir le chemin de destination pour un stockage permanent
      const destinationPath = FileSystem.documentDirectory + fileName;
      
      // Copier le fichier du cache vers le répertoire permanent
      await FileSystem.copyAsync({
        from: uri,
        to: destinationPath
      });
      
      // Supprimer le fichier temporaire pour économiser de l'espace
      await FileSystem.deleteAsync(uri, { idempotent: true });
      
      console.log(`PDF enregistré à: ${destinationPath}`);
      
      // Informer l'utilisateur et ouvrir le PDF
      Alert.alert(
        "Exportation réussie",
        "Le PDF a été enregistré avec succès. Ouverture du document...",
        [{ text: "OK" }]
      );
      
      // Ouvrir le PDF automatiquement
      await openPDF(destinationPath);
      
    } catch (error:any) {
      console.error("Erreur lors de l'exportation du PDF:", error);
      Alert.alert(
        "Erreur",
        `Impossible d'enregistrer l'itinéraire en PDF: ${error?.message}`
      );
    } finally {
      setExportLoading(false);
    }
  };

  // Fonction pour partager directement le PDF sans l'enregistrer
  const sharePDF = async () => {
    try {
      setExportLoading(true);
      
      // Générer le HTML et créer le PDF temporaire
      const htmlContent = generatePdfHtml();
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });
      
      // Vérifier si le partage est disponible
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Partager votre itinéraire',
          UTI: 'com.adobe.pdf' // Pour iOS
        });
      } else {
        Alert.alert(
          "Partage indisponible", 
          "Le partage de fichiers n'est pas disponible sur cet appareil."
        );
      }
      
      // Nettoyer le fichier temporaire après partage
      await FileSystem.deleteAsync(uri, { idempotent: true });
      
    } catch (error:any) {
      console.error("Erreur lors du partage du PDF:", error);
      Alert.alert(
        "Erreur",
        `Impossible de partager l'itinéraire: ${error?.message}`
      );
    } finally {
      setExportLoading(false);
    }
  };

  const renderRouteSegment = ({ item, index } : {item : AddressItem, index : number}) => (
    <View style={styles.routeContainer}>
      {/* Point de départ */}
      <View style={styles.addressContainer}>
        <View style={styles.addressCircle}>
          <Text style={styles.addressNumber}>{index + 1}</Text>
        </View>
        <View style={styles.addressContent}>
          <Text style={styles.addressName}>{item?.to ? item.to.split(',')[0] : 'Unknown'}</Text>
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
          <Text style={styles.addressName}>{item?.from ? item.from.split(',')[0] : 'Unknown'}</Text>
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
            {/* Bouton pour exporter et ouvrir le PDF */}
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
                  <Text style={styles.footerButtonText}>Enregistrer et ouvrir PDF</Text>
                </>
              )}
            </TouchableOpacity>
            
            {/* Bouton pour partager directement le PDF */}
            <TouchableOpacity
              style={[
                styles.shareButton, 
                (!addresses || !Array.isArray(addresses) || addresses.length === 0) ? styles.disabledButton : {}
              ]}
              onPress={sharePDF}
              disabled={exportLoading || !addresses || !Array.isArray(addresses) || addresses.length === 0}
            >
              <Ionicons name="share-outline" size={22} color="#FFFFFF" />
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
    marginBottom: 2,
  },
  durationText: {
    fontSize: 12,
    color: '#666',
  },
  segmentSeparator: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginTop: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#555',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#555',
    marginVertical: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    maxWidth: width * 0.8,
  },
  debugButton: {
    marginTop: 30,
    padding: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 5,
  },
  debugButtonText: {
    color: '#666',
    fontSize: 12,
  },
  footerContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  footerButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  shareButton: {
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    width: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  footerButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#B0C4DE',
    opacity: 0.7,
  }
});