# Handmatige check: de agenda (VS4-01: AGD-01, 02, 08; VS4-02: AGD-03, 04, 06, 09; VS4-03: AGD-05, 07, 09, DLV-09;
VS4-04: AGD-10..13, DLV-14)

Door de owner, op het eigen Google-account waar het script onder draait (DECISIONS 2026-11-18). Schrijf de run in
`tests/manual/runs/<datum>-VS4-01.md` met de afgevinkte lijst en `## Open points`. Zet geen titels, namen of
omschrijvingen uit de agenda in die run of ergens anders in de repo (INT-04): schrijf alleen "klopt" of "klopt niet",
en aantallen.

Stap 1–6 (VS4-01) lezen de komende week in het tabblad `Agenda`. Stap 7–12 (VS4-02) maken van elke nieuwe activiteit
één eerste slide voor het visuele team. VS4-03 zet daarna elke datum van een goedgekeurde activiteit in de loop.
Schrijf de run van VS4-02 in `tests/manual/runs/<datum>-VS4-02.md`.
Stap 13–18 (VS4-03) zetten elke datum van een activiteit op `tonen` in de loop; schrijf die run in
`tests/manual/runs/<datum>-VS4-03.md`.
Stap 19–25 (VS4-04) zetten de eigen foto van een activiteit naast de tekst; schrijf die run in
`tests/manual/runs/<datum>-VS4-04.md`.

## 1. De agenda-ID
De agenda-ID is het deel na `src=` in de embed-link van de gemeente-agenda, met `%40` vervangen door `@` (de owner
heeft hem; hij staat in de chat van 2026-11-20). Zet hem **niet** in de repo, een issue of een PR: alleen in de
script property hieronder. Abonneren hoeft niet: het script abonneert je account er zelf op bij de eerste run (AGD-01).

## 2. De ID in het script zetten
1. Open de terminal in je checkout: `git checkout main && git pull`.
2. Ga naar `subprojects/google` en draai `npx @google/clasp open-script`: de editor opent in de browser.
3. Links het tandwiel *Projectinstellingen* → scroll naar *Scripteigenschappen* → *Scripteigenschap toevoegen*.
4. Eigenschap: `AGENDA_CALENDAR_ID`, waarde: de agenda-ID uit stap 1 (zonder spaties). *Scripteigenschappen opslaan*.

## 3. Pushen en toestemming geven
1. In `subprojects/google`: `npx @google/clasp push` (antwoord *yes* als hij vraagt het manifest te overschrijven).
2. Ververs de editor. Links bij *Bestanden* staat nu ook `agenda.gs`.
3. Kies bovenaan `main.gs`, kies in de functielijst `composeLoop` en klik **Uitvoeren**.
4. Google vraagt om nieuwe toestemming, nu ook voor je agenda's (bekijken en abonneren): *Toestemming controleren* → kies je account
   → *Geavanceerd* → *Ga naar KerkSlideGen (onveilig)* → *Toestaan*. Zonder deze stap faalt de nachtrun.
5. Klik zo nodig nog een keer **Uitvoeren**. Het uitvoeringslogboek onderaan eindigt op *Uitvoering voltooid*.

## 4. Controleren
- [ ] **AGD-02** Open de Sheet *KerkSlideGen aanvragen*: er is een tabblad `Agenda` met de kolommen `serie`, `titel`,
      `omschrijving`, `begin`, `einde`, `plaats`, `vervallen`.
