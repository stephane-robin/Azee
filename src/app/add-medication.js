import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { getDatabase } from '../database/db';
import { couleurFond, bleuPrincipal, bleuSecondaire, transparent, grisIntermediaire, grisSombre, grisClair } from '../constants/colors';

export default function AddMedicationScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [posologie, setPosologie] = useState('');
  const [morning, setMorning] = useState(true);
  const [noon, setNoon] = useState(false);
  const [evening] = useState(true);
  const [eveningState, setEveningState] = useState(true);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir le nom du médicament.');
      return;
    }

    if (!morning && !noon && !eveningState) {
      Alert.alert('Erreur', 'Sélectionnez au moins un moment de prise.');
      return;
    }

    const db = getDatabase();
    const startDate = new Date().toISOString().split('T')[0];

    await db.runAsync(
      `INSERT INTO medications (name, duration_days, start_date, take_morning, take_noon, take_evening, posologie) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(), 
        parseInt(duration, 10) || 1, 
        startDate, 
        morning ? 1 : 0, 
        noon ? 1 : 0, 
        eveningState ? 1 : 0,
        posologie.trim()
      ]
    );

    router.back();
  };
  

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.titre}>Nouveau Médicament</Text>
      <Text style={styles.label}>Nom du médicament</Text>
      <View style={styles.inputContainer}>
        <TextInput 
            style={styles.input} 
            placeholder="Ex: Paracétamol" 
            value={name} 
            onChangeText={setName} 
            autoCorrect={false}  
            spellCheck={false}
        />
      </View>
      <Text style={styles.label}>Durée du traitement (jours)</Text>
      <View style={styles.inputContainer}>
        <TextInput 
            style={styles.input} 
            keyboardType="numeric" 
            placeholder="Ex: 7" 
            value={duration} 
            onChangeText={setDuration} 
        />
      </View>

      <Text style={styles.label}>Fréquence de prise</Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Matin</Text>
        <Switch value={morning} onValueChange={setMorning} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Midi</Text>
        <Switch value={noon} onValueChange={setNoon} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Soir</Text>
        <Switch value={eveningState} onValueChange={setEveningState} />
      </View>

      <Text style={styles.label}>Posologie</Text>
      <View style={styles.inputContainer}>
        <TextInput 
            style={styles.input} 
            placeholder="Ex: Application cutanée." 
            value={posologie} 
            onChangeText={setPosologie} 
        />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Enregistrer</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding:10,
    backgroundColor: couleurFond, 
  },
  scrollContent: { 
    padding: 16, 
    paddingBottom: 320
  },
  titre:{
    fontSize: 20,
    fontWeight: '600',
    color: bleuPrincipal,
    textAlign: 'center'
  },
  label: { 
    fontSize: 16, 
    fontWeight: '600', 
    marginTop: 16, 
    marginBottom: 6 
  },
  inputContainer: {
    backgroundColor: '#fff', 
    borderRadius: 25,        
    // Ombres iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    // Ombre Android
    elevation: 6,
    marginVertical: 8,       
    shadowColor: bleuPrincipal
  },
  input: { 
    baskgroundColor: '#fff',
    borderRadius: 25, 
    padding: 12, 
    fontSize: 16,
    overflow:'hidden',    
  },
  switchRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginVertical: 8 
  },
  switchLabel: { 
    fontSize: 16 
  },
  saveBtn: { 
    backgroundColor: bleuPrincipal, 
    padding: 14, 
    borderRadius: 25, 
    alignItems: 'center', 
    marginTop: 22 
  },
  saveBtnText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  }
});