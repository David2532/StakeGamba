# Stake Engine Approval Audit

Stand der Dokumentationsrecherche: 4. August 2026

## Zweck und Wahrheitsgrenze

Dieses Dokument normalisiert die vom Projektinhaber bereitgestellte Stake-Engine-Checkliste in exakt 51 eindeutige Gates. Es ist eine Anforderungs- und Nachweismatrix, kein Freigabebericht. Es enthält deshalb bewusst keine `PASS`-Status und darf nicht als Nachweis einer Stake-Freigabe verwendet werden.

Die öffentlich erreichbare Stake-Engine-Seite [Submission Checklist][submission-checklist] bestätigt, dass die dortige Checkliste die Review-Kriterien enthält, zeigt die einzelnen Kriterien jedoch nur nach Anmeldung. Der exakte Wortlaut und die Zählung der 51 Gates stammen daher aus der vom Projektinhaber bereitgestellten Checklisten-Kopie. Soweit möglich, ist jedes Gate zusätzlich gegen öffentlich erreichbare offizielle Stake-Engine-Dokumentation abgeglichen. Wo eine genaue Aussage öffentlich nicht belegt ist, ist dies ausdrücklich markiert.

Eine automatisierte Prüfung kann technische Evidenz erzeugen. Sie ersetzt weder visuelle Qualitätsentscheidungen noch eine Konfiguration im Stake Admin Control Panel, eine Stake-Prüfung oder eine Veröffentlichung.

## Klassifikation

- **Automated**: mit deterministischen Unit-, Contract-, Netzwerk- oder Browserprüfungen nachweisbar.
- **Manual**: erfordert menschliche visuelle, akustische, inhaltliche oder Geräteprüfung.
- **External**: hängt von Stake, einem externen Portal, einer geschützten Umgebung oder einem externen Kommunikationskanal ab.
- **Not applicable**: nur zulässig, wenn das im Gate genannte Feature nachweislich nicht vorhanden ist und die N/A-Begründung geprüft wurde.
- **Automatisierbarkeit `voll`**: das Gate kann als klarer technischer Vertrag geprüft werden.
- **Automatisierbarkeit `teilweise`**: Automation liefert Evidenz, die menschliche oder externe Entscheidung bleibt erforderlich.
- **Automatisierbarkeit `nein`**: der entscheidende Zustandswechsel findet außerhalb des Builds statt.

## Offizielle Quellen

- [AG — Approval Guidelines][approval-guidelines]
- [FE — Frontend and Communication][frontend]
- [JR — Jurisdiction Requirements][jurisdiction]
- [RP — Bet Replay][replay]
- [RGS — RGS Details][rgs]
- [WAL — RGS Wallet][wallet]
- [RC — RGS Communication][rgs-communication]
- [GD — General Game Disclaimer][disclaimer]
- [GT — Game Tile Visual Asset Requirements][game-tile]
- [ME — Game Event Structures][math-events]
- [SC — Submission Checklist][submission-checklist]

## 51-Gate-Matrix

`Checklisten-Kopie` bedeutet, dass die genaue Formulierung nur in der bereitgestellten Checkliste sichtbar war. Ein zusätzlicher offizieller Quellcode nennt die öffentlich dokumentierte fachliche Grundlage.

