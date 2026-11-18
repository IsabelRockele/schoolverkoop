# Excel-export verwerken

Open `excel.html` op dezelfde website als de bestaande schoolpagina. Er staat ook een link op `school.html`. De tabbladen **Bestand**, **Leveranciers**, **Winst**, **Klassen + AKB** en **Prijzen per jaar** tonen telkens één onderdeel. Na bevestiging van de import wordt de oorspronkelijke Excel gedeeld bewaard voor aangemelde medewerkers. Bij opnieuw openen wordt de laatst bewaarde Excel opgehaald, opnieuw gevalideerd en doorgerekend. **Overzicht sluiten** verwijdert alleen het geopende overzicht; **Laatste Excel openen** haalt de gedeelde versie terug. Zonder aanmelding kun je lokaal verwerken, maar wordt de upload niet gedeeld bewaard. Kies bij iedere nieuwe export het volledige bestand; dit vervangt de vorige import en behoudt de gekozen jaarprijzen.

1. Selecteer de oorspronkelijke WPForms `.xlsx`-export en het juiste werkblad.
2. Controleer de koppeling en bestellingen. Kolomnamen bepalen de koppeling, niet hun positie: **Waarde is de stukprijs**, **Hoeveelheid is het aantal**. Het bedrag in **Totaal** moet exact overeenkomen met de som van prijs × aantal en de gift. Fouten blokkeren alle rapporten. Mogelijke dubbele rijen worden gemeld en blijven meetellen tot de bron is gecorrigeerd.
3. Vink de controle aan; het tabblad Leveranciers opent en de geldige Excel wordt gedeeld bewaard. Wacht op de melding Gedeeld bewaard voordat je de pagina sluit. Een ongeldige of niet bevestigde upload vervangt de vorige bewaarde versie niet. De inkoopprijzen worden automatisch uit de bestaande winstberekening opgehaald voor het gekozen verkoopjaar. Onder **Prijzen per jaar** kun je prijzen per stuk / klein truffeldoosje aanpassen. De bestaande verpakking is 12 stuks voor 250 g en 8 voor 500 g, apart afgerond per smaak. Pas deze aantallen aan indien de leverancier andere verpakkingen gebruikt.
4. Download per leverancier een PDF in de oorspronkelijke schoolopmaak: schoollogo, schooladres en facturatiegegevens. Kerstrozen op staande A4 met potmaat en minimumaantal bloemen; truffels op liggende A4 met aparte tabellen voor 250 g en 500 g. Beide bevatten totaalrijen en een groene balk met het te betalen bedrag. Ontbrekende inkoopprijzen staan expliciet vermeld; de bestelaantallen blijven bruikbaar en een onvolledig bedrag wordt niet als eindtotaal getoond.
5. Onder **Winst** staat de winst als vijfde tegel in de bovenste rij. De kleine toelichting vermeldt de Mollie-schatting en eventueel ontbrekende transport- of inkoopkosten. Deze informatie staat ook in de PDF. Er zijn slechts twee kostenvelden: **Factuur Mollie** en **Transportkosten**. Vul 0 in als een kost zeker niet van toepassing is. De berekening trekt bekende inkoop inclusief overschot af. Ongeldige invoer blokkeert de berekening. Bewaar rechtstreeks via **Kosten bewaren**, of samen met de prijzen via **Prijzen per jaar**.
6. Kies een klas of AKB en download de uitdeellijst, of download alle groepen in één PDF. AKB en Atheneum Klein-Brabant worden samengebracht. Andere klasnamen uit de export blijven behouden. De lijst bevat alleen leerlingnamen, met aparte kolomgroepen voor kerstrozen per kleur, truffels 250 g en truffels 500 g per smaak. Onderaan staan totalen per variant en per productgroep.
7. Onder **Leveringsblad per leerling** staat de knop **Download PDF voor [gekozen klas]**: één PDF voor die klas, met elke leerling op een eigen blad. Zoals in de oorspronkelijke tool staan hier de kopers, producten, aantallen, prijzen en subtotalen per koper op, plus het totaal voor de leerling. De klaslijst blijft zonder kopersnamen. Kies de klas rechtstreeks bij de leerlingbladen. Je kunt ook één leerling downloaden; de knop voor alle klassen is verwijderd. Bij uitzonderlijk veel details volgt een vervolgpagina met de leerlingnaam, zodat geen bestellingen verdwijnen of onleesbaar worden.

Zolang **Factuur Mollie** leeg is, wordt automatisch het aantal bestellingen × € 0,39 afgetrokken. Dit veronderstelt één geslaagde betaling per bestelling; de export bevat geen betaalstatus of transactie-ID, en mogelijke dubbele bestellingen blijven meetellen. De winst en PDF blijven daarom expliciet **voorlopig, met geschatte Mollie-kosten**. Een ingevuld factuurbedrag vervangt de schatting volledig, ook wanneer het bedrag 0 is. Maak het veld weer leeg om opnieuw de schatting te gebruiken.

