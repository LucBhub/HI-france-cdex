// src/lib/i18n.ts
export type Language = "en" | "fr" | "it";

interface Translations {
  [key: string]: {
    en: string;
    fr: string;
    it: string;
  };
}

const translations: Translations = {
  // General
  language: { en: "Language", fr: "Langue", it: "Lingua" },
  loading: { en: "Loading...", fr: "Chargement...", it: "Caricamento..." },
  error: { en: "Error", fr: "Erreur", it: "Errore" },
  save: { en: "Save", fr: "Enregistrer", it: "Salva" },
  cancel: { en: "Cancel", fr: "Annuler", it: "Annulla" },
  delete: { en: "Delete", fr: "Supprimer", it: "Elimina" },
  edit: { en: "Edit", fr: "Modifier", it: "Modifica" },
  add: { en: "Add", fr: "Ajouter", it: "Aggiungi" },
  actions: { en: "Actions", fr: "Actions", it: "Azioni" },
  status: { en: "Status", fr: "Statut", it: "Stato" },
  online: { en: "Online", fr: "En ligne", it: "Online" },
  offline: { en: "Offline", fr: "Hors ligne", it: "Offline" },
  success: { en: "Success", fr: "Succès", it: "Successo" },

  // Navigation / Header
  dashboard: { en: "Dashboard", fr: "Tableau de bord", it: "Cruscotto" },
  settings: { en: "Settings", fr: "Paramètres", it: "Impostazioni" },
  adminPanel: {
    en: "Admin Panel",
    fr: "Panneau Admin",
    it: "Pannello Amministratore",
  },
  synoptic: { en: "Synoptic", fr: "Synoptique", it: "Sinottico" },
  reports: { en: "Reports", fr: "Rapports", it: "Rapporti" },
  reportsAnalysis: {
    en: "Reports & Analysis",
    fr: "Rapports & Analyses",
    it: "Rapporti & Analisi",
  },
  logout: { en: "Logout", fr: "Déconnexion", it: "Disconnessione" },

  // Search
  searchPlaceholder: { en: "Search...", fr: "Rechercher...", it: "Cerca..." },
  searchTitle: { en: "Search", fr: "Rechercher", it: "Cerca" },
  searchCommandPlaceholder: {
    en: "Type a command or search...",
    fr: "Tapez une commande ou recherchez...",
    it: "Digita un comando o cerca...",
  },
  noResults: {
    en: "No results found.",
    fr: "Aucun résultat trouvé.",
    it: "Nessun risultato trovato.",
  },
  solarPlants: {
    en: "Solar Plants",
    fr: "Centrales Solaires",
    it: "Impianti Solari",
  },

  // Theme
  themeToggle: {
    en: "Toggle theme",
    fr: "Changer le thème",
    it: "Cambia tema",
  },
  light: { en: "Light", fr: "Clair", it: "Chiaro" },
  dark: { en: "Dark", fr: "Sombre", it: "Scuro" },
  system: { en: "System", fr: "Système", it: "Sistema" },

  // Dashboard
  totalPower: {
    en: "Total Power",
    fr: "Puissance Totale",
    it: "Potenza Totale",
  },
  activePlants: {
    en: "Active Plants",
    fr: "Centrales Actives",
    it: "Impianti Attivi",
  },
  totalEnergy: {
    en: "Total Energy",
    fr: "Énergie Totale",
    it: "Energia Totale",
  },
  co2Saved: { en: "CO2 Saved", fr: "CO2 Économisé", it: "CO2 Risparmiata" },
  viewDetails: { en: "View Details", fr: "Voir Détails", it: "Vedi Dettagli" },

  // Alarms
  alarmsTitle: { en: "Alarms", fr: "Alarmes", it: "Allarmi" },
  active: { en: "Active", fr: "Actives", it: "Attivi" },
  unacknowledged: {
    en: "Unacknowledged",
    fr: "Non acquittées",
    it: "Non riconosciuti",
  },

  // Synoptic Page
  synopticTitle: {
    en: "Synoptic - Plant Selection",
    fr: "Synoptique - Sélection Centrale",
    it: "Sinottico - Selezione Impianto",
  },
  searchPlantPlaceholder: {
    en: "Search for a solar plant...",
    fr: "Rechercher une centrale...",
    it: "Cerca un impianto...",
  },
  noPlantsFound: {
    en: "No plants found matching your search.",
    fr: "Aucune centrale trouvée.",
    it: "Nessun impianto trovato.",
  },

  // Plant Details
  plantDetails: {
    en: "Plant Details",
    fr: "Détails de la Centrale",
    it: "Dettagli Impianto",
  },
  relays: { en: "Relays", fr: "Relais", it: "Relè" },
  measurements: { en: "Measurements", fr: "Mesures", it: "Misure" },
  voltage: { en: "Voltage", fr: "Tension", it: "Tensione" },
  current: { en: "Current", fr: "Courant", it: "Corrente" },
  power: { en: "Power", fr: "Puissance", it: "Potenza" },
  frequency: { en: "Frequency", fr: "Fréquence", it: "Frequenza" },
  temperature: { en: "Temperature", fr: "Température", it: "Temperatura" },
  lastUpdated: {
    en: "Last Updated",
    fr: "Dernière mise à jour",
    it: "Ultimo aggiornamento",
  },

  // Relay Card
  relay: { en: "Relay", fr: "Relais", it: "Relè" },
  breakerStatus: {
    en: "Breaker Status",
    fr: "État Disjoncteur",
    it: "Stato Interruttore",
  },
  closedCoupled: {
    en: "Closed (Coupled)",
    fr: "Fermé (Couplé)",
    it: "Chiuso (Accoppiato)",
  },
  openDecoupled: {
    en: "Open (Decoupled)",
    fr: "Ouvert (Découplé)",
    it: "Aperto (Disaccoppiato)",
  },
  couple: { en: "Couple", fr: "Coupler", it: "Accoppia" },
  decouple: { en: "Decouple", fr: "Découpler", it: "Disaccoppia" },
  commandSuccess: {
    en: "Command sent successfully",
    fr: "Commande envoyée avec succès",
    it: "Comando inviato con successo",
  },
  commandFailed: {
    en: "Command failed",
    fr: "Échec de la commande",
    it: "Comando fallito",
  },
  commandError: {
    en: "Failed to send command",
    fr: "Erreur d'envoi de la commande",
    it: "Errore invio comando",
  },

  // Settings
  plantSettings: {
    en: "Plant Settings",
    fr: "Paramètres Centrale",
    it: "Impostazioni Impianto",
  },
  addPlant: {
    en: "Add Plant",
    fr: "Ajouter Centrale",
    it: "Aggiungi Impianto",
  },
  editPlant: {
    en: "Edit Plant",
    fr: "Modifier Centrale",
    it: "Modifica Impianto",
  },
  plantName: {
    en: "Plant Name",
    fr: "Nom de la Centrale",
    it: "Nome Impianto",
  },
  nominalPower: {
    en: "Nominal Power (kW)",
    fr: "Puissance Nominale (kW)",
    it: "Potenza Nominale (kW)",
  },
  location: { en: "Location", fr: "Emplacement", it: "Posizione" },
  ipAddress: { en: "IP Address", fr: "Adresse IP", it: "Indirizzo IP" },
  port: { en: "Port", fr: "Port", it: "Porta" },
  unitId: { en: "Unit ID", fr: "ID Unité", it: "ID Unità" },
  addNewPlant: {
    en: "Add New Plant",
    fr: "Ajouter une nouvelle centrale",
    it: "Aggiungi nuovo impianto",
  },
  fillPlantForm: {
    en: "Fill out the form to add a new solar plant to the system.",
    fr: "Remplissez le formulaire pour ajouter une nouvelle centrale solaire.",
    it: "Compila il modulo per aggiungere un nuovo impianto solare.",
  },
  relayConfiguration: {
    en: "Relay Configuration",
    fr: "Configuration des relais",
    it: "Configurazione relè",
  },
  addRelay: { en: "Add Relay", fr: "Ajouter Relais", it: "Aggiungi Relè" },
  adding: {
    en: "Adding...",
    fr: "Ajout en cours...",
    it: "Aggiunta in corso...",
  },
  manageExistingPlants: {
    en: "Manage Existing Plants",
    fr: "Gérer les centrales existantes",
    it: "Gestisci impianti esistenti",
  },
  noRelaysConfiguredPlant: {
    en: "No relays",
    fr: "Aucun relais",
    it: "Nessun relè",
  },
  areYouSure: {
    en: "Are you absolutely sure?",
    fr: "Êtes-vous absolument sûr ?",
    it: "Sei assolutamente sicuro?",
  },
  deletePlantWarning: {
    en: "This action cannot be undone. This will permanently delete the plant and remove its data from our servers.",
    fr: "Cette action est irréversible. Cela supprimera définitivement la centrale et ses données.",
    it: "Questa azione non può essere annullata. Eliminerà definitivamente l'impianto e i suoi dati.",
  },
  continue: { en: "Continue", fr: "Continuer", it: "Continua" },
  plantAddedSuccess: {
    en: "Plant added successfully.",
    fr: "Centrale ajoutée avec succès.",
    it: "Impianto aggiunto con successo.",
  },
  plantDeletedSuccess: {
    en: "Plant deleted successfully.",
    fr: "Centrale supprimée avec succès.",
    it: "Impianto eliminato con successo.",
  },
  failedToAddPlant: {
    en: "Failed to add plant.",
    fr: "Échec de l'ajout de la centrale.",
    it: "Impossibile aggiungere l'impianto.",
  },
  failedToDeletePlant: {
    en: "Failed to delete plant.",
    fr: "Échec de la suppression de la centrale.",
    it: "Impossibile eliminare l'impianto.",
  },
  plants: { en: "Plants", fr: "Centrales", it: "Impianti" },
  deviceModels: {
    en: "Device Models",
    fr: "Modèles d'appareils",
    it: "Modelli di dispostivi",
  },
  auditLogs: {
    en: "Audit Logs",
    fr: "Journaux d'audit",
    it: "Registri di controllo",
  },
  data: { en: "Data", fr: "Données", it: "Dati" },

  // Admin
  userManagement: {
    en: "User Management",
    fr: "Gestion Utilisateurs",
    it: "Gestione Utenti",
  },
  users: { en: "Users", fr: "Utilisateurs", it: "Utenti" },
  addUser: { en: "Add User", fr: "Ajouter Utilisateur", it: "Aggiungi Utente" },
  username: { en: "Username", fr: "Nom d'utilisateur", it: "Nome Utente" },
  email: { en: "Email", fr: "Email", it: "Email" },
  role: { en: "Role", fr: "Rôle", it: "Ruolo" },
  password: { en: "Password", fr: "Mot de passe", it: "Password" },
  confirmPassword: {
    en: "Confirm Password",
    fr: "Confirmer Mot de passe",
    it: "Conferma Password",
  },
  addNewUser: {
    en: "Add New User",
    fr: "Ajouter un nouvel utilisateur",
    it: "Aggiungi nuovo utente",
  },
  createUserAccount: {
    en: "Create a new user account and assign a role.",
    fr: "Créez un nouveau compte utilisateur et attribuez un rôle.",
    it: "Crea un nuovo account utente e assegna un ruolo.",
  },
  selectRole: {
    en: "Select a role",
    fr: "Sélectionner un rôle",
    it: "Seleziona un ruolo",
  },
  member: { en: "Member", fr: "Membre", it: "Membro" },
  admin: { en: "Admin", fr: "Admin", it: "Amministratore" },
  creatingUser: {
    en: "Creating User...",
    fr: "Création de l'utilisateur...",
    it: "Creazione utente...",
  },
  createUser: {
    en: "Create User",
    fr: "Créer l'utilisateur",
    it: "Crea utente",
  },
  manageExistingUsers: {
    en: "Manage Existing Users",
    fr: "Gérer les utilisateurs existants",
    it: "Gestisci utenti esistenti",
  },
  deleteUserWarning: {
    en: "This action cannot be undone. This will permanently delete the user account for",
    fr: "Cette action est irréversible. Cela supprimera définitivement le compte utilisateur de",
    it: "Questa azione non può essere annullata. Eliminerà definitivamente l'account utente per",
  },
  userCreatedSuccess: {
    en: "User created.",
    fr: "Utilisateur créé.",
    it: "Utente creato.",
  },
  userDeletedSuccess: {
    en: "User deleted successfully.",
    fr: "Utilisateur supprimé avec succès.",
    it: "Utente eliminato con successo.",
  },
  failedToAddUser: {
    en: "Failed to add user.",
    fr: "Échec de l'ajout de l'utilisateur.",
    it: "Impossibile aggiungere l'utente.",
  },
  failedToDeleteUser: {
    en: "Failed to delete user.",
    fr: "Échec de la suppression de l'utilisateur.",
    it: "Impossibile eliminare l'utente.",
  },

  // Plant Detail Cards
  generalInfo: {
    en: "General Information",
    fr: "Informations Générales",
    it: "Informazioni Generali",
  },
  ce: { en: "CE", fr: "CE", it: "CE" },
  address: { en: "Address", fr: "Adresse", it: "Indirizzo" },
  gpsCoordinates: {
    en: "GPS Coordinates",
    fr: "Coordonnées GPS",
    it: "Coordinate GPS",
  },

  currentPower: {
    en: "Current Power",
    fr: "Puissance Actuelle",
    it: "Potenza Attuale",
  },
  capacity: { en: "Capacity", fr: "Capacité", it: "Capacità" },
  controlManeuvers: {
    en: "Control Maneuvers",
    fr: "Contrôle Manœuvres",
    it: "Controllo Manovre",
  },
  selectRelay: {
    en: "Select Relay",
    fr: "Sélectionner un relais",
    it: "Seleziona relè",
  },
  noRelaysConfigured: {
    en: "No relays configured",
    fr: "Aucun relais configuré",
    it: "Nessun relè configurato",
  },
  commandLogs: {
    en: "Command Logs",
    fr: "Journaux de commande",
    it: "Log comandi",
  },
  realTimeFeedback: {
    en: "Real-time feedback from the control flow.",
    fr: "Retour en temps réel du flux de contrôle.",
    it: "Feedback in tempo reale dal flusso di controllo.",
  },
  logsPlaceholder: {
    en: "Logs will appear here...",
    fr: "Les journaux apparaîtront ici...",
    it: "I log appariranno qui...",
  },
  waitingForCommand: {
    en: "Waiting for command...",
    fr: "En attente de commande...",
    it: "In attesa di comando...",
  },
  attemptingTo: { en: "Attempting to", fr: "Tentative de", it: "Tentativo di" },
  viaRelay: { en: "via relay", fr: "via le relais", it: "via relè" },
  noRelaySelected: {
    en: "No Relay Selected",
    fr: "Aucun relais sélectionné",
    it: "Nessun relè selezionato",
  },
  pleaseSelectRelay: {
    en: "Please select a relay to control.",
    fr: "Veuillez sélectionner un relais à contrôler.",
    it: "Seleziona un relè da controllare.",
  },

  realTimeDiagnostics: {
    en: "Real-Time Diagnostics",
    fr: "Diagnostics Temps Réel",
    it: "Diagnostica in Tempo Reale",
  },
  liveDataRelay: {
    en: "Live data from the protection relay",
    fr: "Données en direct du relais de protection",
    it: "Dati in tempo reale dal relè di protezione",
  },
  currentL1: { en: "Current L1", fr: "Courant L1", it: "Corrente L1" },
  currentL2: { en: "Current L2", fr: "Courant L2", it: "Corrente L2" },
  currentL3: { en: "Current L3", fr: "Courant L3", it: "Corrente L3" },
  voltageU12: { en: "Voltage U12", fr: "Tension U12", it: "Tensione U12" },
  voltageU23: { en: "Voltage U23", fr: "Tension U23", it: "Tensione U23" },
  voltageU31: { en: "Voltage U31", fr: "Tension U31", it: "Tensione U31" },

  // Login
  loginTitle: { en: "Login", fr: "Connexion", it: "Accesso" },
  loginSubtitle: {
    en: "Enter your credentials to access your account",
    fr: "Entrez vos identifiants pour accéder à votre compte",
    it: "Inserisci le tue credenziali per accedere al tuo account",
  },
  signIn: { en: "Sign In", fr: "Se connecter", it: "Accedi" },
  forgotPassword: {
    en: "Forgot password?",
    fr: "Mot de passe oublié ?",
    it: "Password dimenticata?",
  },
  dontHaveAccount: {
    en: "Don't have an account?",
    fr: "Pas encore de compte ?",
    it: "Non hai un account?",
  },
  contactAdmin: {
    en: "Contact your administrator",
    fr: "Contactez votre administrateur",
    it: "Contatta il tuo amministratore",
  },
  orContinueWith: {
    en: "Or continue with",
    fr: "Ou continuer avec",
    it: "Oppure continua con",
  },
  microsoftEntraId: {
    en: "Microsoft Entra ID",
    fr: "Microsoft Entra ID",
    it: "Microsoft Entra ID",
  },

  // Control & Reset
  reset: { en: "Reset", fr: "Réinitialiser", it: "Reimposta" },
  partialSuccess: {
    en: "Partial Success",
    fr: "Succès Partiel",
    it: "Successo Parziale",
  },
  controlAllRelaysDescription: {
    en: "Control all relays simultaneously",
    fr: "Contrôler tous les relais simultanément",
    it: "Controlla tutti i relè contemporaneamente",
  },
  coupleAll: { en: "Couple All", fr: "Coupler Tout", it: "Accoppia Tutto" },
  decoupleAll: {
    en: "Decouple All",
    fr: "Découpler Tout",
    it: "Disaccoppia Tutto",
  },
  resetAll: {
    en: "Reset All",
    fr: "Réinitialiser Tout",
    it: "Reimposta Tutto",
  },

  // Alarms Page
  shelved: { en: "Shelved", fr: "Archivées", it: "Archiviati" },
  filterByStatus: {
    en: "Filter by Status",
    fr: "Filtrer par statut",
    it: "Filtra per stato",
  },
  activeUnacknowledged: {
    en: "Active, Unacknowledged",
    fr: "Actives, Non acquittées",
    it: "Attivi, Non riconosciuti",
  },
  filterByPriority: {
    en: "Filter by Priority",
    fr: "Filtrer par priorité",
    it: "Filtra per priorità",
  },
  priorityLow: {
    en: "Priority: Low",
    fr: "Priorité : Basse",
    it: "Priorità: Bassa",
  },
  priorityMedium: {
    en: "Priority: Medium",
    fr: "Priorité : Moyenne",
    it: "Priorità: Media",
  },
  priorityHigh: {
    en: "Priority: High",
    fr: "Priorité : Haute",
    it: "Priorità: Alta",
  },
  priorityCritical: {
    en: "Priority: Critical",
    fr: "Priorité : Critique",
    it: "Priorità: Critica",
  },
  filters: { en: "FILTERS", fr: "FILTRES", it: "FILTRI" },
  removeAll: { en: "Remove All", fr: "Tout supprimer", it: "Rimuovi tutto" },
  activeTime: {
    en: "Active Time",
    fr: "Heure d'activation",
    it: "Orario di attivazione",
  },
  label: { en: "Label", fr: "Libellé", it: "Etichetta" },
  name: { en: "Name", fr: "Nom", it: "Nome" },
  noActiveAlarms: {
    en: "No active alarms match the current filters.",
    fr: "Aucune alarme active ne correspond aux filtres actuels.",
    it: "Nessun allarme attivo corrisponde ai filtri correnti.",
  },
  noShelvedAlarms: {
    en: "No shelved alarms.",
    fr: "Aucune alarme archivée.",
    it: "Nessun allarme archiviato.",
  },
  acknowledged: { en: "Acknowledged", fr: "Acquitté", it: "Riconosciuto" },
  noActiveAlarmsMessage: {
    en: "No active alarms",
    fr: "Aucune alarme active",
    it: "Nessun allamer attivo",
  },
  noAcknowledgedAlarmsMessage: {
    en: "No acknowledged alarms",
    fr: "Aucune alarme acquittée",
    it: "Nessun allarme riconosciuto",
  },
  activeTab: { en: "Active", fr: "Actifs", it: "Attivi" },
  acknowledgedTab: { en: "Acknowledged", fr: "Acquittés", it: "Riconosciuti" },
  // Analysis / Charts
  period: { en: "Period", fr: "Période", it: "Periodo" },
  last24h: { en: "Last 24h", fr: "Dernières 24h", it: "Ultime 24h" },
  today: { en: "Today", fr: "Aujourd'hui", it: "Oggi" },
  last7d: {
    en: "7 Days (Avg)",
    fr: "7 Jours (Moyennes)",
    it: "7 Giorni (Media)",
  },
  last30d: {
    en: "30 Days (Avg)",
    fr: "30 Jours (Moyennes)",
    it: "30 Giorni (Media)",
  },
  show: { en: "Show:", fr: "Afficher :", it: "Mostra:" },
  production: { en: "Production", fr: "Production", it: "Produzione" },
  irradiation: { en: "Irradiation", fr: "Irradiation", it: "Irraggiamento" },
  powerUnit: { en: "Power (kW)", fr: "Puissance (kW)", it: "Potenza (kW)" },
  irradiationUnit: {
    en: "Irradiation (Wh/m²)",
    fr: "Irradiation (Wh/m²)",
    it: "Irraggiamento (Wh/m²)",
  },
  voltageUnit: { en: "Voltage (V)", fr: "Tension (V)", it: "Tensione (V)" },
  currentUnit: { en: "Current (A)", fr: "Courant (A)", it: "Corrente (A)" },
  analysisHistory: {
    en: "Analysis & History",
    fr: "Analyse & Historique",
    it: "Analisi & Storico",
  },
  analysisSubtitle: {
    en: "Production vs Theoretical Irradiation Comparison",
    fr: "Comparaison Production vs Irradiation Théorique",
    it: "Confronto Produzione vs Irraggiamento Teorico",
  },

  // Reports Page
  reportsDashboard: { en: "Dashboard", fr: "Tableau de Bord", it: "Cruscotto" },
  reportsDetails: {
    en: "Details & Analysis",
    fr: "Détails & Analyse",
    it: "Dettagli & Analisi",
  },

  // Reports Charts
  globalAvailability: {
    en: "Global Availability",
    fr: "Disponibilité Globale",
    it: "Disponibilità Globale",
  },
  production30d: {
    en: "Production (30d)",
    fr: "Production (30j)",
    it: "Produzione (30g)",
  },
  activeIncidents: {
    en: "Active Incidents",
    fr: "Incidents Actifs",
    it: "Incidenti Attivi",
  },
  interventions24h: {
    en: "Interventions (24h)",
    fr: "Interventions (24h)",
    it: "Interventi (24h)",
  },
  topProducers: {
    en: "Top Producers",
    fr: "Top Producteurs",
    it: "Top Produttori",
  },
  topProducersDesc: {
    en: "Ranking of most productive plants",
    fr: "Classement des centrales les plus productives",
    it: "Classifica degli impianti più produttivi",
  },
  criticalPlants: {
    en: "Critical Plants",
    fr: "Centrales Critiques",
    it: "Impianti Critici",
  },
  criticalPlantsDesc: {
    en: "Plants with most faults",
    fr: "Centrales avec le plus de défauts",
    it: "Impianti con più guasti",
  },
  remoteControlEfficiency: {
    en: "Remote Control Efficiency",
    fr: "Efficacité Téléconduite",
    it: "Efficienza Telecontrollo",
  },
  remoteControlDesc: {
    en: "On {0} total decouplings",
    fr: "Sur {0} découplages totaux",
    it: "Su {0} disaccoppiamenti totali",
  },
  productionTrend: {
    en: "Production Trend",
    fr: "Tendance de Production",
    it: "Tendenza Produzione",
  },
  productionTrendDesc: {
    en: "Energy production over time",
    fr: "Production d'énergie dans le temps",
    it: "Produzione di energia nel tempo",
  },
  faultTypes: {
    en: "Fault Types",
    fr: "Types de Défauts",
    it: "Tipi di Guasti",
  },
  faultTypesDesc: {
    en: "Top 5 decoupling causes",
    fr: "Top 5 des causes de découplage",
    it: "Top 5 cause di disaccoppiamento",
  },
  interventionLeaderboard: {
    en: "Intervention Leaderboard",
    fr: "Leaderboard Interventions",
    it: "Classifica Interventi",
  },
  interventionLeaderboardDesc: {
    en: "Operator activity ranking",
    fr: "Classement de l'activité des opérateurs",
    it: "Classifica attività operatori",
  },
  anomalyDetection: {
    en: "Anomaly Detection",
    fr: "Détection d'Anomalies",
    it: "Rilevamento Anomalie",
  },
  anomalyDetectionDesc: {
    en: "Suspicious behaviors or recurring faults detected by algorithm",
    fr: "Comportements suspects ou défauts récurrents détectés par l'algorithme",
    it: "Comportamenti sospetti o guasti ricorrenti rilevati dall'algoritmo",
  },
  successAction: { en: "Success", fr: "Succès", it: "Successo" },
  failureField: {
    en: "Failure/Field",
    fr: "Echec/Terrain",
    it: "Fallimento/Campo",
  },
  operator: { en: "Operator", fr: "Opérateur", it: "Operatore" },
  interventions: { en: "Interventions", fr: "Interventions", it: "Interventi" },
  efficiency: { en: "Efficiency", fr: "Efficacité", it: "Efficienza" },
  hammering: { en: "Hammering", fr: "Acharnement", it: "Accanimento" },
  shortCycle: {
    en: "Short Cycle (Yo-Yo)",
    fr: "Court-Cycle (Yo-Yo)",
    it: "Ciclo Breve (Yo-Yo)",
  },
  recurring: {
    en: "Recurring (Daily)",
    fr: "Récurrent (Journalier)",
    it: "Ricorrente (Giornaliero)",
  },
  critical: { en: "Critical", fr: "Critique", it: "Critico" },

  // Audit Logs
  auditLogTitle: {
    en: "Audit Log",
    fr: "Journal d'Audit",
    it: "Registro di Controllo",
  },
  date: { en: "Date", fr: "Date", it: "Data" },
  target: { en: "Target", fr: "Cible", it: "Bersaglio" },
  details: { en: "Details", fr: "Détails", it: "Dettagli" },
  ip: { en: "IP", fr: "IP", it: "IP" },
  noLogsFound: {
    en: "No logs found",
    fr: "Aucun log trouvé",
    it: "Nessun registro trovato",
  },
  // Faults / Alarms
  fault_unknown: {
    en: "Undetermined Fault",
    fr: "Défaut non déterminable",
    it: "Guasto non determinabile",
  },
  fault_l1_earth: {
    en: "Short-circuit L1 to Earth",
    fr: "Court-circuit phase L1 vers terre",
    it: "Cortocircuito fase L1 verso terra",
  },
  fault_l2_earth: {
    en: "Short-circuit L2 to Earth",
    fr: "Court-circuit phase L2 vers terre",
    it: "Cortocircuito fase L2 verso terra",
  },
  fault_l3_earth: {
    en: "Short-circuit L3 to Earth",
    fr: "Court-circuit phase L3 vers terre",
    it: "Cortocircuito fase L3 verso terra",
  },
  fault_l1_l2: {
    en: "Short-circuit L1-L2",
    fr: "Court-circuit entre phases L1-L2",
    it: "Cortocircuito tra le fasi L1-L2",
  },
  fault_l2_l3: {
    en: "Short-circuit L2-L3",
    fr: "Court-circuit entre phases L2-L3",
    it: "Cortocircuito tra le fasi L2-L3",
  },
  fault_l3_l1: {
    en: "Short-circuit L3-L1",
    fr: "Court-circuit entre phases L3-L1",
    it: "Cortocircuito tra le fasi L3-L1",
  },
  fault_l1_l2_earth: {
    en: "Short-circuit L1-L2 to Earth",
    fr: "Court-circuit phases L1-L2 vers terre",
    it: "Cortocircuito fasi L1-L2 verso terra",
  },
  fault_l3_l1_earth: {
    en: "Short-circuit L3-L1 to Earth",
    fr: "Court-circuit phases L3-L1 vers terre",
    it: "Cortocircuito fasi L3-L1 verso terra",
  },
  fault_l2_l3_earth: {
    en: "Short-circuit L2-L3 to Earth",
    fr: "Court-circuit phases L2-L3 vers terre",
    it: "Cortocircuito fasi L2-L3 verso terra",
  },
  fault_l1_l2_l3: {
    en: "Three-phase Short-circuit",
    fr: "Court-circuit triphasé L1-L2-L3",
    it: "Cortocircuito trifase L1-L2-L3",
  },
  fault_tri_earth: {
    en: "Three-phase Short-circuit to Earth",
    fr: "Court-circuit triphasé vers terre",
    it: "Cortocircuito trifase verso terra",
  },

  // Alarm Messages
  incident_detected: {
    en: "Incident Detected",
    fr: "Incident détecté",
    it: "Incidente rilevato",
  },
  breaker_open_msg: {
    en: "Breaker Open - Production Stopped",
    fr: "Disjoncteur ouvert - Production arrêtée",
    it: "Interruttore aperto - Produzione ferma",
  },

  // Plant Map Status
  statusOffline: { en: "Offline", fr: "Hors ligne", it: "Offline" },
  statusBreakerOpen: {
    en: "Breaker Open",
    fr: "Disjoncteur Ouvert",
    it: "Interruttore Aperto",
  },
  statusMaintenance: {
    en: "Maintenance",
    fr: "Maintenance",
    it: "Manutenzione",
  },
  statusOnline: { en: "Online", fr: "En ligne", it: "Online" },

  // Weather Layers
  clouds: { en: "Clouds", fr: "Nuages", it: "Nuvole" },
  precipitation: {
    en: "Precipitation",
    fr: "Précipitations",
    it: "Precipitazioni",
  },
  weather_temp: { en: "Temperature", fr: "Température", it: "Temperatura" },
  legend_temp: {
    en: "Temperature (°C)",
    fr: "Température (°C)",
    it: "Temperatura (°C)",
  },
  legend_clouds: {
    en: "Cloudiness (%)",
    fr: "Nuages (%)",
    it: "Nuvolosità (%)",
  },
  legend_precip: {
    en: "Precipitation (mm)",
    fr: "Précipitations (mm)",
    it: "Precipitazioni (mm)",
  },

  // Plant Page Headers
  thytronicRelays: {
    en: "Thytronic Relays",
    fr: "Relais Thytronic",
    it: "Relè Thytronic",
  },
  noRelays: {
    en: "No relays configured for this plant.",
    fr: "Aucun relais configuré pour cette centrale.",
    it: "Nessun relè configurato per questo impianto.",
  },
  hypervisor: {
    en: "HI²: Hypervisor",
    fr: "HI²: Hyperviseur",
    it: "HI²: Supervisore",
  },

  // Map Popup & Control Card
  powerOutput: {
    en: "Power Output",
    fr: "Puissance de sortie",
    it: "Potenza in uscita",
  },
  viewSynoptic: {
    en: "View Synoptic",
    fr: "Voir le synoptique",
    it: "Vedi Sinottico",
  },
  relayConfigured: {
    en: "relay configured",
    fr: "relais configuré",
    it: "relè configurato",
  },
  relaysConfigured: {
    en: "relays configured",
    fr: "relais configurés",
    it: "relè configurati",
  },

  // Command Logs
  command_couple: { en: "couple", fr: "couplage", it: "accoppiamento" },
  command_decouple: {
    en: "decouple",
    fr: "découplage",
    it: "disaccoppiamento",
  },
  command_reset: { en: "reset", fr: "réinitialisation", it: "ripristino" },
  log_attempting: { en: "Attempting", fr: "Tentative de", it: "Tentativo di" },
  log_relays: { en: "relays", fr: "relais", it: "relè" },
  log_success: { en: "Success", fr: "Succès", it: "Successo" },
  log_partial_success: {
    en: "Partial Success",
    fr: "Succès Partiel",
    it: "Successo Parziale",
  },
  log_error: { en: "Error", fr: "Erreur", it: "Errore" },

  // Control Results
  ctrl_success_verified: {
    en: "Command executed and verified",
    fr: "Commande exécutée et vérifiée",
    it: "Comando eseguito e verificato",
  },
  commandSentWait: {
    en: "Command sent, verifying status...",
    fr: "Commande envoyée, vérification en cours...",
    it: "Comando inviato, verifica stato...",
  },
  ctrl_sent_failed_verify: {
    en: "Command sent but verification failed",
    fr: "Commande envoyée mais vérification échouée",
    it: "Comando inviato ma verifica fallita",
  },
  ctrl_unsupported: {
    en: "Command not supported by device",
    fr: "Commande non supportée par l'appareil",
    it: "Comando non supportato dal dispositivo",
  },
  ctrl_modbus_error: {
    en: "Modbus communication error",
    fr: "Erreur de communication Modbus",
    it: "Errore di comunicazione Modbus",
  },

  // Months
  month_0: { en: "January", fr: "Janvier", it: "Gennaio" },
  month_1: { en: "February", fr: "Février", it: "Febbraio" },
  month_2: { en: "March", fr: "Mars", it: "Marzo" },
  month_3: { en: "April", fr: "Avril", it: "Aprile" },
  month_4: { en: "May", fr: "Mai", it: "Maggio" },
  month_5: { en: "June", fr: "Juin", it: "Giugno" },
  month_6: { en: "July", fr: "Juillet", it: "Luglio" },
  month_7: { en: "August", fr: "Août", it: "Agosto" },
  month_8: { en: "September", fr: "Septembre", it: "Settembre" },
  month_9: { en: "October", fr: "Octobre", it: "Ottobre" },
  month_10: { en: "November", fr: "Novembre", it: "Novembre" },
  month_11: { en: "December", fr: "Décembre", it: "Dicembre" },
  monthSpecific: {
    en: "Specific Month",
    fr: "Mois spécifique",
    it: "Mese specifico",
  },
  last30Days: {
    en: "Last 30 Days",
    fr: "30 derniers jours",
    it: "Ultimi 30 giorni",
  },
  currentYear: {
    en: "Current Year (Monthly)",
    fr: "Cette année (Mensuel)",
    it: "Anno Corrente (Mensile)",
  },
  month: { en: "Month", fr: "Mois", it: "Mese" },
  year: { en: "Year", fr: "Année", it: "Anno" },
};

export const t = (key: string, lang: Language): string => {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en;
};