| Nr. | Bereich | Normalisierte Anforderung | Quellenbasis | Klassifikation | Automatisierbarkeit | Erforderliche Evidenz |
|---:|---|---|---|---|---|---|
| 1 | PreChecks | Das Spiel authentifiziert beim Start erfolgreich gegen das übergebene RGS. | Checklisten-Kopie; RGS, WAL | Automated | voll | Netzwerkbeweis für erfolgreichen `/wallet/authenticate`-Aufruf mit der gestarteten Version. |
| 2 | PreChecks | Eine ungültige `rgs_url` führt zu einem kontrollierten Authentifizierungsfehler und nicht zu normalem Spiel. | Checklisten-Kopie; RGS, RC | Automated | voll | Negativtest mit ungültiger URL, sichtbarer Fehlerzustand und keine nachfolgenden Wallet-Aktionen. |
| 3 | PreChecks | Die Play-Schaltfläche löst eine erfolgreiche RGS-Play-Anfrage aus. | Checklisten-Kopie; RGS, WAL | Automated | voll | Request/Response-Protokoll für `/wallet/play`, einschließlich Betrag und Modus. |
| 4 | PreChecks | Das ausgelieferte Spiel enthält keinen Stake Engine Loader. | Checklisten-Kopie; öffentlich nicht einzeln belegt | Automated | voll | Dateibaum-, DOM-, Asset- und Netzwerkprüfung gegen Loader-Code und Loader-Assets. |
| 5 | Compliance | Der Spieltitel ist eindeutig und enthält keine für die Zieljurisdiktion unzulässige Terminologie. | Checklisten-Kopie; AG, JR | Automated + Manual | teilweise | Wortgrenzenbasierter Textscan sowie menschliche Titel-/Markenprüfung. |
| 6 | Compliance | Assets und Bildsprache enthalten keine beleidigenden, unangemessenen oder minderjährigenbezogenen Inhalte. | AG | Manual | nein | Dokumentierte visuelle Inhaltsprüfung der exakten Frontend-Artefakte. |
| 7 | Compliance | Spiel, Serie, Audio und visuelle Assets sind ausreichend eigenständig. | AG, FE | Manual | nein | Reviewer-Beurteilung zu Originalität, Abgrenzung und Rechten. |
| 8 | Game Thumbnail | Die Tile-/Thumbnail-Assets erfüllen die Artwork-Vorgaben. | GT | Manual | teilweise | Größen-, Format- und Dateinamensprüfung plus visuelle Prüfung bei kleinen Darstellungsgrößen. |
| 9 | Bet Levels | Alle relevanten Wett-/Play-Parameter werden dynamisch aus der Authenticate-Antwort übernommen. | RC, RGS | Automated | voll | Contract-Tests für `minBet`, `maxBet`, `stepBet`, `defaultBetLevel` und `betLevels`. |
| 10 | Bet Levels | Eine aktive Runde stellt den Betrag aus der Authenticate-Antwort wieder her. | WAL, RGS | Automated | voll | Resume-Test mit `round.active` und exakt wiederhergestelltem Betrag/Modus. |
| 11 | Currency | Unterstützte Währungen werden mit korrektem Symbol, Position und Dezimalpräzision angezeigt. | RGS, RC, FE | Automated | voll | Parameterisierte Currency-Tests gegen die offizielle Metadatentabelle. |
| 12 | Currency | Kleine, nicht-null Gewinne werden exakt und niemals als null angezeigt. | RGS, FE | Automated | voll | Präzisionstests mit Sub-Cent-Werten; Balance und In-Game-Win getrennt prüfen. |
| 13 | RGS Requests | Ein Zero-Win-Ergebnis sendet gemäß der projektspezifischen Checkliste keinen End-Round-Request. | Checklisten-Kopie; WAL beschreibt End Round allgemein, bestätigt diese Sonderregel öffentlich nicht | Automated | voll | Negativer Netzwerkbeweis für Zero-Win-Szenarien und dokumentierter Round-Lifecycle-Vertrag. |
| 14 | RGS Requests | Bei unzureichender Balance wird kein Play-Request gesendet. | Checklisten-Kopie; RGS/WAL dokumentieren `ERR_IPB`, die Client-Prävention nicht wörtlich | Automated | voll | UI-/Contract-Test mit zu niedrigem RGS-Balancewert und null `/wallet/play`-Requests. |
| 15 | Frontend | Der Haupt-Spielrahmen ist nicht scrollbar. | Checklisten-Kopie; FE fordert fehlerfreie skalierte Darstellung | Automated | voll | Browserprüfung von `scrollWidth`, `scrollHeight`, Overflow und Fokus-Scrollen an Ziel-Viewports. |
| 16 | Frontend | Die Leertaste ist an die Play-Schaltfläche gebunden. | FE | Automated | voll | Keyboard-E2E mit genau einer erlaubten Play-Aktion und Sperrtests in Modalen/Replay. |
| 17 | Game Rules | RTP und maximaler Gewinn sind in den Regeln klar angegeben, je Modus falls erforderlich. | FE | Automated | voll | Struktur- und Inhaltsprüfung gegen die veröffentlichte Math-Konfiguration. |
| 18 | Game Rules | Die Werte aller Symbole und Kombinationen werden vollständig kommuniziert. | FE | Automated | voll | Paytable-/Symbol-Contract gegen Produktionsmath und sichtbare Game Information. |
| 19 | Game Rules | Gewinnkombinationen und ihre Auswertung sind in den Regeln beschrieben. | FE | Automated | voll | Inhaltsprüfung plus konkrete Szenarien gegen die dokumentierte Auswertungslogik. |
| 20 | Game Rules | Jeder Spielmodus enthält Beschreibung, Kostenmultiplikator und ausgelöste Aktion. | FE | Automated | voll | Modusmatrix zwischen Math, RGS-Konfiguration, Replay-Namen und Game Information. |
| 21 | Game Rules | Free-Game- und Re-Trigger-Bedingungen sind vollständig beschrieben. | FE | Automated | voll | Inhaltsprüfung gegen die tatsächlich ausgelieferten Trigger- und Re-Trigger-Regeln. |
| 22 | Game Rules | Die Game Information enthält einen sachlich gleichwertigen allgemeinen Disclaimer. | GD | Automated | voll | Normalisierter Textvergleich gegen die erforderliche Aussage, nicht nur gegen einen Dateipfad. |
| 23 | Auto Play | Auto-Play benötigt vor dem Start eine Bestätigung. | FE | Automated | voll | Browsertest: Auswahl und separate Bestätigung; kein sofortiges serielles Play. |
| 24 | Auto Play | Modi mit hohen Kosten benötigen vor Aktivierung eine Bestätigung. | Checklisten-Kopie; öffentlich nicht einzeln belegt | Automated + Manual | teilweise | Browsertest für jeden betroffenen Modus plus Review der Schwellen-/Warntexte. |
| 25 | Responsive | Das Spiel funktioniert auf Desktop- und Laptop-Viewports. | FE | Automated + Manual | teilweise | Browsermatrix, Screenshots und Interaktionsprüfung des exakten Pakets. |
| 26 | Responsive | Das Spiel funktioniert in Popout S und Popout L ohne verzerrtes Board oder unbenutzbare UI. | Checklisten-Kopie; FE | Automated + Manual | teilweise | Viewport- und Interaktionsmatrix mit Overflow-/Überlappungsnachweisen. |
| 27 | Responsive | Das Spiel funktioniert auf gebräuchlichen Mobile-Viewports. | FE | Automated + Manual | teilweise | Touch-/Viewport-E2E plus visuelle Prüfung auf realen oder repräsentativen Geräten. |
| 28 | Responsive | Double-Tap-Zoom ist auf Mobilgeräten deaktiviert, ohne Accessibility-Zoom pauschal zu zerstören. | Checklisten-Kopie; öffentlich nicht einzeln belegt | Automated | voll | Mobile-Browserprüfung der relevanten Touch-Gesten und Viewport-Konfiguration. |
| 29 | Responsive | Die Game Information enthält einen Interaktions-/UI-Guide für alle Bedienelemente. | FE | Automated | voll | Vollständigkeitsmapping sichtbarer Controls zu erklärenden Einträgen. |
| 30 | Sounds / Music | Sound und Musik können deaktiviert werden; der Zustand wirkt zuverlässig. | FE | Automated + Manual | teilweise | State-/Persistenztest plus menschliche akustische Prüfung. |
| 31 | Languages | Englisch wird vollständig unterstützt. | RC | Automated | voll | Vollständigkeitsprüfung aller sichtbaren Zustände, dynamischen Texte und Accessibility-Labels. |
| 32 | Languages | Ungültige oder nicht unterstützte Sprachparameter beschädigen die Anzeige nicht. | RC | Automated | voll | Negativmatrix für unbekannte, leere und fehlerhafte `lang`-Werte. |
| 33 | Gameplay / Rules | Mindestens fünf Gewinne je Spielmodus werden gegen die Game Rules geprüft. | Checklisten-Kopie; FE fordert Playtests gegen die Regeln | Manual + Automated | teilweise | Reproduzierbare Event-IDs/Fixtures, Berechnungsprotokolle und visuelle Szenarioprüfung. |
| 34 | Mystery Mode | Falls ein Mystery Mode existiert, stimmen alle sichtbaren Chancen und Wahrscheinlichkeiten. | Checklisten-Kopie; öffentlich nicht einzeln belegt | Automated oder Not applicable | voll | Math-/UI-Vertrag; bei N/A Feature-Inventar und genehmigte Begründung. |
| 35 | Stake.US | Social Mode verwendet die vorgeschriebenen Übersetzungen. | JR | Automated | voll | Wortgrenzenbasierter Scan aller sichtbaren Texte, ARIA-, ALT- und TITLE-Werte in allen Zuständen. |
| 36 | Stake.US | XGC und XSC werden als GC beziehungsweise SC und ohne Dollarpräfix angezeigt. | RGS, RC | Automated | voll | Currency-Matrix für UI, Replay, Game Information, Modale und Fehlerzustände. |
| 37 | Stake.US | Modusnamen verwenden konsistente Social-Mode-Terminologie. | Checklisten-Kopie; JR | Automated + Manual | teilweise | Mapping zwischen internen Modi, sichtbaren Spielnamen und Replay-Namen sowie Textreview. |
| 38 | Stake.US | Das Replay-Fenster enthält keine eingeschränkten Wörter oder Wendungen. | Checklisten-Kopie; JR, RP | Automated | voll | Wortgrenzenbasierter Scan in Loading, Ready, Running, Completed, Error und Play Again. |
| 39 | Stake.US | Im Social Mode wird nur Englisch angeboten beziehungsweise eine ungültige Sprache fällt sicher auf Englisch zurück. | Checklisten-Kopie; RC bestätigt Englisch als einzige Pflichtsprache, nicht diese Social-Sonderregel | Automated | voll | Social-Mode-Sprachmatrix und Scan auf gemischte oder beschädigte Texte. |
| 40 | Replay | Replay-URLs laden und spielen das gewünschte Event vollständig. | RP | Automated | voll | E2E je Modus mit URL-Identität, Fetch-Endpunkt, Event-ID und deterministischem Abschluss. |
| 41 | Replay | Replay verarbeitet Pflichtparameter und optionale Parameter wie Währung, Sprache, Betrag, Gerät und Social Mode. | RP | Automated | voll | Parameter-Matrix für `replay`, `game`, `version`, `mode`, `event`, `rgs_url`, `currency`, `amount`, `lang`, `device`, `social`. |
| 42 | Replay | Nach Abschluss kann dasselbe Event über Play Again erneut abgespielt werden. | RP | Automated | voll | Zwei vollständige Durchläufe ohne neue Session-/Wallet-Anfragen oder Zustandsleck. |
| 43 | Replay | Die Replay-UI zeigt Play-Kosten, angewandte Multiplikatoren und Gesamtgewinn mathematisch konsistent. | RP, RGS, FE | Automated | voll | Rechenvertrag: Kosten aus Base Amount und `costMultiplier`; Gesamtgewinn aus Base Amount und `payoutMultiplier`; Abgleich mit sichtbarem Endzustand. |
| 44 | Replay | Replay funktioniert in Popout S ohne abgeschnittene Ergebnisse, Controls oder Texte. | Checklisten-Kopie; FE, RP | Automated + Manual | teilweise | Replay-Viewport-E2E, Geometrieprüfung und Screenshot des exakten Pakets. |
| 45 | Final Approval | Die geforderten Bet-Level-Templates sind im Stake-System angewendet. | Checklisten-Kopie; SC; öffentlich keine Detailanleitung sichtbar | External | teilweise | Export/Screenshot der externen Konfiguration für die exakte Version; keine lokale Selbstbestätigung. |
| 46 | Final Approval | Provably Fair und Replay sind im Stake-System aktiviert. | Checklisten-Kopie; RP; SC | External | nein | Expliziter externer Aktivierungsnachweis für die exakte Frontend-/Math-Version. |
| 47 | Final Approval | Frontend- und Math-Anfragen wurden von Stake genehmigt. | Checklisten-Kopie; AG, SC | External | nein | Stake-Freigaberecord mit Versions- und Artefaktidentität. |
| 48 | Final Approval | Das Spiel wurde im vorgesehenen `stake-engine-game-approved`-Kanal veröffentlicht. | Checklisten-Kopie; öffentlich nicht einzeln belegt | External | nein | Externe Nachrichtenreferenz; darf nicht aus Repositorydaten abgeleitet werden. |
| 49 | Final Approval | Das Spiel funktioniert auf älteren Android- und iOS-Geräten. | Checklisten-Kopie; FE fordert gebräuchliche Mobile-Geräte | Manual | teilweise | Benannte Geräte-/OS-Matrix, reale Testläufe und visuelle Evidenz. |
| 50 | Final Approval | Nach tatsächlichem Go-live wird die Approval-Anfrage geschlossen und die externe Benachrichtigung aktualisiert. | Checklisten-Kopie; öffentlich nicht einzeln belegt | External | nein | Go-live-Referenz, geschlossene Anfrage und externe Nachrichtenreferenz. |
| 51 | Final Approval | Das Spiel wurde tatsächlich veröffentlicht. | Checklisten-Kopie; AG, SC | External | nein | Explizite Stake-Live-Referenz für die genehmigte Version; kein Build oder grüner CI-Lauf genügt. |

