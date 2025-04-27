import { Link } from "expo-router";
import { Image, StyleSheet, Text, View, Dimensions, SafeAreaView, TouchableOpacity } from "react-native";

export default function Index() {
  return (
    <View style={styles.mainContainer}>
      {/* Background Image - fond bleu */}
      <Image
        source={require("../assets/images/bg.png")}
        style={styles.backgroundImage}
      />
      
      <SafeAreaView style={styles.contentContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>OPTIMISER VOS LIVRAISONS AVEC</Text>
          <Text style={styles.appName}>MyRoutine</Text>
        </View>
        
        <View style={styles.illustrationContainer}>
          {/* Image avec fond blanc nécessite un traitement spécial */}
          <View style={styles.imageWrapper}>
            <Image
              source={require("../assets/images/illustrator_1.png")}
              style={styles.illustration}
            />
          </View>
        </View>
        
        <View style={styles.container}>
          <Text style={styles.content}>
            Grâce à l'intelligence artificielle, obtenez des itinéraires optimisés en fonction du trafic de livraison.
          </Text>
        </View>
        
        {/* Bouton Commencer */}
        <Link href="/ListView" style={styles.buttonContainer} onPress={() => console.log('Commencer pressed')}>
          <Text style={styles.buttonText}>COMMENCER</Text>
        </Link>
      </SafeAreaView>
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    width: width,
    height: height,
    resizeMode: 'cover',
  },
  contentContainer: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#FFFFFF", // Texte blanc pour contraster avec fond bleu
  },
  appName: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF", // Couleur blanche pour ressortir sur fond bleu
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 1,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  imageWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  illustration: {
    width: width * 0.85,
    height: width * 0.65,
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF', // Confirme le fond blanc de l'image
  },
  container: {
    alignItems: "center",
    paddingHorizontal: 15,
  },
  content: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 26,
    color: "#FFFFFF", // Texte blanc pour contraster avec fond bleu
    backgroundColor: "rgba(255, 255, 255, 0.15)", // Fond légèrement transparent
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  // Styles pour le bouton Commencer
  buttonContainer: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    alignSelf: "center",
    marginTop: 40,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: "#007AFF", // Bleu pour correspondre à la couleur de votre thème
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 1,
  }
});