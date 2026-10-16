/* Harbor Stories — translation tables (see js/i18n.js).
 * Each row: [English key, es-419, de-DE, fr-FR, pt-BR, it-IT]. en-GB, es-ES and
 * fr-CA list only where they differ from en-US, es-419 and fr-FR.
 * "Harbor Stories", "StarHermit" and "Brinemist Quay" are names and stay as
 * they are. The Settings → Graphics strings and the StarHermit account strings
 * live in js/settings.js.
 */
(function (root) {
  'use strict';
  var ROWS = [
    // ---- title and chrome
    ['Open water', 'Agua libre', 'Offenes Wasser', 'Eau libre', 'Água livre', 'Acqua libera'],
    ['Settings', 'Ajustes', 'Einstellungen', 'Paramètres', 'Ajustes', 'Impostazioni'],
    ['Loading…', 'Cargando…', 'Wird geladen …', 'Chargement…', 'Carregando…', 'Caricamento…'],
    ['Saving…', 'Guardando…', 'Wird gespeichert …', 'Enregistrement…', 'Salvando…', 'Salvataggio…'],
    ['Synced', 'Sincronizado', 'Synchronisiert', 'Synchronisé', 'Sincronizado', 'Sincronizzato'],
    ['Sync error', 'Error de sincronización', 'Synchronisierungsfehler', 'Erreur de synchronisation', 'Erro de sincronização', 'Errore di sincronizzazione'],
    ['Offline', 'Sin conexión', 'Offline', 'Hors ligne', 'Offline', 'Offline'],
    ['Player', 'Jugador', 'Spieler', 'Joueur', 'Jogador', 'Giocatore'],
    ['Player {id}', 'Jugador {id}', 'Spieler {id}', 'Joueur {id}', 'Jogador {id}', 'Giocatore {id}'],
    ['Harbor leaderboard', 'Clasificación del puerto', 'Hafen-Bestenliste', 'Classement du port', 'Placar do porto', 'Classifica del porto'],
    ['Merge tool chains, repair the coast, and reveal stories around Brinemist Quay.', 'Combina cadenas de herramientas, repara la costa y descubre historias en Brinemist Quay.', 'Kombiniere Werkzeugketten, repariere die Küste und entdecke Geschichten rund um Brinemist Quay.', 'Fusionnez des chaînes d’outils, réparez la côte et découvrez les histoires de Brinemist Quay.', 'Combine cadeias de ferramentas, conserte a costa e descubra histórias em Brinemist Quay.', 'Unisci catene di attrezzi, ripara la costa e scopri le storie di Brinemist Quay.'],
    ['Best score {score}', 'Mejor puntuación {score}', 'Bestwert {score}', 'Meilleur score {score}', 'Melhor pontuação {score}', 'Miglior punteggio {score}'],
    ['Play', 'Jugar', 'Spielen', 'Jouer', 'Jogar', 'Gioca'],
    ['Select a tool, then an open or matching adjacent cell.', 'Elige una herramienta y luego una casilla adyacente libre o con la misma herramienta.', 'Wähle ein Werkzeug, dann ein freies oder passendes Nachbarfeld.', 'Choisissez un outil, puis une case voisine libre ou identique.', 'Escolha uma ferramenta e depois uma casa vizinha livre ou igual.', 'Scegli un attrezzo, poi una casella vicina libera o uguale.'],
    // ---- rejected actions
    ['That cell is empty — pick a tool first.', 'Esa casilla está vacía: primero elige una herramienta.', 'Das Feld ist leer – wähle zuerst ein Werkzeug.', 'Cette case est vide — choisissez d’abord un outil.', 'Essa casa está vazia — escolha uma ferramenta primeiro.', 'Quella casella è vuota: scegli prima un attrezzo.'],
    ['There is nothing there to merge with.', 'Ahí no hay nada con qué combinar.', 'Dort ist nichts zum Kombinieren.', 'Il n’y a rien à fusionner ici.', 'Não há nada ali para combinar.', 'Lì non c’è niente da unire.'],
    ['That cell is already taken.', 'Esa casilla ya está ocupada.', 'Das Feld ist schon belegt.', 'Cette case est déjà occupée.', 'Essa casa já está ocupada.', 'Quella casella è già occupata.'],
    ['Pick a different destination.', 'Elige otro destino.', 'Wähle ein anderes Ziel.', 'Choisissez une autre destination.', 'Escolha outro destino.', 'Scegli un’altra destinazione.'],
    ['Tools only merge on touching cells.', 'Las herramientas solo se combinan en casillas contiguas.', 'Werkzeuge verbinden sich nur auf benachbarten Feldern.', 'Les outils ne fusionnent que sur des cases voisines.', 'As ferramentas só se combinam em casas vizinhas.', 'Gli attrezzi si uniscono solo su caselle vicine.'],
    ['Only two identical tools merge.', 'Solo se combinan dos herramientas idénticas.', 'Nur zwei gleiche Werkzeuge verbinden sich.', 'Seuls deux outils identiques fusionnent.', 'Só duas ferramentas iguais se combinam.', 'Si uniscono solo due attrezzi identici.'],
    ['That tool is already a masterwork.', 'Esa herramienta ya es una obra maestra.', 'Dieses Werkzeug ist schon ein Meisterstück.', 'Cet outil est déjà un chef-d’œuvre.', 'Essa ferramenta já é uma obra-prima.', 'Quell’attrezzo è già un capolavoro.'],
    ['No task wants that tool right now.', 'Ninguna tarea necesita esa herramienta ahora.', 'Gerade braucht keine Aufgabe dieses Werkzeug.', 'Aucune tâche ne demande cet outil pour l’instant.', 'Nenhuma tarefa precisa dessa ferramenta agora.', 'Nessun compito richiede quell’attrezzo ora.'],
    ['This round is over — play again to continue.', 'Esta ronda terminó: juega de nuevo para continuar.', 'Diese Runde ist vorbei – spiel noch einmal, um weiterzumachen.', 'Cette manche est terminée — rejouez pour continuer.', 'Esta rodada acabou — jogue de novo para continuar.', 'Questo round è finito: gioca ancora per continuare.'],
    ['That action is not available.', 'Esa acción no está disponible.', 'Diese Aktion ist nicht verfügbar.', 'Cette action n’est pas disponible.', 'Essa ação não está disponível.', 'Questa azione non è disponibile.'],
    ['harbor locked', 'puerto bloqueado', 'Hafen blockiert', 'port bloqué', 'porto travado', 'porto bloccato'],
    ['move limit', 'límite de movimientos', 'Zuglimit erreicht', 'limite de coups', 'limite de jogadas', 'limite di mosse'],
    ['time up', 'se acabó el tiempo', 'Zeit abgelaufen', 'temps écoulé', 'tempo esgotado', 'tempo scaduto'],
    ['resigned', 'abandonado', 'aufgegeben', 'abandon', 'desistência', 'abbandonato'],
    ['round over', 'ronda terminada', 'Runde vorbei', 'manche terminée', 'rodada encerrada', 'round finito'],
    // ---- events
    ['Tool moved.', 'Herramienta movida.', 'Werkzeug verschoben.', 'Outil déplacé.', 'Ferramenta movida.', 'Attrezzo spostato.'],
    ['Merged into {item}. +{points} (streak {streak})', 'Combinado en {item}. +{points} (racha {streak})', 'Kombiniert: {item}. +{points} (Serie {streak})', 'Fusionné en {item}. +{points} (série {streak})', 'Combinado em {item}. +{points} (sequência {streak})', 'Unito in {item}. +{points} (serie {streak})'],
    ['Merged into {item}. +{points}', 'Combinado en {item}. +{points}', 'Kombiniert: {item}. +{points}', 'Fusionné en {item}. +{points}', 'Combinado em {item}. +{points}', 'Unito in {item}. +{points}'],
    ['Delivered {item} to {task}. +{points}', 'Entregado: {item} para «{task}». +{points}', '{item} geliefert an „{task}“. +{points}', '{item} livré pour « {task} ». +{points}', '{item} entregue para “{task}”. +{points}', '{item} consegnato per «{task}». +{points}'],
    ['{task} complete!', '¡«{task}» completado!', '„{task}“ erledigt!', '« {task} » terminé !', '“{task}” concluída!', '«{task}» completato!'],
    ['Round {n} begins.', 'Empieza la ronda {n}.', 'Runde {n} beginnt.', 'La manche {n} commence.', 'Começa a rodada {n}.', 'Inizia il round {n}.'],
    ['Every task is done — the harbor is restored!', 'Todas las tareas están hechas: ¡el puerto está restaurado!', 'Alle Aufgaben erledigt – der Hafen ist wiederhergestellt!', 'Toutes les tâches sont faites — le port est restauré !', 'Todas as tarefas concluídas — o porto foi restaurado!', 'Tutti i compiti sono fatti: il porto è restaurato!'],
    ['The tide brought 1 new supply.', 'La marea trajo 1 suministro nuevo.', 'Die Flut brachte 1 neuen Vorrat.', 'La marée a apporté 1 nouvelle fourniture.', 'A maré trouxe 1 suprimento novo.', 'La marea ha portato 1 nuova scorta.'],
    ['The tide brought {n} new supplies.', 'La marea trajo {n} suministros nuevos.', 'Die Flut brachte {n} neue Vorräte.', 'La marée a apporté {n} nouvelles fournitures.', 'A maré trouxe {n} suprimentos novos.', 'La marea ha portato {n} nuove scorte.'],
    ['Move complete.', 'Movimiento hecho.', 'Zug ausgeführt.', 'Coup joué.', 'Jogada feita.', 'Mossa fatta.'],
    ['Achievement unlocked: {names}.', 'Logro desbloqueado: {names}.', 'Erfolg freigeschaltet: {names}.', 'Succès débloqué : {names}.', 'Conquista desbloqueada: {names}.', 'Obiettivo sbloccato: {names}.'],
    ['Choose a tool first.', 'Primero elige una herramienta.', 'Wähle zuerst ein Werkzeug.', 'Choisissez d’abord un outil.', 'Escolha uma ferramenta primeiro.', 'Scegli prima un attrezzo.'],
    ['{item} selected. Choose its destination or Deliver.', '{item} seleccionado. Elige su destino o Entregar.', '{item} gewählt. Wähle ein Ziel oder Liefern.', '{item} sélectionné. Choisissez sa destination ou Livrer.', '{item} selecionado. Escolha o destino ou Entregar.', '{item} selezionato. Scegli la destinazione o Consegna.'],
    ['Selection cleared.', 'Selección borrada.', 'Auswahl aufgehoben.', 'Sélection annulée.', 'Seleção limpa.', 'Selezione annullata.'],
    ['Select a requested tool before delivering.', 'Selecciona una herramienta pedida antes de entregar.', 'Wähle vor dem Liefern ein angefordertes Werkzeug.', 'Sélectionnez un outil demandé avant de livrer.', 'Selecione uma ferramenta pedida antes de entregar.', 'Seleziona un attrezzo richiesto prima di consegnare.'],
    ['No legal action is available.', 'No hay ninguna acción válida.', 'Kein gültiger Zug möglich.', 'Aucune action possible.', 'Nenhuma ação válida disponível.', 'Nessuna azione valida disponibile.'],
    ['Hint: deliver {item}.', 'Pista: entrega {item}.', 'Tipp: liefere {item}.', 'Indice : livrez {item}.', 'Dica: entregue {item}.', 'Suggerimento: consegna {item}.'],
    ['Hint: merge from row {r1}, column {c1} to row {r2}, column {c2}.', 'Pista: combina de la fila {r1}, columna {c1} a la fila {r2}, columna {c2}.', 'Tipp: kombiniere von Reihe {r1}, Spalte {c1} nach Reihe {r2}, Spalte {c2}.', 'Indice : fusionnez de la ligne {r1}, colonne {c1} vers la ligne {r2}, colonne {c2}.', 'Dica: combine da linha {r1}, coluna {c1} para a linha {r2}, coluna {c2}.', 'Suggerimento: unisci dalla riga {r1}, colonna {c1} alla riga {r2}, colonna {c2}.'],
    ['Hint: move from row {r1}, column {c1} to row {r2}, column {c2}.', 'Pista: mueve de la fila {r1}, columna {c1} a la fila {r2}, columna {c2}.', 'Tipp: verschiebe von Reihe {r1}, Spalte {c1} nach Reihe {r2}, Spalte {c2}.', 'Indice : déplacez de la ligne {r1}, colonne {c1} vers la ligne {r2}, colonne {c2}.', 'Dica: mova da linha {r1}, coluna {c1} para a linha {r2}, coluna {c2}.', 'Suggerimento: sposta dalla riga {r1}, colonna {c1} alla riga {r2}, colonna {c2}.'],
    ['Sound off.', 'Sonido desactivado.', 'Ton aus.', 'Son coupé.', 'Som desligado.', 'Audio disattivato.'],
    ['Sound on.', 'Sonido activado.', 'Ton an.', 'Son activé.', 'Som ligado.', 'Audio attivato.'],
    // ---- board and end card
    ['Row {r}, column {c}: {item}', 'Fila {r}, columna {c}: {item}', 'Reihe {r}, Spalte {c}: {item}', 'Ligne {r}, colonne {c} : {item}', 'Linha {r}, coluna {c}: {item}', 'Riga {r}, colonna {c}: {item}'],
    ['Harbor restored!', '¡Puerto restaurado!', 'Hafen wiederhergestellt!', 'Port restauré !', 'Porto restaurado!', 'Porto restaurato!'],
    ['Round over', 'Ronda terminada', 'Runde vorbei', 'Manche terminée', 'Rodada encerrada', 'Round finito'],
    ['Score {score}', 'Puntuación {score}', 'Punkte {score}', 'Score {score}', 'Pontuação {score}', 'Punti {score}'],
    ['Best {best}', 'Mejor {best}', 'Bestwert {best}', 'Meilleur {best}', 'Melhor {best}', 'Migliore {best}'],
    ['Play again', 'Jugar de nuevo', 'Nochmal spielen', 'Rejouer', 'Jogar de novo', 'Gioca ancora'],
    ['Moves {moves} · Score {score}', 'Movimientos {moves} · Puntos {score}', 'Züge {moves} · Punkte {score}', 'Coups {moves} · Score {score}', 'Jogadas {moves} · Pontos {score}', 'Mosse {moves} · Punti {score}'],
    ['Restoration tasks', 'Tareas de restauración', 'Restaurierungsaufgaben', 'Tâches de restauration', 'Tarefas de restauração', 'Compiti di restauro'],
    ['Deliver selected', 'Entregar selección', 'Auswahl liefern', 'Livrer la sélection', 'Entregar seleção', 'Consegna selezione'],
    ['Hint', 'Pista', 'Tipp', 'Indice', 'Dica', 'Suggerimento'],
    ['Restart', 'Reiniciar', 'Neu starten', 'Recommencer', 'Reiniciar', 'Ricomincia'],
    ['Sound: off', 'Sonido: no', 'Ton: aus', 'Son : non', 'Som: desligado', 'Audio: no'],
    ['Sound: on', 'Sonido: sí', 'Ton: an', 'Son : oui', 'Som: ligado', 'Audio: sì'],
    // ---- content: tools (tier names)
    ['Mallet', 'Mazo', 'Holzhammer', 'Maillet', 'Marreta', 'Mazzuolo'],
    ['Claw Hammer', 'Martillo de uña', 'Klauenhammer', 'Marteau arrache-clou', 'Martelo de unha', 'Martello da carpentiere'],
    ['Sledge', 'Almádena', 'Vorschlaghammer', 'Masse', 'Marretão', 'Mazza'],
    ['Forge Hammer', 'Martillo de forja', 'Schmiedehammer', 'Marteau de forge', 'Martelo de forja', 'Martello da forgia'],
    ['Twine', 'Cordel', 'Schnur', 'Ficelle', 'Barbante', 'Spago'],
    ['Rope Coil', 'Rollo de cuerda', 'Seilrolle', 'Rouleau de corde', 'Rolo de corda', 'Rotolo di corda'],
    ['Mooring Line', 'Amarra', 'Festmacherleine', 'Amarre', 'Cabo de amarração', 'Cima d’ormeggio'],
    ['Anchor Cable', 'Cable del ancla', 'Ankerkabel', 'Câble d’ancre', 'Cabo da âncora', 'Cavo dell’ancora'],
    ['Candle Lamp', 'Lámpara de vela', 'Kerzenlampe', 'Lampe à bougie', 'Lamparina de vela', 'Lume a candela'],
    ['Pier Lantern', 'Farol del muelle', 'Steglaterne', 'Lanterne du quai', 'Lanterna do píer', 'Lanterna del molo'],
    ['Storm Lantern', 'Farol de tormenta', 'Sturmlaterne', 'Lanterne tempête', 'Lanterna de tempestade', 'Lanterna da tempesta'],
    ['Harbor Beacon', 'Faro del puerto', 'Hafenfeuer', 'Phare du port', 'Farol do porto', 'Faro del porto'],
    ['Chip Brush', 'Brocha', 'Flachpinsel', 'Pinceau plat', 'Trincha', 'Pennellessa'],
    ['Paintbrush', 'Pincel', 'Malerpinsel', 'Pinceau', 'Pincel', 'Pennello'],
    ['Wide Roller', 'Rodillo ancho', 'Breite Rolle', 'Grand rouleau', 'Rolo largo', 'Rullo largo'],
    ['Mural Kit', 'Kit de mural', 'Wandbild-Set', 'Kit de fresque', 'Kit de mural', 'Kit da murale'],
    ['Hand Net', 'Red de mano', 'Handnetz', 'Épuisette', 'Puçá', 'Retino'],
    ['Cast Net', 'Atarraya', 'Wurfnetz', 'Épervier', 'Tarrafa', 'Giacchio'],
    ['Trawl Net', 'Red de arrastre', 'Schleppnetz', 'Chalut', 'Rede de arrasto', 'Rete a strascico'],
    ['Harbor Seine', 'Jábega del puerto', 'Hafen-Zugnetz', 'Senne du port', 'Rede de cerco do porto', 'Sciabica del porto'],
    ['Loose Brick', 'Ladrillo suelto', 'Loser Ziegel', 'Brique libre', 'Tijolo solto', 'Mattone sciolto'],
    ['Paver Stack', 'Pila de adoquines', 'Pflasterstapel', 'Pile de pavés', 'Pilha de pavers', 'Pila di cubetti'],
    ['Stone Block', 'Bloque de piedra', 'Steinblock', 'Bloc de pierre', 'Bloco de pedra', 'Blocco di pietra'],
    ['Harbor Keystone', 'Piedra angular del puerto', 'Hafen-Schlussstein', 'Clé de voûte du port', 'Pedra angular do porto', 'Chiave di volta del porto'],
    // ---- content: the opening stage
    ['First Light Repairs', 'Reparaciones al alba', 'Reparaturen im Morgengrauen', 'Réparations à l’aube', 'Reparos ao amanhecer', 'Riparazioni all’alba'],
    ['Merge two matching tools side by side to build better ones, then deliver what the repairs ask for.', 'Combina dos herramientas iguales contiguas para crear otras mejores y entrega lo que piden las reparaciones.', 'Kombiniere zwei gleiche Werkzeuge nebeneinander zu besseren und liefere, was die Reparaturen verlangen.', 'Fusionnez deux outils identiques côte à côte pour en créer de meilleurs, puis livrez ce que demandent les réparations.', 'Combine duas ferramentas iguais lado a lado para criar outras melhores e entregue o que os reparos pedem.', 'Unisci due attrezzi uguali vicini per crearne di migliori, poi consegna ciò che chiedono le riparazioni.'],
    ['Coil the mooring lines', 'Enrolla las amarras', 'Festmacherleinen aufschießen', 'Lover les amarres', 'Enrole os cabos de amarração', 'Avvolgi le cime d’ormeggio'],
    ['Hang the pier lamp', 'Cuelga la lámpara del muelle', 'Steglampe aufhängen', 'Accrocher la lampe du quai', 'Pendure a luminária do píer', 'Appendi la lampada del molo'],
    // ---- content: achievements
    ['First Merge', 'Primera combinación', 'Erste Kombination', 'Première fusion', 'Primeira combinação', 'Prima unione'],
    ['Signed & Delivered', 'Firmado y entregado', 'Unterschrieben & geliefert', 'Signé et livré', 'Assinado e entregue', 'Firmato e consegnato'],
    ['First Repair', 'Primera reparación', 'Erste Reparatur', 'Première réparation', 'Primeiro reparo', 'Prima riparazione'],
    ['Masterwork', 'Obra maestra', 'Meisterstück', 'Chef-d’œuvre', 'Obra-prima', 'Capolavoro'],
    ['Harbor Rhythm', 'Ritmo del puerto', 'Hafenrhythmus', 'Rythme du port', 'Ritmo do porto', 'Ritmo del porto'],
    ['Dock Veteran', 'Veterano del muelle', 'Kai-Veteran', 'Vétéran des quais', 'Veterano do cais', 'Veterano del molo'],
    ['Half the Quay', 'Medio muelle', 'Der halbe Kai', 'La moitié du quai', 'Metade do cais', 'Metà della banchina'],
    ['Keeper of Brinemist', 'Guardián de Brinemist', 'Hüter von Brinemist', 'Gardien de Brinemist', 'Guardião de Brinemist', 'Custode di Brinemist'],
    ['Regular at the Quay', 'Habitual del muelle', 'Stammgast am Kai', 'Habitué du quai', 'Frequentador do cais', 'Habitué della banchina'],
    ['Neighborhood Hero', 'Héroe del barrio', 'Held der Nachbarschaft', 'Héros du quartier', 'Herói do bairro', 'Eroe del quartiere']
  ];

  // Regional variants: only where they differ from en-US, es-419 and fr-FR.
  var EN_GB = {
    'Harbor leaderboard': 'Harbour leaderboard',
    'Every task is done — the harbor is restored!': 'Every task is done — the harbour is restored!',
    'Harbor restored!': 'Harbour restored!',
    'harbor locked': 'harbour locked',
    'Harbor Beacon': 'Harbour Beacon',
    'Harbor Seine': 'Harbour Seine',
    'Harbor Keystone': 'Harbour Keystone',
    'Harbor Rhythm': 'Harbour Rhythm',
    'Neighborhood Hero': 'Neighbourhood Hero'
  };
  var ES_ES = {
    'This round is over — play again to continue.': 'Esta ronda ha terminado: vuelve a jugar para continuar.',
    'Choose a tool first.': 'Primero, elige una herramienta.',
    'Pier Lantern': 'Farol del embarcadero',
    'Hang the pier lamp': 'Cuelga la lámpara del embarcadero'
  };
  var FR_CA = {
    'Score {score}': 'Pointage {score}',
    'Moves {moves} · Score {score}': 'Coups {moves} · Pointage {score}',
    'Best score {score}': 'Meilleur pointage {score}'
  };

  var T = { 'es-419': {}, 'de-DE': {}, 'fr-FR': {}, 'pt-BR': {}, 'it-IT': {} };
  var COLS = ['es-419', 'de-DE', 'fr-FR', 'pt-BR', 'it-IT'];
  ROWS.forEach(function (r) {
    for (var i = 0; i < COLS.length; i++) T[COLS[i]][r[0]] = r[i + 1];
  });
  T['en-GB'] = EN_GB;
  T['es-ES'] = ES_ES;
  T['fr-CA'] = FR_CA;
  root.HS_STRINGS = T;
})(typeof self !== 'undefined' ? self : this);