## Verbindliche Terminologie für Stake.US

Die öffentliche [Jurisdiction Requirements][jurisdiction]-Seite ordnet die Einschränkungen Stake.US beziehungsweise `social=true` zu und weist darauf hin, dass sie vor allem Regeln, potenziell aber auch Bilder und UI betreffen. Die folgende Liste ist dedupliziert; interne API-Feldnamen dürfen bestehen bleiben, solange sie nie sichtbar oder über Accessibility-Metadaten ausgegeben werden.

| Eingeschränkt | Vorgeschlagene sichere Formulierung |
|---|---|
| `win feature` | `play feature` |
| `pay out` | `win` / `won` |
| `paid out` | `win` |
| `stake` | `play amount` |
| `pays out` | `won` |
| `betting` | `play` / `playing` |
| `total bet` | `total play` |
| `bet` / `bets` | `play` / `plays` |
| `cash` | `coins` |
| `payer` | `winner` |
| `pay` / `pays` / `paid` | `win` / `wins` / `won` |
| `money` | `coins` |
| `buy` | `play` |
| `bought` | `instantly triggered` |
| `purchase` | `play` |
| `at the cost of` | `for` |
| `rebet` | `respin` |
| `cost of` | `can be played for` |
| `credit` | `balance` |
| `buy bonus` | `get bonus` |
| `gamble` / `wager` | `play` |
| `deposit` | `get coins` |
| `withdraw` | `redeem` |
| `bonus buy` | `bonus / feature` |
| `be awarded to player's accounts` | `appear in player's accounts` |
| `place your bets` | `come and play` / `join in the game` |
| `currency` | `token` |
| `fund` | `balance` |