Alleen inkoop, Mollie en transport gaan van de omzet af. Het oude veld voor overige/gecombineerde kosten is verwijderd. Als daar vroeger een positief bedrag was bewaard, toont de pagina een melding om te controleren welke bedragen in de twee huidige velden thuishoren. Het wordt niet stilzwijgend als Mollie-factuur geïnterpreteerd. Bij bewaren worden de oude overige kosten op nul gezet.

Bestellingen met dezelfde leerlingnaam binnen dezelfde klas worden opgeteld, ongeacht hoofdletters, extra spaties of de volgorde van voornaam en achternaam. Echte spellingverschillen blijven apart en krijgen afzonderlijke leerlingbladen. Ontbrekende namen blijven per Excelrij apart. Controleer naamvarianten in de bron voordat je de definitieve leveringsbladen afdrukt. De importcontrole op mogelijke dubbele bestellingen blijft van toepassing; samenvoegen per leerling schrapt geen bestellingen.

Het exportbestand bevat geen betaalstatus: omzet is het bedrag van alle bestellingen, niet een bevestiging van ontvangen betalingen. Het resultaat blijft voorlopig zolang de export voorlopig is. Bij gewijzigde productkolommen wordt de import geblokkeerd zodat onbekende producten niet stilzwijgend wegvallen. Formules worden niet uitgevoerd: gebruik de oorspronkelijke export met vaste waarden.

## Controle

Onder Klassen + AKB staan twee ZIP-downloads: **ZIP klasoverzichten** bevat één uitdeellijst-PDF per klas; **ZIP leerlingbladen per klas** bevat één PDF per klas met alle leerlingbladen. Alleen klassen met bestellingen worden opgenomen, inclusief AKB als daar bestellingen zijn. De ZIP-bestanden worden lokaal samengesteld met de al aanwezige SheetJS-bibliotheek. Pak ze uit om de PDF per klas naar de leerkracht te mailen.

`node --test excel-import.test.mjs excel-prices.test.mjs excel-distribution.test.mjs excel-profit.test.mjs excel-suppliers.test.mjs excel-student-pdf.test.mjs`

De leerling-PDF start elke leerling op een nieuw blad en zet alle kopers in afzonderlijke producttabellen op dezelfde pagina waar dat past. Vervolgbladen herhalen leerlingnaam, klas en paginanummer binnen die leerling. Er zijn geen invulvelden voor meegeven of controle. De PDF-tests controleren meerdere kopers op één blad, scheiding tussen leerlingen en vervolgpagina's.

## Jaarprijzen en bestaande instellingen

De gedeelde bron is hetzelfde Firestore-document als de bestaande toepassing: `instellingen/kerstverkoop_<jaar>`, met `inkoopprijzen` in euro per stuk. De lokale reservekopie `winst_kerstverkoop_<jaar>_inkoopprijzen` wordt ook hergebruikt. Nieuwe velden `excelVerpakking` en `excelKosten` bewaren de doosinhoud en totale kosten. De oude Mollie-kost per bestelling wordt niet als totale kost overgenomen. Bestaande transportkosten kunnen als vertrekpunt worden geladen.

Aanmelden met het bestaande schoolaccount is nodig om de gedeelde prijzen te lezen en te bewaren. Zonder aanmelding of verbinding worden beschikbare lokale jaarprijzen gebruikt. De status vermeldt of bewaren gedeeld of alleen op deze computer is gelukt. Nog niet gesynchroniseerde lokale wijzigingen worden niet automatisch overschreven bij het laden. Meld je aan en bewaar opnieuw om ze te delen.

Een ander jaar laden wijzigt de actieve prijsset, niet de geïmporteerde bestellingen. Controleer daarom het verkoopjaar bovenaan. Bewaar gewijzigde prijzen eerst voordat je een ander jaar laadt. Er worden geen prijzen van het vorige jaar automatisch verondersteld voor een nieuw jaar. Een nieuwe export of het wissen van bestellingen verwijdert de bewaarde prijzen niet.

De browsertest gebruikt een geïsoleerde vervanger voor de gedeelde opslag en wijzigt geen echte prijzen.

Browserbibliotheken staan lokaal in `vendor/`. Voor lokale weergave kan een gewone statische HTTP-server gebruikt worden; `excel.js` is een ES-module.

## Gedeelde Excelopslag

De bestaande aangemelde toegang tot `instellingen` beschermt ook de originele Excel. Eén manifest `excel_laatste_bestellingen` verwijst naar bestandsdelen van maximaal 512 KiB. De nieuwe delen worden eerst volledig geschreven, daarna wordt het manifest in een transactie vervangen en worden de vorige delen verwijderd. Er wordt geen versiearchief aangeboden. Bij een opruimfout verschijnt een melding; bij een onzekere netwerkuitkomst blijft de status expliciet onbevestigd. Een hash controleert de integriteit bij lezen. De opgeslagen gegevens omvatten bestandsnaam, werkblad en verkoopjaar. Prijzen en kosten blijven in de bestaande jaarinstellingen staan.

De opslagtests gebruiken een geheugenadapter; de browsertest gebruikt geïsoleerde gedeelde opslag. Testbestellingen worden niet naar productie geschreven.
