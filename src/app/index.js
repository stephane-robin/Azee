import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Modal, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from '../database/db';
import { couleurFond, bleuPrincipal, bleuSecondaire, transparent, grisIntermediaire, grisSombre, grisClair, rouge, vert } from '../constants/colors';

/* === CONVERTIT UNE DATE EN CHAINE 'AAAA-MM-JJ' === */
const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;



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
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [allMedicationsHistory, setAllMedicationsHistory] = useState([]);
  const [monthLogs, setMonthLogs] = useState([]);
  const [isGlobalCalendarModalVisible, setIsGlobalCalendarModalVisible] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const { width } = useWindowDimensions();
  const [celebrationMessage, setCelebrationMessage] = useState('');



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

  /* === DISPARITION AUTOMATIQUE DU MESSAGE === */
useEffect(() => {
  if (!celebrationMessage) return;

  const timer = setTimeout(() => {
    setCelebrationMessage('');
  }, 6000);

  return () => clearTimeout(timer);
}, [celebrationMessage]);

  
  /* === CHARGER LES MEDICAMENTS, ETATS, PRISES DU JOUR, DU MOIS, SUR 3 MOIS === */
  const loadData = async () => {
    try{
      const db = await getDatabase();
      const meds = await db.getAllAsync('SELECT * FROM medications');
      setMedications(meds);
      // recuperer les etats des prises de tous les medicaments pour aujourd'hui
      const dailyLogs = await db.getAllAsync('SELECT * FROM daily_logs WHERE date = ?', [dateString]);
      const logMap = {};
      dailyLogs.forEach((log) => {
        logMap[`${log.medication_id}_${log.slot}`] = log.taken === 1;
      });
      setLogs(logMap);
      // recuperer les prises du mois en cours pour le calendrier de bas de page
      await loadMonthLogs(db);
    }catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    }
  };

  /* === CHARGER LES PRISES DU MOIS PRECEDENT, DU MOIS EN COURS ET DU MOIS SUIVANT 
  fonction necessaire car appelee une fois au demarrage pour le calendrier mensuel 
  et aussi lors de l'ouverture du modal de calendrier global === */
  const loadMonthLogs = async (dbParam) => {
    try {
      const db = dbParam || (await getDatabase());
      /* mois de 1 a 12 */
      const [y, m] = dateString.split('-').map(Number); 
      /* 1er jour du mois precedent */
      const from = toDateStr(new Date(y, m - 2, 1)); 
      /* dernier jour du mois suivant */
      const to = toDateStr(new Date(y, m + 1, 0)); 
      const rows = await db.getAllAsync(
        'SELECT medication_id, date, slot FROM daily_logs WHERE date BETWEEN ? AND ? AND taken = 1',
        [from, to]
      );
      setMonthLogs(rows);
    } catch (error) {
      console.error("Erreur chargement des prises du mois:", error);
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
      /* si la prise du medicament est verte, on demande confirmation avant de le passe a rouge */
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
      /* si la prise du medicament est rouge, on passe a vert */
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
    /* mettre a jour le calendrier de bas de page */
    loadMonthLogs(db);
    /* vérifier les récompenses */
    await checkCelebrations(db);
  };

  /* === CRENEAUX REQUIS POUR UN MEDICAMENT === */
  const getRequiredSlots = (med) => {
    const slots = [];
    if (med.take_morning === 1) slots.push('morning');
    if (med.take_noon === 1) slots.push('noon');
    if (med.take_evening === 1) slots.push('evening');
    if (med.take_night === 1) slots.push('night');
    return slots;
  };

  /* === VERIFIER SI UN TRAITEMENT EST EN COURS A UNE DATE DONNEE ('AAAA-MM-JJ') === */
  const isMedicationActiveOn = (med, dateStr) => {
    if (!med.start_date || !med.duration_days) return false;
    const [sYear, sMonth, sDay] = med.start_date.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay);
    const end = new Date(start);
    end.setDate(end.getDate() + med.duration_days - 1);
    const [dYear, dMonth, dDay] = dateStr.split('-').map(Number);
    const d = new Date(dYear, dMonth - 1, dDay);
    return d >= start && d <= end;
  };