Das Projekt kann freiwillig eine strengere globale Wortregel für alle Modi verwenden. Diese strengere lokale Policy darf jedoch nicht als wörtliche Aussage der öffentlichen Jurisdiction-Dokumentation ausgegeben werden.

## Kritische fachliche Verträge

### Replay

Nach [Bet Replay][replay] sind `replay=true`, `game`, `version`, `mode`, `event` und `rgs_url` Pflichtparameter; `currency`, `amount`, `lang`, `device` und `social` sind optional. Replay benötigt keine Playersession und darf keine authentifizierten Session- oder Wallet-Anfragen auslösen. Es muss laden, einen Start-Button zeigen, die vollständige Runde darstellen, normale Play-Steuerungen sperren, das Ergebnis sichtbar halten, Fehler behandeln und nach Abschluss Play Again anbieten.

Für jeden ausgelieferten Modus sollen mindestens Normal Win, Big Win, Max Win, Zero Win und – soweit anwendbar – Bonus Trigger mit echten Event-IDs geprüft werden.

### Play Amount, Multiplikator und Total Win

Die Replay-Antwort beschreibt `payoutMultiplier` als Multiplikator zur Berechnung des Gesamtgewinns und `costMultiplier` als Multiplikator zur Berechnung der Play-Kosten. [RGS Details][rgs] definiert die Belastung als Base Amount multipliziert mit dem Moduskostenmultiplikator. Daraus folgen zwei getrennte Verträge:

