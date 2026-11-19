# Handmatige check: de agenda lezen (VS4-01; AGD-01, 02, 08)

Door de owner, op het eigen Google-account waar het script onder draait (DECISIONS 2026-11-18). Schrijf de run in
`tests/manual/runs/<datum>-VS4-01.md` met de afgevinkte lijst en `## Open points`. Zet geen titels, namen of
omschrijvingen uit de agenda in die run of ergens anders in de repo (INT-04): schrijf alleen "klopt" of "klopt niet",
en aantallen.

Deze build maakt nog geen slides van de agenda: hij leest de komende week en zet die in het tabblad `Agenda` van de
Sheet. VS4-02 en VS4-03 maken er slides van.

## 1. De agenda-ID opzoeken
1. Vraag de beheerder van de gemeente-agenda om de **agenda-ID**. Die vindt de beheerder zo: open
   [calendar.google.com](https://calendar.google.com) → links onder *Mijn agenda's* bij de gemeente-agenda op de drie
   puntjes → *Instellingen en delen* → scroll naar *Agenda integreren* → *Agenda-ID*. Hij eindigt meestal op
   `@group.calendar.google.com`.
2. Of zoek hem zelf: staat de agenda op de website van de kerk ingesloten, klik met rechts op de agenda →
   *Paginabron weergeven* en zoek `src=`: wat daarna komt tot de eerstvolgende `&` is de ID (met `%40` in plaats
   van `@`).
3. Zet de ID **niet** in de repo, een issue of een chat met Claude: alleen in de agenda en in de script property
   hieronder.

## 2. Je account abonneren op de agenda (AGD-01)
1. Open [calendar.google.com](https://calendar.google.com) met het account waar het script onder draait.
2. Links, naast *Andere agenda's*, klik op **+** → *Abonneren op agenda*.
3. Plak de agenda-ID in het veld *Agenda toevoegen* en druk op Enter. Gebruik **niet** *Van URL*: dat maakt een kopie
   met een andere ID.
4. De gemeente-agenda staat nu links onder *Andere agenda's*, en je ziet de activiteiten van deze week.

## 3. De ID in het script zetten
1. Open de terminal in je checkout: `git checkout main && git pull`.
2. Ga naar `subprojects/google` en draai `npx @google/clasp open-script`: de editor opent in de browser.
3. Links het tandwiel *Projectinstellingen* → scroll naar *Scripteigenschappen* → *Scripteigenschap toevoegen*.
4. Eigenschap: `AGENDA_CALENDAR_ID`, waarde: de agenda-ID uit stap 1. *Scripteigenschappen opslaan*.

## 4. Pushen en toestemming geven
1. In `subprojects/google`: `npx @google/clasp push` (antwoord *yes* als hij vraagt het manifest te overschrijven).
2. Ververs de editor. Links bij *Bestanden* staat nu ook `agenda.gs`.
3. Kies bovenaan `main.gs`, kies in de functielijst `composeLoop` en klik **Uitvoeren**.
4. Google vraagt om nieuwe toestemming, nu ook voor *Agenda's bekijken*: *Toestemming controleren* → kies je account
   → *Geavanceerd* → *Ga naar KerkSlideGen (onveilig)* → *Toestaan*. Zonder deze stap faalt de nachtrun.
5. Klik zo nodig nog een keer **Uitvoeren**. Het uitvoeringslogboek onderaan eindigt op *Uitvoering voltooid*.

## 5. Controleren
- [ ] **AGD-02** Open de Sheet *KerkSlideGen aanvragen*: er is een tabblad `Agenda` met de kolommen `serie`, `titel`,
      `omschrijving`, `begin`, `einde`, `plaats`, `vervallen`.
- [ ] **AGD-02** De rijen zijn precies de activiteiten in de agenda van vandaag tot en met 7 dagen later (vergelijk met
      calendar.google.com, weekweergave): niets van gisteren, niets van dag 8. `begin` en `einde` staan in UTC (`Z`):
      19.30 uur in de winter is `18:30Z`.
- [ ] **AGD-01** Een wekelijkse activiteit die als reeks in de agenda staat: zijn rijen hebben dezelfde `serie`.
- [ ] **AGD-01** Een titel die met `=` begint, of een omschrijving die op een datum lijkt, staat er als gewone tekst.
- [ ] **INT-04** Editor → links *Uitvoeringen* → de run van zojuist → geen titel, omschrijving of plaats uit de agenda
      in het logboek.

## 6. Een mislukte lezing (AGD-08)
1. Zet in *Scripteigenschappen* de waarde van `AGENDA_CALENDAR_ID` tijdelijk op `fout` (onthoud de echte ID).
2. Voer `composeLoop` uit.
- [ ] **AGD-08** Je krijgt een mail "Agenda niet gelezen: …" met de reden en de dag van de laatste goede lezing.
- [ ] **AGD-08** Het tabblad `Agenda` is ongewijzigd: de rijen van stap 5 staan er nog.
- [ ] **DLV-09** De loop is wel samengesteld: in het logboek *Uitvoering voltooid*, `Loop/` is bijgewerkt.
3. Voer `composeLoop` nog een keer uit.
- [ ] **AGD-08** Geen tweede mail vandaag.
4. Zet `AGENDA_CALENDAR_ID` terug op de echte ID en voer `composeLoop` uit.
- [ ] **AGD-08** Het tabblad `Agenda` is weer bijgewerkt; er komt geen foutmail.

## 7. De nachtrun (AGD-02)
- [ ] **AGD-02** De volgende ochtend: editor → *Uitvoeringen* → de run van `composeLoop` tussen 03:00 en 04:00 is
      groen (*Voltooid*), en in het tabblad `Agenda` loopt de week nu vanaf vandaag.