/* === VERIFICATION DES RECOMPENSES === */
const checkCelebrations = async (db) => {

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isSunday = today.getDay() === 0;

  const lastDayOfMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate();

  const isLastDayOfMonth = today.getDate() === lastDayOfMonth;

  // === RECOMPENSE MENSUELLE ===
  if (isLastDayOfMonth) {

    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    const monthKey = `month_${toDateStr(start).substring(0, 7)}`;

    if (isPeriodCompleted(start, today)) {

      const result = await db.runAsync(
        `INSERT OR IGNORE INTO achievements (period_key, type)
         VALUES (?, ?)`,
        [monthKey, 'monthly']
      );

      if (result.changes > 0) {
        setCelebrationMessage('Félicitations ! Un mois complet réussi...');
        setCelebration('monthly');
        return;
      }
    }
  }

  // === RECOMPENSE HEBDOMADAIRE ===
  if (isSunday) {

    const monday = getMonday(today);

    const weekKey = `week_${toDateStr(monday)}`;

    if (isPeriodCompleted(monday, today)) {

      const result = await db.runAsync(
        `INSERT OR IGNORE INTO achievements (period_key, type)
         VALUES (?, ?)`,
        [weekKey, 'weekly']
      );

      if (result.changes > 0) {
        setCelebrationMessage('Bravo ! Une semaine sans oubli...');
        setCelebration('weekly');
      }
    }
  }
};



  /* === STATUT GLOBAL D'UNE JOURNEE (TOUS MEDICAMENTS CONFONDUS) ===
     'completed' : tous les medicaments du jour ont ete pris (vert)
     'missed'    : au moins une prise du jour n'a pas ete effectuee (rouge)
     'upcoming'  : journee future avec un traitement prevu (gris)
     null        : aucun traitement ce jour-la */
  const takenSet = new Set(monthLogs.map((l) => `${l.medication_id}_${l.date}_${l.slot}`));
  const getGlobalDayStatus = (dateStr) => {
    const dayMeds = medications.filter(
      (med) => isMedicationActiveOn(med, dateStr) && getRequiredSlots(med).length > 0
    );
    if (dayMeds.length === 0) return null;
    if (dateStr > dateString) return 'upcoming';
    const allTaken = dayMeds.every((med) =>
      getRequiredSlots(med).every((slot) => takenSet.has(`${med.id}_${dateStr}_${slot}`))
    );
    return allTaken ? 'completed' : 'missed';
  };

  /* === VERIFIER SI TOUTES LES JOURNEES D'UNE PERIODE SONT VERTES === */