```text
final play amount = base amount × costMultiplier
total win         = base amount × payoutMultiplier
```

Beispiel: Bei Base Amount `10.00`, `costMultiplier = 1` und `payoutMultiplier = 2.7` müssen Final Play Amount `10.00` und Total Win `27.00` betragen. Ein angezeigter Total Win von `2.76` wäre nur mit einem Final Multiplier von `0.276` konsistent. Widersprüchliche Beträge müssen blockieren; sie dürfen nicht gerundet oder durch UI-Fallbacks passend gemacht werden.

### Balance und Win-Anzeige

[Frontend and Communication][frontend] verlangt einen sichtbaren aktuellen Balancewert, einen klar sichtbaren nicht-null Endgewinn und bei mehreren Gewinnaktionen ein inkrementelles Auflaufen bis zum finalen `payoutMultiplier`. [RGS Details][rgs] verlangt bei kleinen Einsätzen eine exakte Win-Anzeige mit drei oder vier Dezimalstellen, während der Balancewert nicht mehr als zwei Dezimalstellen benötigt. Wallet- und Math-/RGS-Daten sind autoritativ; Animationssummen dürfen keinen unabhängigen Balancewert erfinden.

### Mobile und Free-Spins-Zähler

[Frontend and Communication][frontend] verlangt eine unverzerrte, vollständig benutzbare Darstellung auf gebräuchlichen Mobile- und Popout-Viewports. [Game Event Structures][math-events] nennt Free-Spin-Zähler ausdrücklich als aus Math-Events an das Frontend kommunizierte Daten. Der Zähler muss deshalb den autoritativen Eventstand zeigen und darf weder Reel-Fläche noch notwendige Controls überdecken. Browser-Geometrietests sind sinnvoll, ersetzen aber nicht die manuelle Prüfung auf den in Gate 49 benannten älteren Geräten.

