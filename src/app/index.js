import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Modal, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from '../database/db';
import { couleurFond, bleuPrincipal, bleuSecondaire, transparent, grisIntermediaire, grisSombre, grisClair, rouge, vert } from '../constants/colors';

export default function HomeScreen() {
  const router = useRouter();
  const [now, setNow] = useState(new Date());
  const [medications, setMedications] = useState([]);
  const [logs, setLogs] = useState({});
  const [selectedMed, setSelectedMed] = useState(null);
  const [medLogs, setMedLogs] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isPosologyModalVisible, setIsPosologyModalVisible] = useState(false);
  const [isTermsModalVisible, setIsTermsModalVisible] = useState(true);

  /* === DATE D'AUJOURD'HUI === */
  const dateString = now.toISOString().split('T')[0];
  const [year, month, day] = dateString.split('-');
  const localDate = new Date(year, month - 1, day);
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  let formattedDate = localDate.toLocaleDateString('fr-FR', options);
  formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  
  /* === HORLOGE EN TEMPS REEL === */
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  /* === CHARGER LES MEDICAMENTS ET ETATS DES PRISES DE JOUR A PARTIR DE LA BDD === */
  const loadData = async () => {
    try{
      const db = await getDatabase();
      // charger les medicaments
      const meds = await db.getAllAsync('SELECT * FROM medications');
      setMedications(meds);
      // recuperer les etats des prises de tous les medicaments pour aujourd'hui
      const dailyLogs = await db.getAllAsync(
        'SELECT * FROM daily_logs WHERE date = ?',
        [dateString]
      );
      const logMap = {};
      dailyLogs.forEach((log) => {
        logMap[`${log.medication_id}_${log.slot}`] = log.taken === 1;
      });
      setLogs(logMap);
    }catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    }
  };
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [dateString])
  );

  /* === CHARGER TOUS LES ETATS D'UN MEDICAMENT === */
  const openCalendarModal = async (med) => {
    setSelectedMed(med);
    try {
      const db = await getDatabase();
      const allLogs = await db.getAllAsync(
        'SELECT * FROM daily_logs WHERE medication_id = ?',
        [med.id]
      );
      setMedLogs(allLogs);
      setIsModalVisible(true);
    } catch (error) {
      console.error("Erreur chargement des logs du médicament:", error);
    }
  };

  /* === OUVRIR LE MODAL DE LA POSOLOGIE D'UN MEDICAMENT === */
  const openTextModal = (med) => {
    setSelectedMed(med);
    setIsPosologyModalVisible(true);
  };

  /* === OUVRIR LE MODAL DES CONDITIONS === */
  const openConditionsModal = () => {
    setIsTermsModalVisible(true);
  };

  /* === CALCUL DU STATUT GLOBAL D'UNE JOURNEE POUR UN MEDICAMENT === */
  const getDayStatus = (dateStr, med) => {
    const today = new Date().toISOString().split('T')[0];
    // determiner combien de creneaux sont requis par jour
    let requiredSlotsCount = 0;
    if (med.take_morning === 1) requiredSlotsCount++;
    if (med.take_noon === 1) requiredSlotsCount++;
    if (med.take_evening === 1) requiredSlotsCount++;
    if (med.take_night === 1) requiredSlotsCount++;
    const dayLogs = medLogs.filter((l) => l.date === dateStr && l.taken === 1);
    // vert
    if (dayLogs.length === requiredSlotsCount && requiredSlotsCount > 0) {
      return 'completed'; 
    }
    //rouge
    if (dateStr <= today) {
      return 'missed'; 
    }
    // gris
    return 'upcoming'; 
  };

  /* === SUPPRIMER UN MEDICAMENT DE LA BDD === */
  const deleteMedication = async (id, name) => {
    Alert.alert(
      'Supprimer le médicament',
      `Voulez-vous vraiment supprimer ${name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const db = await getDatabase();
            await db.runAsync('DELETE FROM medications WHERE id = ?', [id]);
            await db.runAsync('DELETE FROM daily_logs WHERE medication_id = ?', [id]);
            loadData();
          },
        },
      ]
    );
  };
  
  /* === BASCULER L'ETAT DE LA PRISE D'UN MEDICAMENT (ROUGE VERT) === */ 
  const handleSlotPress = (medId, slot, medName, slotLabel) => {
    const currentStatus = logs[`${medId}_${slot}`] || false;
    if (currentStatus) {
      // si la prise du medicament est verte, on demande confirmation avant de le passe a rouge
      Alert.alert(
        'Modifier le statut',
        `Voulez-vous vraiment marquer la prise "${slotLabel}" de ${medName} comme "non prise" ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Confirmer',
            style: 'destructive',
            onPress: () => executeToggle(medId, slot, true),
          },
        ]
      );
    } else {
      // si la prise du medicament est rouge, on passe a vert
      executeToggle(medId, slot, false);
    }
  };

  /* === EXECUTER LA MODIFICATION DANS LA BDD === */
  const executeToggle = async (medId, slot, currentStatus) => {
    const db = await getDatabase();
    const newStatus = !currentStatus;
    await db.runAsync(
      `INSERT INTO daily_logs (medication_id, date, slot, taken) 
       VALUES (?, ?, ?, ?) 
       ON CONFLICT(medication_id, date, slot) 
       DO UPDATE SET taken = excluded.taken`,
      [medId, dateString, slot, newStatus ? 1 : 0]
    );
    setLogs((prev) => ({
      ...prev,
      [`${medId}_${slot}`]: newStatus,
    }));
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      >
      <Text style={styles.titre}>Aujourd'hui</Text>
      <Text style={styles.ligne1}>Ton pilulier numérique t'aide à te souvenir si tu as pris un médicament aujourd'hui.</Text>
      
      {/* Ajout de l'image */}
<Image 
  source={require('../../assets/images/oubli2.jpg')} 
  style={styles.illustration} 
  resizeMode="contain"
/>

        {/* Liste des médicaments */}
        {medications.length === 0 ? (
          <Text style={styles.emptyText}>Aucun médicament enregistré.</Text>
        ) : (
          medications.map((med) => (
            /* carte d'un medicament */
            <View key={med.id} style={styles.medCard}>     
              <View style={styles.medHeader}>
                <View style={styles.medNameContainer}>
                  <Text style={styles.medName}>{med.name} ({med.duration_days} jrs)</Text>
                </View>
                
                {/* bloc matin midi soir nuit */}
                <View style={styles.slotsRow}>
                    <SlotCard 
                      label="Matin" 
                      isEnabled={med.take_morning === 1}
                      isTaken={logs[`${med.id}_morning`]} 
                      onPress={() => handleSlotPress(med.id, 'morning', med.name, 'Matin')}                  
                    />
                    <SlotCard 
                      label="Midi" 
                      isEnabled={med.take_noon === 1}
                      isTaken={logs[`${med.id}_noon`]} 
                      onPress={() => handleSlotPress(med.id, 'noon', med.name, 'Midi')}                  
                    />
                    <SlotCard 
                      label="Soir" 
                      isEnabled={med.take_evening === 1}
                      isTaken={logs[`${med.id}_evening`]} 
                      onPress={() => handleSlotPress(med.id, 'evening', med.name, 'Soir')}                  
                    />
                    <SlotCard 
                      label="Nuit" 
                      isEnabled={med.take_night === 1}
                      isTaken={logs[`${med.id}_night`]} 
                      onPress={() => handleSlotPress(med.id, 'night', med.name, 'Nuit')}                  
                    />
                </View>

                {/* groupe de boutons */}
                <View style={styles.actionButtonsRow}>
                  {/* bouton document */}
                  <TouchableOpacity 
                    onPress={() => openTextModal(med)}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="document-text-outline" style={styles.icone}/>
                  </TouchableOpacity>
                  {/* bouton Calendrier */}
                  <TouchableOpacity 
                    onPress={() => openCalendarModal(med)}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="calendar-number-outline" style={styles.icone}/>
                  </TouchableOpacity>
                  {/* bouton Corbeille */}
                  <TouchableOpacity 
                    onPress={() => deleteMedication(med.id, med.name)}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="trash-outline" style={styles.icone} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}

      {/* === DATE HEURE === */}
      <Text style={styles.date}>
        {formattedDate}
      </Text>
      <Text style={styles.timeText}>{now.toLocaleTimeString('fr-FR')}</Text>

      {/* === MENU BAS DE PAGE === */}
      <View style={styles.menuContainer}>
        <View style={styles.menu}>
          <Ionicons name="home" style={styles.icone}/>
          <TouchableOpacity onPress={() => router.push('/add-medication')}>
            <Ionicons name="add-circle-outline" style={styles.icone}/>
          </TouchableOpacity>
          <Ionicons name="time-outline" style={styles.icone}/>
          <TouchableOpacity onPress={() => openConditionsModal()}>
            <Ionicons name="shield-checkmark-outline" style={styles.icone}/>
          </TouchableOpacity>
        </View>
      </View>

      {/* === MODAL POSOLOGIE === */}
      <Modal
        visible={isPosologyModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsPosologyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedMed?.name}</Text>
            <Text style={styles.modalSubtitle}>Posologie</Text>

            {/* Texte de la posologie */}
            <View style={styles.posologyBox}>
              <Text style={styles.posologyText}>
                {selectedMed?.posologie && selectedMed.posologie.trim() !== "" 
                  ? selectedMed.posologie 
                  : "Aucune posologie renseignée."}
              </Text>
            </View>

            {/* bouton Fermer */}
            <TouchableOpacity 
              style={styles.closeModalBtn} 
              onPress={() => setIsPosologyModalVisible(false)}
            >
              <Text style={styles.closeModalBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* === MODAL CONDITIONS UTILISATION === */}
      <Modal
        visible={isTermsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsTermsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Conditions d'utilisation</Text>
            
            <ScrollView style={{ maxHeight: 350, marginVertical: 12 }}>
              <Text style={styles.termsBodyText}>
                {"1. Objet de l'application\n"} 
                <Text style={{ fontStyle: 'italic' }}>Azee</Text>
                {" est un outil numérique personnel et gratuit pour l'organisation de la prise de médicaments. L'application aide à se rappeler que la prise de médicaments a été effectuée, mais n'envoie aucune notification de prise de médicaments. Elle se complète avec les données que vous lui fournissez, ne constitue pas un dispositif médical et ne se substitue pas aux conseils d'un professionnel de santé.\n\n" +
                "2. Absence de conseil médical\n" +
                "L'application ne fournit aucun avis thérapeutique. Le médecin ou le pharmacien reste l'unique référent pour la posologie et le suivi de vos traitements.\n\n" +
                "3. Limitation de responsabilité\n" +
                "L'auteur ne peut être tenu responsable d'une erreur de posologie, d'une mauvaise utilisation de la plateforme ou d'un oubli de traitement lié à une défaillance technique, un arrêt de l'application ou un problème de notification.\n\n" +
                "4. Conseils d'utilisation\n" +
                "Au démarrage aucun médicament n'est enregistré. Appuyez sur \"+ Nouveau médicament\" pour rajouter un médicament. Le nom du médicament ainsi que la durée du traitement doivent être renseignés. La fréquence de prise est réglée par défaut au matin et soir mais peut être modifiée. Le détail de la posologie est facultatif. Il faut appuyer sur \"Enregistrer\" pour que les données soient sauvegardées sur le téléphone, puis qu'elles apparaissent sur la page d'accueil de l'application. Il est alors possible d'afficher le calendrier de traitement, le détail de la posologie ou de supprimer le médicament concerné. Lors d'une prise de médicament, le fait de cliquer sur un bouton rouge marqué \"Non pris\" transforme le bouton en vert marqué \"Pris\".\n\n" +
                "5. Données personnelles\n" +
                "Vos données ne sont ni collectées ni partagées. Elles sont stockées exclusivement et localement sur votre appareil.\n\n" +
                "6. Propriété intellectuelle\n" +
                "Tous les droits relatifs à l'application et à son code source sont réservés.\n\n" +
                "Azee v1.1.0 / S. Robin"}
              </Text>
            </ScrollView>

            <TouchableOpacity 
              style={styles.closeModalBtn} 
              onPress={() => setIsTermsModalVisible(false)}
            >
              <Text style={styles.closeModalBtnText}>J'ai compris</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* === MODAL CALENDRIER === */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedMed?.name}</Text>
            <Text style={styles.modalSubtitle}>
              Traitement sur {selectedMed?.duration_days} jour(s)
            </Text>
            <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingVertical: 10 }}>
              {selectedMed && (() => {
                // calcul de la date de debut et de la date de fin
                const startDateParts = selectedMed.start_date.split('-');
                const start = new Date(
                  parseInt(startDateParts[0], 10),
                  parseInt(startDateParts[1], 10) - 1,
                  parseInt(startDateParts[2], 10)
                );
                const end = new Date(start);
                end.setDate(end.getDate() + selectedMed.duration_days - 1);
                // genere la liste de tous les mois a afficher
                const monthsToDisplay = [];
                let currentMonthCursor = new Date(start.getFullYear(), start.getMonth(), 1);
                const lastMonthCursor = new Date(end.getFullYear(), end.getMonth(), 1);
                while (currentMonthCursor <= lastMonthCursor) {
                  monthsToDisplay.push(new Date(currentMonthCursor));
                  currentMonthCursor.setMonth(currentMonthCursor.getMonth() + 1);
                }
                return monthsToDisplay.map((monthDate) => {
                  const year = monthDate.getFullYear();
                  const month = monthDate.getMonth();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const firstDay = new Date(year, month, 1).getDay();
                  const startingPadding = (firstDay + 6) % 7;
                  const gridCells = [];
                  // case vide avant le 1er du mois
                  for (let i = 0; i < startingPadding; i++) {
                    gridCells.push(<View key={`empty-${i}`} style={styles.popupDayBox} />);
                  }
                  // grille des jours
                  for (let day = 1; day <= daysInMonth; day++) {
                    const currentDayDate = new Date(year, month, day);
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    // verifie si le jour est compris dans la duree du traitement
                    const isTreatmentDay = currentDayDate >= start && currentDayDate <= end;
                    const status = isTreatmentDay ? getDayStatus(dateStr, selectedMed) : null;
                    gridCells.push(
                      <View
                        key={day}
                        style={[
                          styles.popupDayBox,
                          isTreatmentDay && status === 'completed' && styles.dayGreen,
                          isTreatmentDay && status === 'missed' && styles.dayRed,
                          isTreatmentDay && status === 'upcoming' && styles.dayUpcoming,
                        ]}
                      >
                        <Text
                          style={[
                            styles.popupDayNum,
                            isTreatmentDay && styles.popupDayNumActive,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    );
                  }
                  return (
                    <View key={`${year}-${month}`} style={styles.popupMonthContainer}>
                      {/* en-tete mois + annee */}
                      <Text style={styles.popupMonthTitle}>
                        {monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                      </Text>
                      {/* en-tete des jours de la semaine */}
                      <View style={styles.weekHeaderRow}>
                        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, idx) => (
                          <Text key={idx} style={styles.weekHeaderLabel}>
                            {d}
                          </Text>
                        ))}
                      </View>
                      {/* grille du mois */}
                      <View style={styles.monthGrid}>{gridCells}</View>
                    </View>
                  );
                });
              })()}
            </ScrollView>

            {/* bouton Fermer */}
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.closeModalBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

// composant pour chaque moment de prise
function SlotCard({ label, isEnabled, isTaken, onPress }) {
  if (!isEnabled) {
    return (
      <View style={[styles.slot, styles.slotGray]} pointerEvents="none">
        <Text style={[styles.slotText, { color: grisIntermediaire }]}>{label}</Text>
        <Text style={[styles.slotStatus, { color: grisIntermediaire }]}>inactif</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity 
      style={[styles.slot, isTaken ? styles.slotGreen : styles.slotRed]} 
      onPress={onPress}
    >
      <Text style={styles.slotText}>{label}</Text>
      <Text style={styles.slotStatus}>{isTaken ? 'pris' : 'non pris'}</Text>
    </TouchableOpacity>
  );
}

// styles
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding:10,
    paddingTop:20,
    backgroundColor: couleurFond, 

  },
  scrollContent: { 
    padding: 16, 
    paddingBottom: 80
  },
  titre:{
    color:bleuPrincipal,
    fontWeight: '600',
    fontSize: 22,
    textAlign: 'center',
    marginTop:10,
    marginBottom:10
  },
  ligne1: { 
    textAlign: 'center', 
    color: grisIntermediaire, 
    marginTop: 12, 
    marginBottom:12, 
    fontSize: 16 
  },
  emptyText: { 
    textAlign: 'center', 
    color: grisIntermediaire, 
    marginTop: 32, 
    fontSize: 16 
  },
  medCard: { 
    backgroundColor: bleuSecondaire, 
    padding: 14, 
    borderRadius: 20, 
    marginBottom: 12 
  },
  medHeader: { 
    flexDirection: 'column', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 0 },
  medNameContainer: {
    flex: 1,                  
    marginRight: 10,          
  },
  medName: { 
    color: grisSombre, 
    fontSize: 18, 
    fontWeight: 'bold',
    flexWrap: 'wrap' 
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop:6,
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    width:'100%'
  },
  iconBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotsRow: { 
    flexDirection: 'row', 
    gap: 8,
    marginTop:10
  },
  slot: { 
    flex: 1, 
    padding: 4, 
    borderRadius: 20, 
    alignItems: 'center' 
  },
  slotRed: { 
    backgroundColor: rouge
  },
  slotGreen: { 
    backgroundColor:  vert
  },
  slotgray:{
    backgroundColor: grisClair
  },
  slotText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 14,
  },
  slotStatus: { 
    color: '#fff', 
    fontSize: 11, 
    marginTop: 2 
  },
  calendarContainer: { 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 16, 
    marginTop: 10,
  },
  calendarTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginBottom: 12, 
    color: grisSombre, 
    textAlign: 'center',
    textTransform: 'capitalize' 
  },
  weekHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 8 
  },
  weekHeaderLabel: { 
    width: '14.28%', 
    textAlign: 'center', 
    fontWeight: 'bold', 
    fontSize: 12, 
    color: grisIntermediaire
  },
  monthGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap' 
  },
  dayBox: { 
    width: '14.28%',
    height: 36, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginVertical: 2 
  },
  todayBox: { 
    backgroundColor: bleuPrincipal, 
    borderRadius: 18 
  },
  dayNum: { 
    fontSize: 14, 
    color: '#000' 
  },
  todayText: { 
    color: '#fff', 
    fontWeight: 'bold' 
  },  
  menu: {
    flexDirection: 'row',
    backgroundColor:'white',
    borderRadius:20,
    marginTop:6,
    marginBottom:8,
    padding:4,
    gap: 18,
    alignItems: 'center',
    justifyContent: 'center',
    width:'60%'
  },
  menuContainer:{
    alignItems:'center'
  },
  icone:{
    fontSize:25,
    color:grisIntermediaire
  },
  date:{
    fontSize: 18, 
    fontWeight:600,
    color: grisIntermediaire,
    textAlign:'center',
    justifyContent:'center',
    marginTop:6
  },
    timeText: { 
    fontSize: 18, 
    fontWeight: 600, 
    color: grisIntermediaire, 
    textAlign: 'center', 
    justifyContent:'center',
    marginTop: 10 ,
    marginBottom: 20
  },
  illustration: {
    width: '100%',
    height: 150, // Ajustez la hauteur selon vos besoins
    resizeMode: 'contain',
    marginBottom: 12,
  },

  // Modal calendrier pop-up
  modalOverlay: {
    flex: 1,
    backgroundColor: transparent,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: grisSombre,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: grisIntermediaire,
    marginBottom: 10,
  },
  popupMonthContainer: {
    marginBottom: 20,
  },
  popupMonthTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: grisSombre,
    textAlign: 'center',
    textTransform: 'capitalize',
    marginBottom: 8,
  },
  popupDayBox: {
    width: '14.28%',
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 18,
  },
  popupDayNum: {
    fontSize: 14,
    color: grisClair, // gris clair pour les jours hors traitement
  },
  popupDayNumActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dayGreen: {
    backgroundColor: vert,
  },
  dayRed: {
    backgroundColor: rouge,
  },
  dayUpcoming: {
    backgroundColor: grisClair,
  },
  closeModalBtn: {
    marginTop: 10,
    backgroundColor: bleuPrincipal,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 25,
  },
  closeModalBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },

  // modal posologie
  posologyBox: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginVertical: 14,
  },
  posologyText: {
    fontSize: 15,
    color: grisSombre,
    textAlign: 'center',
    lineHeight: 22,
  },
});