const isPeriodCompleted = (start, end) => {

  const cursor = new Date(start);

  let hasTreatment = false;

  while (cursor <= end) {

    const dateStr = toDateStr(cursor);

    const status = getGlobalDayStatus(dateStr);

    if (status === 'missed') return false;

    if (status === 'completed') {
      hasTreatment = true;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return hasTreatment;
};


  /* === CASES D'UN MOIS (month : 0 a 11) ===
    options.getStatus   : fonction (dateStr) => 'completed' | 'missed' | 'upcoming' | null
                          par defaut : statut global tous medicaments confondus
    options.dimInactive : true pour griser le numero des jours sans statut */
  const renderMonthCells = (year, month, options = {}) => {
    const { getStatus = getGlobalDayStatus, dimInactive = false } = options;
    /* nombre de jours dans le mois */
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    /* premier jour du mois (0 = Dimanche par defaut)
       et ajustement pour faire commencer la semaine le lundi = 0 */
    const firstDay = new Date(year, month, 1).getDay();
    const startingPadding = (firstDay + 6) % 7;
    /* cases vides precedant le 1er du mois */
    const gridCells = [];
    for (let i = 0; i < startingPadding; i++) {
      gridCells.push(<View key={`empty-${i}`} style={styles.dayBox} />);
    }
    /* cases pour chaque jour du mois */
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday =
        day === now.getDate() &&
        month === now.getMonth() &&
        year === now.getFullYear();
      const dateStr = toDateStr(new Date(year, month, day));
      const status = getStatus(dateStr);
      gridCells.push(
        <View
          key={day}
          style={[
            styles.dayBox,
            status && styles.dayStatusBox,
            status === 'completed' && styles.slotGreen,
            status === 'missed' && styles.slotRed,
            status === 'upcoming' && styles.slotGray,
            /* aujourd'hui : toujours un contour gris (couleur de fond selon le statut) */
            isToday && styles.todayBorder,
          ]}
        >
          <Text
            style={[
              styles.dayNum,
              /* jours sans traitement grisés dans le modal d'un médicament (sauf aujourd'hui) */
              !status && dimInactive && !isToday && styles.popupDayNum,
              /* texte blanc uniquement sur une case colorée */
              status && styles.todayText,
            ]}
          >
            {day}
          </Text>
        </View>
      );
    }
    return gridCells;
  };

  /* === UN TRAITEMENT EST-IL PREVU AU MOINS UN JOUR DU MOIS ? === */
  const monthHasTreatment = (year, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      if (getGlobalDayStatus(toDateStr(new Date(year, month, day)))) return true;
    }
    return false;
  };

  /* === MOIS A AFFICHER DANS LE MODAL CALENDRIER GLOBAL ===
     mois precedent (si un traitement y etait actif), mois en cours,
     mois suivant (si un traitement y est prevu) */
  const getGlobalCalendarMonths = () => {
    const current = new Date(now.getFullYear(), now.getMonth(), 1);
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const months = [];
    if (monthHasTreatment(previous.getFullYear(), previous.getMonth())) months.push(previous);
    months.push(current);
    if (monthHasTreatment(next.getFullYear(), next.getMonth())) months.push(next);
    return months;
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

  /* === OUVRIR LE MODAL CALENDRIER GLOBAL === */
  const openGlobalCalendarModal = async () => {
    await loadMonthLogs();
    setIsGlobalCalendarModalVisible(true);
  };

  /* === LISTE FILTREE DES MEDICAMENTS EN COURS === */
  const activeMedications = medications.filter((med) => isMedicationActiveOn(med, dateString));

  /* === OUVRIR LE MODAL DE L'HISTORIQUE DE TOUS LES MEDICAMENTS === */
  const openHistoryModal = async () => {
    try {
      const db = await getDatabase();
      /* recupere tous les medicaments sans filtre de date */
      const meds = await db.getAllAsync('SELECT * FROM medications ORDER BY start_date DESC');
      setAllMedicationsHistory(meds);
      setIsHistoryModalVisible(true);
    } catch (error) {
      console.error("Erreur lors du chargement de l'historique des médicaments:", error);
    }
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      >
      <Text style={styles.titre}>Aujourd'hui</Text>
      <Text style={styles.ligne1}>Ton pilulier numérique t'aide à te souvenir si tu as pris tes médicaments aujourd'hui.</Text>
      
      {/* Ajout de l'image */}
      <Image 
        source={require('../../assets/images/oubli2.jpg')} 
        style={styles.illustration} 
      />

        {/* Liste des médicaments */}
        {activeMedications.length === 0 ? (
          <Text style={styles.emptyText}>Aucun médicament enregistré.</Text>
        ) : (
          activeMedications.map((med) => (
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

        {/* === MESSAGE DE FELICITATIONS === */}
{celebrationMessage !== '' && (
  <View style={styles.celebrationMessage}>
    <Ionicons
      name={celebration === 'monthly' ? 'trophy' : 'ribbon'}
      size={25}
      color={bleuPrincipal}
    />

    <Text style={styles.celebrationMessageText}>
      {celebrationMessage}
    </Text>
  </View>
)}


        {/* === CALENDRIER BAS DE PAGE === */}
        <View style={styles.calendarContainer}>
          <Text style={styles.calendarTitle}>
            {now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </Text>
          <Text style={styles.calendarSubtitle}>suivi global des prises</Text>        
          
          {/* legende */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.slotGreen]} />
              <Text style={styles.legendText}>tout pris</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.slotRed]} />
              <Text style={styles.legendText}>oubli</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.slotGray]} />
              <Text style={styles.legendText}>à venir</Text>
            </View>
          </View>
          <View style={styles.weekHeaderRow}>
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
                <Text key={idx} style={styles.weekHeaderLabel}>{day}</Text>
              ))}
            </View>
          {/* grille des jours du mois */}
          <View style={styles.monthGrid}>
            {renderMonthCells(now.getFullYear(), now.getMonth())}
          </View>
      </View>

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
          <TouchableOpacity onPress={() => openHistoryModal()}>
            <Ionicons name="time-outline" style={styles.icone}/>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openGlobalCalendarModal()}>
            <Ionicons name="calendar-number-outline" style={styles.icone}/>
          </TouchableOpacity>
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
              <Text>
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
                "Azee v2.0.0 / S. Robin"}
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

      {/* === MODAL CALENDRIER D'UN MEDICAMENT === */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.calendarTitle}>{selectedMed?.name}</Text>
            <Text style={styles.calendarSubtitle}>
              Traitement sur {selectedMed?.duration_days} jour(s)
            </Text>

            {/* legende */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.slotGreen]} />
                <Text style={styles.legendText}>pris</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.slotRed]} />
                <Text style={styles.legendText}>oubli</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.slotGray]} />
                <Text style={styles.legendText}>à venir</Text>
              </View>
            </View>

            <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingVertical: 10 }}>
                            {selectedMed && (() => {
                /* statut d'un jour pour ce medicament (null hors de la periode de traitement) */
                const getMedDayStatus = (dateStr) =>
                  isMedicationActiveOn(selectedMed, dateStr)
                    ? getDayStatus(dateStr, selectedMed)
                    : null;
                /* calcul de la date de debut et de la date de fin */
                const [sYear, sMonth, sDay] = selectedMed.start_date.split('-').map(Number);
                const start = new Date(sYear, sMonth - 1, sDay);
                const end = new Date(start);
                end.setDate(end.getDate() + selectedMed.duration_days - 1);
                /* liste de tous les mois a afficher */
                const monthsToDisplay = [];
                const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
                const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);
                while (cursor <= lastMonth) {
                  monthsToDisplay.push(new Date(cursor));
                  cursor.setMonth(cursor.getMonth() + 1);
                }
                return monthsToDisplay.map((monthDate) => {
                  const year = monthDate.getFullYear();
                  const month = monthDate.getMonth();
                  return (
                    <View key={`${year}-${month}`} style={styles.popupMonthContainer}>
                      {/* en-tete mois + annee */}
                      <Text style={styles.calendarTitle}>
                        {monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                      </Text>
                      {/* en-tete des jours de la semaine */}
                      <View style={styles.weekHeaderRow}>
                        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, idx) => (
                          <Text key={idx} style={styles.weekHeaderLabel}>{d}</Text>
                        ))}
                      </View>
                      {/* grille du mois */}
                      <View style={styles.monthGrid}>
                        {renderMonthCells(year, month, { getStatus: getMedDayStatus, dimInactive: false })}
                      </View>
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

      {/* === MODAL CALENDRIER GLOBAL (MOIS PRECEDENT / EN COURS / SUIVANT) === */}
      <Modal
        visible={isGlobalCalendarModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsGlobalCalendarModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.calendarTitle}>Calendrier</Text>
            <Text style={styles.calendarSubtitle}>suivi global des prises</Text>
            {/* legende */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.slotGreen]} />
                <Text style={styles.legendText}>tout pris</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.slotRed]} />
                <Text style={styles.legendText}>oubli</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.slotGray]} />
                <Text style={styles.legendText}>à venir</Text>
              </View>
            </View>
            {/* deroulant des calendriers */}
            <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingVertical: 10 }}>
              {getGlobalCalendarMonths().map((monthDate) => {
                const year = monthDate.getFullYear();
                const month = monthDate.getMonth();
                return (
                  <View key={`${year}-${month}`} style={styles.popupMonthContainer}>
                    <Text style={styles.calendarTitle}>
                      {monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </Text>
                    <View style={styles.weekHeaderRow}>
                      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, idx) => (
                        <Text key={idx} style={styles.weekHeaderLabel}>{d}</Text>
                      ))}
                    </View>
                    {/* grille du mois */}
                    <View style={styles.monthGrid}>{renderMonthCells(year, month)}</View>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setIsGlobalCalendarModalVisible(false)}
            >
              <Text style={styles.closeModalBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* === MODAL HISTORIQUE / TOUS LES MEDICAMENTS === */}
      <Modal
        visible={isHistoryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tous les médicaments</Text>
            <Text style={styles.modalSubtitle}>historique enregistré</Text>

            <ScrollView style={{ width: '100%', maxHeight: 350, marginVertical: 10 }}>
              {allMedicationsHistory.length === 0 ? (
                <Text style={{ textAlign: 'center', color: grisIntermediaire, marginTop: 20 }}>
                  Aucun médicament enregistré dans la base.
                </Text>
              ) : (
                allMedicationsHistory.map((med) => {
                  /* Formatage de la date de départ AAAA-MM-JJ -> JJ/MM/AAAA */
                  const [y, m, d] = med.start_date.split('-');
                  const formattedStartDate = `${d}/${m}/${y}`;

                  return (
                    <View key={med.id} style={styles.historyCard}>
                      <Text style={styles.historyMedName}>{med.name}</Text>
                      <Text style={styles.historyDetails}>
                        Début : <Text style={{ fontWeight: 'bold' }}>{formattedStartDate}</Text>
                      </Text>
                      <Text style={styles.historyDetails}>
                        Durée : <Text style={{ fontWeight: 'bold' }}>{med.duration_days} jour(s)</Text>
                      </Text>
                      <Text style={styles.historyDetails}>
                        Posologie : <Text style={{ fontWeight: 'bold' }}>{med.posologie}</Text>
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity 
              style={styles.closeModalBtn} 
              onPress={() => setIsHistoryModalVisible(false)}
            >
              <Text style={styles.closeModalBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    {/* === ANIMATION DES RECOMPENSES === */}

{celebration === 'weekly' && (
  <View
    pointerEvents="none"
    style={styles.celebrationOverlay}
  >
    <ConfettiCannon
      count={180}
      origin={{ x: 0, y: 0 }}
      fadeOut={true}
      explosionSpeed={350}
      fallSpeed={3000}
      colors={[
        '#FFD700',
        '#FF4B6E',
        '#3498DB',
        '#2ECC71',
        '#9B59B6',
        '#FF9F43'
      ]}
      onAnimationEnd={() => setCelebration(null)}
    />
  </View>
)}

{celebration === 'monthly' && (
  <View
    pointerEvents="none"
    style={styles.celebrationOverlay}
  >
    <ConfettiCannon
      count={100}
origin={{ x: width * 0.15, y: 0 }}
      fadeOut
      explosionSpeed={400}
      fallSpeed={2500}
      colors={['#FFD700', '#FFFFFF', '#FF69B4']}
    />

    <ConfettiCannon
      count={100}
origin={{ x: width * 0.50, y: 0 }}
      fadeOut
      explosionSpeed={400}
      fallSpeed={2500}
      colors={['#00BFFF', '#FFD700', '#FF4500']}
    />

    <ConfettiCannon
      count={100}
origin={{ x: width * 0.85, y: 0 }}
      fadeOut
      explosionSpeed={400}
      fallSpeed={2500}
      colors={['#ADFF2F', '#FF69B4', '#FFFFFF']}
      onAnimationEnd={() => setCelebration(null)}
    />
  </View>
)}

    </ScrollView>
  );
}

/* === COMPOSANT POUR CHAQUE MOMENT DE PRISE === */
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

const styles = StyleSheet.create({
  container: { 
    backgroundColor: couleurFond,
    flex: 1, 
    padding:10,
    paddingTop:20,
  },
  scrollContent: { 
    paddingTop: 20,
    padding: 16, 
    paddingBottom: 40
  },

  /* === HAUT DE PAGE === */
  titre:{
    color:bleuPrincipal,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginTop:10,
    marginBottom:10
  },
  ligne1: { 
    color: grisIntermediaire, 
    fontSize: 16,
    marginTop: 12, 
    marginBottom:12, 
    textAlign: 'center',
  },

  /* === IMAGE === */
  illustration: {
    marginBottom: 12,
    width: '100%',
    height: 150,
    resizeMode: 'contain',
  },

  /* === CARTES DE MEDICAMENTS === */
  emptyText: { 
    fontSize: 16,
    color: grisIntermediaire, 
    marginTop: 32, 
    textAlign: 'center'
  },
  medCard: { 
    backgroundColor: bleuSecondaire, 
    padding: 14, 
    marginBottom: 12,
    borderRadius: 20
  },
  medHeader: { 
    flexDirection: 'column', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 0 
  },
  medNameContainer: {
    flex: 1,                  
    marginRight: 10        
  },
  medName: { 
    color: grisSombre, 
    fontSize: 18, 
    fontWeight: 'bold',
    flexWrap: 'wrap' 
  },
  /* boutons vert rouge gris */
  slotsRow: { 
    flexDirection: 'row', 
    gap: 8,
    marginTop:10
  },
  slot: { 
    flex: 1, 
    padding: 4, 
    alignItems: 'center',
    borderRadius: 20
  },
  slotRed: { 
    backgroundColor: rouge
  },
  slotGreen: { 
    backgroundColor: vert
  },
  slotGray:{
    backgroundColor: grisClair
  },
  slotText: { 
    color: '#fff', 
    fontSize: 14,
    fontWeight: 'bold'
  },
  slotStatus: { 
    color: '#fff', 
    fontSize: 11, 
    marginTop: 2 
  },
  /* menu d'un medicament */
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
    alignItems: 'center',
    justifyContent: 'center'
  },

  /* === CALENDRIER === */
  calendarContainer: { 
    backgroundColor: '#fff', 
    padding: 16,  
    marginTop: 10,
    marginBottom:10,
    borderRadius: 20
  },
  calendarTitle: { 
    color: grisSombre, 
    fontSize: 16, 
    fontWeight: 700, 
    marginBottom: 8, 
    textAlign: 'center',
    textTransform: 'capitalize' 
  },
  calendarSubtitle: {
    color: grisIntermediaire,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 10,
    textAlign:'center'
  },
  legendRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 14,
    justifyContent: 'center'    
  },
  legendItem: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center'
  },
  legendDot: {
    borderRadius: 6,
    width: 12,
    height: 12,
  },
  legendText: {
    color: grisIntermediaire,
    fontSize: 12,
  },
  weekHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 8
  },
  weekHeaderLabel: { 
    color: '#000',
    fontSize: 12, 
    fontWeight: 700,
    textAlign: 'center', 
    width: '14.28%'    
  },
  monthGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap' 
  },
  dayBox: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginVertical: 2,
    width: '14.28%',
    height: 36 
  },
  todayBox: { 
    backgroundColor: grisClair, 
    borderRadius: 18 
  },
  dayNum: { 
    color: '#000',
    fontSize: 14
  },
  todayText: { 
    color: '#fff', 
    fontWeight: 600 
  }, 
  
  /* === MODAL CALENDRIER D'UN MEDICAMENT === */
  modalOverlay: {
    backgroundColor: transparent,
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
    maxHeight: '80%'
  },
  popupMonthContainer: {
    marginBottom: 20,
  },
  popupDayNum: {
    color: grisClair,
    fontSize: 14
  },
  closeModalBtn: {
    backgroundColor: bleuPrincipal,
    marginTop: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20
  },
  closeModalBtnText: {
    color: '#fff',
    fontWeight: 'bold'
  }, 
  
  /* === MENU === */
  menu: {
    flexDirection: 'row',
    backgroundColor:'white',
    borderRadius:20,
    marginTop:6,
    marginBottom:10,
    padding:4,
    gap: 18,
    alignItems: 'center',
    justifyContent: 'center',
    width:'80%'
  },
  menuContainer:{
    alignItems:'center'
  },
  icone:{
    color:grisIntermediaire,
    fontSize:25,
  },
  date:{
    color: grisIntermediaire,
    fontSize: 18, 
    fontWeight:600,
    marginTop:6,
    textAlign:'center',
    justifyContent:'center'
  },
  timeText: { 
    color: grisIntermediaire, 
    fontSize: 18, 
    fontWeight: 600, 
    marginTop: 10 ,
    marginBottom: 20,
    textAlign: 'center', 
    justifyContent:'center'
  },

  /* === MODAL POSOLOGIE === */
  posologyBox: {
    backgroundColor: '#fff',
    marginVertical: 14,
    padding: 16,
    borderRadius: 20,
    width: '100%'
  },
  posologyText: {
    color: grisSombre,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22
  },
  modalTitle: {
    color: grisSombre,
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    color: grisIntermediaire,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },

  /* === MODAL HISTORIQUE === */
  historyCard: {
    backgroundColor: couleurFond,
    marginBottom: 10,
    padding: 12,
    borderRadius: 20,
    width: '100%'
  },
  historyMedName: {
    color: grisSombre,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4
  },
  historyDetails: {
    color: grisIntermediaire,
    fontSize: 14
  },
  dayStatusBox: {
    borderRadius: 18
  },
  todayBorder: {
    borderWidth: 3,
    borderColor: grisClair,
    borderRadius: 18
  },
celebrationOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 999,
  elevation: 999,
},
/* === BANDEAU DE FELICITATIONS === */
celebrationMessage: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 14,
  marginHorizontal: 15,
  marginTop: 15,
  marginBottom: 10,
},

celebrationMessageText: {
  color: grisIntermediaire,
  fontSize: 16,
  fontWeight: 'bold',
  textAlign: 'center',
  marginLeft: 10,
  flexShrink: 1,
  paddingRight:1,
  paddingLeft:1,
  borderRadius:20,
  borderWidth:1,
  borderColor:'#f4f98b80',
  backgroundColor:'#f4f98b80'
},

  
});