## Fehlende externe Beweise

Die Gates 45 bis 51 können weder aus einem lokalen Build noch aus einem grünen CI-Lauf abgeleitet werden. Ohne versionsgebundene externe Belege bleiben sie unentschieden. Insbesondere sind folgende Aussagen durch dieses Dokument nicht belegt:

- dass Bet-Level-Templates im Stake-System angewendet wurden;
- dass Provably Fair oder Replay extern aktiviert wurden;
- dass Frontend oder Math genehmigt wurden;
- dass eine Freigabemeldung gepostet wurde;
- dass ältere reale Geräte erfolgreich geprüft wurden;
- dass die Approval-Anfrage nach Go-live geschlossen wurde;
- dass das Spiel live veröffentlicht wurde.

[approval-guidelines]: https://stake-engine.com/docs/approval-guidelines
[frontend]: https://stake-engine.com/docs/approval-guidelines/front-end-communication
[jurisdiction]: https://stake-engine.com/docs/approval-guidelines/jurisdiction-requirements
[replay]: https://stake-engine.com/docs/approval-guidelines/game-replay-requirements
[rgs]: https://stake-engine.com/docs/rgs
[wallet]: https://stake-engine.com/docs/rgs/wallet
[rgs-communication]: https://stake-engine.com/docs/approval-guidelines/rgs-communication
[disclaimer]: https://stake-engine.com/docs/approval-guidelines/general-disclaimer
[game-tile]: https://stake-engine.com/docs/approval-guidelines/game-tile-requirements
[math-events]: https://stake-engine.com/docs/math/game-state-structure/events
[submission-checklist]: https://stake-engine.com/docs/approval-guidelines/submission-checklist
