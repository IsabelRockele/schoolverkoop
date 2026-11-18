# Excel-export verwerken

Open `excel.html` op dezelfde website als de bestaande schoolpagina. Er staat ook een link op `school.html`. De tabbladen **Bestand**, **Leveranciers**, **Winst**, **Klassen + AKB** en **Prijzen per jaar** tonen telkens één onderdeel. Bestellingen blijven in het geheugen van de browser en verdwijnen bij sluiten, herladen of **Bestellingen wissen**. Alleen prijzen en kosten worden bewaard, nooit de Excelbestellingen. Kies bij iedere nieuwe export het volledige bestand; dit vervangt de vorige import en behoudt de gekozen jaarprijzen.

1. Selecteer de oorspronkelijke WPForms `.xlsx`-export en het juiste werkblad.
2. Controleer de koppeling en bestellingen. Kolomnamen bepalen de koppeling, niet hun positie: **Waarde is de stukprijs**, **Hoeveelheid is het aantal**. Het bedrag in **Totaal** moet exact overeenkomen met de som van prijs × aantal en de gift. Fouten blokkeren alle rapporten. Mogelijke dubbele rijen worden gemeld en blijven meetellen tot de bron is gecorrigeerd.
3. Vink de controle aan; het tabblad Leveranciers opent. De inkoopprijzen worden automatisch uit de bestaande winstberekening opgehaald voor het gekozen verkoopjaar. Onder **Prijzen per jaar** kun je prijzen per stuk / klein truffeldoosje aanpassen. De bestaande verpakking is 12 stuks voor 250 g en 8 voor 500 g, apart afgerond per smaak. Pas deze aantallen aan indien de leverancier andere verpakkingen gebruikt.
4. Download per leverancier een PDF. Ontbrekende inkoopprijzen staan expliciet vermeld; de bestelaantallen blijven bruikbaar.
5. Vul onder **Winst** de werkelijke betaal-/overige kosten en transportkosten in, ook bij nul. De winst-PDF is pas beschikbaar wanneer alle benodigde kosten zijn ingevuld. De berekening trekt de volledige inkoop inclusief overschot af. Bewaar via **Prijzen per jaar → Prijzen en kosten bewaren**.
6. Kies een klas of AKB en download de uitdeellijst, of download alle groepen in één PDF. AKB en Atheneum Klein-Brabant worden samengebracht. Andere klasnamen uit de export blijven behouden. Elke bestelling blijft een afzonderlijke regel met leerling en koper.

Het exportbestand bevat geen betaalstatus: omzet is het bedrag van alle bestellingen, niet een bevestiging van ontvangen betalingen. Het resultaat blijft voorlopig zolang de export voorlopig is. Bij gewijzigde productkolommen wordt de import geblokkeerd zodat onbekende producten niet stilzwijgend wegvallen. Formules worden niet uitgevoerd: gebruik de oorspronkelijke export met vaste waarden.

## Controle

`node --test excel-import.test.mjs excel-prices.test.mjs`

## Jaarprijzen en bestaande instellingen

De gedeelde bron is hetzelfde Firestore-document als de bestaande toepassing: `instellingen/kerstverkoop_<jaar>`, met `inkoopprijzen` in euro per stuk. De lokale reservekopie `winst_kerstverkoop_<jaar>_inkoopprijzen` wordt ook hergebruikt. Nieuwe velden `excelVerpakking` en `excelKosten` bewaren de doosinhoud en totale kosten. De oude Mollie-kost per bestelling wordt niet als totale kost overgenomen. Bestaande transportkosten kunnen als vertrekpunt worden geladen.

Aanmelden met het bestaande schoolaccount is nodig om de gedeelde prijzen te lezen en te bewaren. Zonder aanmelding of verbinding worden beschikbare lokale jaarprijzen gebruikt. De status vermeldt of bewaren gedeeld of alleen op deze computer is gelukt. Nog niet gesynchroniseerde lokale wijzigingen worden niet automatisch overschreven bij het laden. Meld je aan en bewaar opnieuw om ze te delen.

Een ander jaar laden wijzigt de actieve prijsset, niet de geïmporteerde bestellingen. Controleer daarom het verkoopjaar bovenaan. Bewaar gewijzigde prijzen eerst voordat je een ander jaar laadt. Er worden geen prijzen van het vorige jaar automatisch verondersteld voor een nieuw jaar. Een nieuwe export of het wissen van bestellingen verwijdert de bewaarde prijzen niet.

De browsertest gebruikt een geïsoleerde vervanger voor de gedeelde opslag en wijzigt geen echte prijzen.

Browserbibliotheken staan lokaal in `vendor/`. Voor lokale weergave kan een gewone statische HTTP-server gebruikt worden; `excel.js` is een ES-module.
