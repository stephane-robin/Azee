{/* calendrier bas de page 
      <View style={styles.calendarContainer}>*/}
        {/* en-tete du calendrier avec mois et annee 
        <Text style={styles.calendarTitle}>
          {now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </Text>*/}
        {/* Jours de la semaine 
        <View style={styles.weekHeaderRow}>
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
            <Text key={idx} style={styles.weekHeaderLabel}>
              {day}
            </Text>
          ))}
        </View>*/}
        {/* grille des jours du mois 
        <View style={styles.monthGrid}>
          {(() => {
            const year = now.getFullYear();
            const month = now.getMonth();*/}
            // nombre de jours dans le mois
            {/*const daysInMonth = new Date(year, month + 1, 0).getDate();*/}
            // premier jour du mois (0 = Dimanche par defaut)
            // et ajustement pour faire commencer la semaine le lundi = 0
            {/*const firstDay = new Date(year, month, 1).getDay();
            const startingPadding = (firstDay + 6) % 7;*/}
            // cases vides precedant le 1er du mois
            {/*const gridCells = [];
            for (let i = 0; i < startingPadding; i++) {
              gridCells.push(<View key={`empty-${i}`} style={styles.dayBox} />);
            }*/}
            // cases pour chaque jour du mois
            {/*for (let day = 1; day <= daysInMonth; day++) {
              const isToday =
                day === now.getDate() &&
                month === new Date().getMonth() &&
                year === new Date().getFullYear();
              gridCells.push(
                <View key={day} style={[styles.dayBox, isToday && styles.todayBox]}>
                  <Text style={[styles.dayNum, isToday && styles.todayText]}>
                    {day}
                  </Text>
                </View>
              );
            }
            return gridCells;
          })()}
        </View>
      </View>*/}