- [ ] **AGD-02** De rijen zijn precies de activiteiten in de agenda van vandaag tot en met 7 dagen later (vergelijk met
      calendar.google.com, weekweergave; links onder *Andere agenda's* staat de gemeente-agenda nu): niets van gisteren, niets van dag 8. `begin` en `einde` staan in UTC (`Z`):
      19.30 uur in de winter is `18:30Z`.
- [ ] **AGD-01** Een wekelijkse activiteit die als reeks in de agenda staat: zijn rijen hebben dezelfde `serie`.
- [ ] **AGD-01** Een titel die met `=` begint, of een omschrijving die op een datum lijkt, staat er als gewone tekst.
- [ ] **INT-04** Editor → links *Uitvoeringen* → de run van zojuist → geen agenda-ID, titel, omschrijving of plaats uit de agenda
      in het logboek.

## 5. Een mislukte lezing (AGD-08)
1. Zet in *Scripteigenschappen* de waarde van `AGENDA_CALENDAR_ID` tijdelijk op `fout` (onthoud de echte ID).
2. Voer `composeLoop` uit.
- [ ] **AGD-08** Je krijgt een mail "Agenda niet gelezen: …" met de reden en de dag van de laatste goede lezing.
- [ ] **AGD-08** Het tabblad `Agenda` is ongewijzigd: de rijen van stap 5 staan er nog.
- [ ] **DLV-09** De loop is wel samengesteld: in het logboek *Uitvoering voltooid*, `Loop/` is bijgewerkt.
3. Voer `composeLoop` nog een keer uit.
- [ ] **AGD-08** Geen tweede mail vandaag.
4. Zet `AGENDA_CALENDAR_ID` terug op de echte ID en voer `composeLoop` uit.
- [ ] **AGD-08** Het tabblad `Agenda` is weer bijgewerkt; er komt geen foutmail.

## 6. De nachtrun (AGD-02)
- [ ] **AGD-02** De volgende ochtend: editor → *Uitvoeringen* → de run van `composeLoop` tussen 03:00 en 04:00 is
      groen (*Voltooid*), en in het tabblad `Agenda` loopt de week nu vanaf vandaag.

## 7. VS4-02 pushen (na de merge)
1. Open de Terminal en ga naar je eigen checkout (niet een worktree):
   `cd ~/Documents/Projects/KerkSlideGen && git checkout main && git pull`.
2. `cd subprojects/google && npx @google/clasp push`. Antwoord *yes* als hij vraagt het manifest te overschrijven.
   Hij noemt 5 bestanden: `appsscript.json`, `agenda.js`, `deliver.js`, `intake.js`, `main.js`.
3. `npx @google/clasp open-script`: de editor opent in de browser. Ververs hem als hij al open stond.

## 8. Een nieuwe versie van de web app
De knoppen in de mail (*Goedkeuren*, *Aanpassen*, *Niet tonen*) en de callback van de render gaan naar de web app; die
draait de code van de laatste **versie**, niet die van de push.
1. In de editor rechtsboven **Implementeren** → **Implementaties beheren**.
2. Kies links de bestaande web-app-implementatie en klik het **potlood** (*Bewerken*).
3. Bij *Versie*: kies **Nieuwe versie**. Laat *Uitvoeren als* (jij) en *Wie heeft toegang* (iedereen) zoals ze staan.
4. Klik **Implementeren** en daarna **Gereed**. De URL blijft dezelfde: `WEB_APP_URL` en het GitHub-secret
   `CALLBACK_URL` hoeven niet te veranderen.

## 9. De activiteiten aanmaken (AGD-03, 04)
1. Maak in Drive in de map `KerkSlideGen/Vast` een map `Agenda` (nog leeg laten).
2. Kies in de editor bovenaan `main.gs`, in de functielijst `composeLoop`, en klik **Uitvoeren**. Vraagt Google om
   toestemming: *Toestemming controleren* → je account → *Geavanceerd* → *Ga naar KerkSlideGen (onveilig)* → *Toestaan*.
3. Wacht een paar minuten. Elke nieuwe activiteit van deze week gaat één keer naar GitHub: je krijgt **één mail per
   activiteit**. Kijk op github.com/Aottens/KerkSlideGen → *Actions* → *Render*: één run per activiteit, groen.
- [ ] **AGD-03** De Sheet heeft een tabblad `Activiteiten` met de kolommen `id`, `titel`, `status`, `slide`, `ronde`,
      `token`, `png`, `aanpassing`, `sinds`, `reden`.
- [ ] **AGD-03** Eén rij per activiteit: een activiteit die deze week twee keer in de agenda staat (ook als losse
      afspraken) heeft één rij. Geen rij voor een titel die met "Samenkomst" begint.
- [ ] **AGD-04** Elke rij staat op `te keuren` (of nog even op `nieuw` met `sinds` ingevuld, zolang de render loopt).
- [ ] **AGD-04** De mail "Nieuwe activiteit uit de agenda: …" komt naar jouw adres, met de slide, en drie knoppen:
      *Goedkeuren*, *Aanpassen*, *Niet tonen*.
- [ ] **AGD-04** Op de slide komen dag, datum, tijd en plaats uit de agenda (zoals "woensdag 25 november, 19.30 uur"),
      niet uit de omschrijving; titel en zin komen uit de titel en omschrijving.
- [ ] **INT-07** In de run op GitHub (*Actions* → *Render* → de run → *job*) staat alleen `<id> round 1: ok`: geen
      titel, omschrijving of plaats.
4. Voer `composeLoop` nog een keer uit.
- [ ] **AGD-04** Geen nieuwe mails en geen nieuwe runs op GitHub: een activiteit gaat maar één keer weg.

## 10. De drie knoppen (AGD-04, 06)
Kies drie activiteiten uit de mails van stap 9.
1. Activiteit 1: klik **Aanpassen**, schrijf iets kleins ("maak de zin korter") en klik *Versturen*.
- [ ] **AGD-04** Binnen een paar minuten een nieuwe mail van dezelfde activiteit; in de Sheet `ronde` 2.
2. Klik in die nieuwe mail **Goedkeuren**.
- [ ] **AGD-04** De pagina zegt dat de slide is goedgekeurd. In de Sheet: `status` `tonen`, in `slide` de titel en
      de zin. De PNG staat in `Bibliotheek/`.
- [ ] **AGD-04** Klik nog een keer op *Goedkeuren* in dezelfde mail: de pagina zegt dat de link niet (meer) klopt.
3. Activiteit 2: klik **Niet tonen**.
- [ ] **AGD-06** De pagina zegt dat de activiteit niet in de loop komt. In de Sheet: `status` `niet tonen`.
4. Zet in de Sheet de `status` van activiteit 2 terug op `nieuw` (typ het woord), maak `sinds` leeg als daar iets
   staat, en voer `composeLoop` uit. Met een ingevulde `sinds` wacht het script 20 uur.
- [ ] **AGD-06** Er komt opnieuw een mail van activiteit 2. Klik daarin **Goedkeuren** of **Niet tonen**, wat je wilt.
5. Activiteit 3: kies zelf. Laat geen activiteit op `te keuren` staan als je klaar bent.

## 11. Een eigen PNG in `Vast/Agenda/` (AGD-09)
1. Kies een activiteit die nog op `nieuw` staat of zet er één op `nieuw`. Zet in `KerkSlideGen/Vast/Agenda/` een PNG
   (1920×1080 of het drievoudige formaat, zoals de andere slides) met als naam precies de titel van die activiteit,
   gevolgd door `.png` (hoofdletters maken niet uit).
2. Voer `composeLoop` uit.
- [ ] **AGD-09** Geen mail en geen run op GitHub voor die activiteit; de rij blijft `nieuw`.
- [ ] **AGD-09** De PNG staat één keer in `Loop/` (er is deze week minstens één datum van die activiteit).
3. Zet de `status` van die activiteit op `niet tonen` en voer `composeLoop` uit.
- [ ] **AGD-09** De PNG is weg uit `Loop/`. Zet de status daarna terug zoals je hem wilt.

## 12. De logboeken (INT-04)
- [ ] **INT-04** Editor → links *Uitvoeringen* → de runs van vandaag: geen titel, omschrijving of plaats uit de
      agenda in het logboek.

## 13. VS4-03 pushen (na de merge)
1. Open de Terminal en ga naar je eigen checkout (niet een worktree):
   `cd ~/Documents/Projects/KerkSlideGen && git checkout main && git pull`.
2. `cd subprojects/google && npx @google/clasp push`. Antwoord *yes* als hij vraagt het manifest te overschrijven.
   Hij noemt 5 bestanden: `appsscript.json`, `agenda.js`, `deliver.js`, `intake.js`, `main.js`.
3. `npx @google/clasp open-script`: de editor opent in de browser. Ververs hem als hij al open stond.

## 14. Een nieuwe versie van de web app
De render stuurt elke datum-slide terug naar de web app; die draait de code van de laatste **versie**.
1. In de editor rechtsboven **Implementeren** → **Implementaties beheren**.
2. Kies links de bestaande web-app-implementatie en klik het **potlood** (*Bewerken*).
3. Bij *Versie*: kies **Nieuwe versie**. Laat *Uitvoeren als* (jij) en *Wie heeft toegang* (iedereen) zoals ze staan.
4. Klik **Implementeren** en daarna **Gereed**. De URL blijft dezelfde.

## 15. Eén nachtrun met datum-slides (AGD-05, DLV-09)
Zorg dat minstens één activiteit op `tonen` staat zonder eigen PNG in `Vast/Agenda/`, met deze week een datum.
1. Kies in de editor bovenaan `main.gs`, in de functielijst `composeLoop`, en klik **Uitvoeren**. Wacht tot het
   logboek *Uitvoering voltooid* zegt.
2. Wacht vijf minuten. Kijk op github.com/Aottens/KerkSlideGen → *Actions* → *Render*: één run per datum, groen.
- [ ] **AGD-05** De Sheet heeft een tabblad `Datums` met de kolommen `id`, `sleutel`, `png`, `sinds`, `reden`, en één
      rij per datum van elke activiteit op `tonen`; het `id` is het activiteit-id met de datum erachter.
- [ ] **AGD-05** Geen mail: een datum van een goedgekeurde activiteit hoeft niet nog eens goedgekeurd te worden.
- [ ] **AGD-05** Elke rij heeft binnen vijf minuten een `png`; `sinds` en `reden` zijn leeg.
- [ ] **DLV-09** Binnen twee minuten daarna staat in `Loop/` per datum een PNG `<id>.png`. Open er één: titel en zin
      zijn die van de goedgekeurde slide, dag, datum, tijd en plaats die van die datum in de agenda.
- [ ] **INT-07** In de run op GitHub (*Actions* → *Render* → de run → *job*) staat alleen `<id> round 1: ok`.
3. Voer `composeLoop` nog een keer uit.
- [ ] **AGD-05** Geen nieuwe runs op GitHub en geen nieuwe rijen: een datum die al klaar is gaat niet nog eens weg.

## 16. Een verschoven tijd (AGD-07)
1. Open de gemeente-agenda in Google Agenda en verschuif bij één datum van zo'n activiteit de begintijd een half uur
   (alleen die ene datum: kies *Alleen deze afspraak* als hij het vraagt). Pas ook de omschrijving van een andere
   datum aan.
2. Voer `composeLoop` uit en wacht vijf minuten.
- [ ] **AGD-07** Precies één nieuwe run op GitHub: die van de verschoven datum. In `Loop/` toont zijn PNG de nieuwe
      tijd; de oude PNG van die datum is weg.
- [ ] **AGD-07** De datum met de andere omschrijving kreeg geen nieuwe run.
3. Zet de tijd daarna terug als het geen echte wijziging was, en voer `composeLoop` nog een keer uit.

## 17. Een geschrapte datum (AGD-07, DLV-09)
1. Verwijder in de gemeente-agenda één datum van zo'n activiteit (*Alleen deze afspraak*), of schrap hem.
2. Voer `composeLoop` uit.
- [ ] **AGD-07** De PNG van die datum is weg uit `Loop/`; de andere datums van die activiteit staan er nog.
3. Zet de datum terug als het geen echte wijziging was en voer `composeLoop` uit: hij komt weer in `Loop/`.
4. Zet de activiteit in de tab `Activiteiten` op `niet tonen` en voer `composeLoop` uit.
- [ ] **DLV-09** Alle datum-PNG's van die activiteit zijn weg uit `Loop/`. Zet de status daarna terug op `tonen`.

## 18. De volgende ochtend (AGD-05, DLV-09)
- [ ] **DLV-09** Editor → *Uitvoeringen*: de `composeLoop` van 03:00 en de `retryDispatches` daarna zijn groen.
- [ ] **AGD-07** In `Datums` staat geen rij meer van een datum vóór vandaag, en in `Loop/` geen PNG van gisteren.
- [ ] **INT-04** De logboeken van vandaag tonen geen titel, omschrijving of plaats uit de agenda.

## 19. VS4-04 pushen (na de merge)
1. Open de Terminal en ga naar je eigen checkout (niet een worktree):
   `cd ~/Documents/Projects/KerkSlideGen && git checkout main && git pull`.
2. `cd subprojects/google && npx @google/clasp push`. Antwoord *yes* als hij vraagt het manifest te overschrijven.
   Hij noemt 5 bestanden: `appsscript.json`, `agenda.js`, `deliver.js`, `intake.js`, `main.js`.
3. `npx @google/clasp open-script`: de editor opent in de browser. Ververs hem als hij al open stond.

## 20. Een nieuwe versie van de web app
De render-job haalt de foto op bij de web app; die draait de code van de laatste **versie**.
1. In de editor rechtsboven **Implementeren** → **Implementaties beheren**.
2. Kies links de bestaande web-app-implementatie en klik het **potlood** (*Bewerken*).
3. Bij *Versie*: kies **Nieuwe versie**. Laat *Uitvoeren als* (jij) en *Wie heeft toegang* (iedereen) zoals ze staan.
4. Klik **Implementeren** en daarna **Gereed**. De URL blijft dezelfde.
5. Voer `composeLoop` één keer uit (functielijst → `composeLoop` → **Uitvoeren**).
- [ ] **AGD-13** Geen nieuwe runs op GitHub: een activiteit zonder foto houdt haar datum-slides na de update.

## 21. De map `Foto's` (AGD-10)
1. Open Drive en ga naar `KerkSlideGen` → `Vast` → `Agenda`.
2. Klik links boven **+ Nieuw** → **Nieuwe map**, typ `Foto's` (met de apostrof, hoofdletter F) en klik **Maken**.
3. Kies een activiteit die deze week een datum heeft en op `tonen` staat, zonder eigen PNG in `Vast/Agenda/`.
   Zoek een liggende foto (JPG, PNG, WebP of HEIC, kleiner dan 10 MB) en geef hem op je computer precies de titel
   van die activiteit als naam, bijvoorbeeld `<titel>.jpg` (hoofdletters maken niet uit).
4. Open de map `Foto's` en sleep de foto erin. Wacht tot Drive *Upload voltooid* zegt.

## 22. De eerste slide met foto (AGD-11, DLV-14)
1. Open de Sheet, tabblad `Activiteiten`, de rij van die activiteit. Typ in `status` het woord `nieuw` en maak
   `sinds` en `reden` leeg.
2. Voer `composeLoop` uit en wacht vijf minuten.
- [ ] **AGD-11** Je krijgt één goedkeuringsmail voor die activiteit. De slide toont de foto aan één kant (links of
      rechts) en de tekst aan de andere kant, beide binnen het middenvlak.
- [ ] **INT-07** In de run op GitHub (*Actions* → *Render* → de run → *job*) staat alleen `<id> round 1: ok`; geen
      bestandsnaam, geen link, geen foto, en de run heeft geen *Artifacts*.
3. Klik in de mail **Goedkeuren**.

## 23. Een nacht met datums (AGD-12)
1. Voer `composeLoop` uit en wacht vijf minuten.
- [ ] **AGD-12** Op GitHub één run per datum van die activiteit, groen; geen nieuwe goedkeuringsmail.
- [ ] **AGD-12** In `Loop/` staat per datum een PNG `<id>.png` met de foto, aan **dezelfde kant** als op de eerste
      slide, met de dag, tijd en plaats van die datum.
- [ ] **AGD-12** Een activiteit zonder foto heeft nog steeds alleen tekst.

## 24. Een vervangen foto (AGD-13)
1. Zoek een andere foto en geef hem dezelfde naam als de eerste. Verwijder in `Foto's` de oude foto (rechtermuisknop
   → **Verwijderen**) en sleep de nieuwe erin.
2. Voer `composeLoop` uit en wacht vijf minuten.
- [ ] **AGD-13** Op GitHub weer één run per datum van die activiteit; geen mail, ook niet aan het team.
- [ ] **AGD-13** In `Loop/` tonen de datum-PNG's de nieuwe foto, aan dezelfde kant. In `Activiteiten` zijn `status`
      (`tonen`) en `slide` niet veranderd.
3. Verwijder de foto uit `Foto's` en voer `composeLoop` uit; wacht vijf minuten.
- [ ] **AGD-13** De datums zijn opnieuw gemaakt, nu alleen met tekst. Zet daarna de foto terug als je hem wilt houden
      en voer `composeLoop` nog een keer uit.

## 25. Een eigen PNG wint (AGD-10, AGD-09)
1. Zet een PNG met dezelfde titel direct in `Vast/Agenda/` (niet in `Foto's`) en voer `composeLoop` uit.
- [ ] **AGD-10** Geen nieuwe runs op GitHub; in `Loop/` staat de eigen PNG één keer, de datum-PNG's zijn weg.
2. Haal de eigen PNG weer weg als het een test was en voer `composeLoop` uit.
- [ ] **INT-04** Editor → *Uitvoeringen*: de logboeken van vandaag tonen geen titel, bestandsnaam of plaats.

## 26. De hele foto (REN-12, na de merge van VS1-10)
Alleen de renderer is veranderd: `clasp push` en een nieuwe versie van de web app zijn niet nodig.
1. Zoek een vierkante foto of illustratie, liefst een PNG met een doorzichtige achtergrond, en geef hem de titel van
   de activiteit uit stap 21 als naam. Verwijder in `Foto's` de oude foto en sleep de nieuwe erin.
2. Voer `composeLoop` uit en wacht vijf minuten.
- [ ] **REN-12** In `Loop/` tonen de datum-PNG's de **hele** foto: niets van de zijkanten of boven en onder is
      afgesneden, en hij is niet uitgerekt.
- [ ] **REN-12** De foto staat tegen de kant van de tekst aan en in het midden van de hoogte; waar hij het vlak niet
      vult, zie je de achtergrond.
- [ ] **REN-12** Doorzichtige delen van de PNG tonen de achtergrond, geen zwart of wit vlak.
