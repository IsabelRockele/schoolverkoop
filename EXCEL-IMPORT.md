# Excel-export verwerken

Open `excel.html` op dezelfde website als de bestaande schoolpagina. Er staat ook een link op `school.html`. Deze zelfstandige pagina heeft geen Firebaseverbinding nodig: alle bestellingen blijven in het geheugen van de browser en verdwijnen bij sluiten, herladen of **Gegevens wissen**. Er worden geen bestellingen samengevoegd met de bestaande verkoopdatabase. Kies bij iedere nieuwe export het volledige bestand; dit vervangt de vorige import.

1. Selecteer de oorspronkelijke WPForms `.xlsx`-export en het juiste werkblad.
2. Controleer de koppeling en bestellingen. Kolomnamen bepalen de koppeling, niet hun positie: **Waarde is de stukprijs**, **Hoeveelheid is het aantal**. Het bedrag in **Totaal** moet exact overeenkomen met de som van prijs × aantal en de gift. Fouten blokkeren alle rapporten. Mogelijke dubbele rijen worden gemeld en blijven meetellen tot de bron is gecorrigeerd.
3. Vink de controle aan. Vul de inkoopprijzen per stuk / klein truffeldoosje in. De bestaande verpakking is 12 stuks voor 250 g en 8 voor 500 g, apart afgerond per smaak. Pas deze aantallen aan indien de leverancier andere verpakkingen gebruikt.
4. Download per leverancier een PDF. Ontbrekende inkoopprijzen staan expliciet vermeld; de bestelaantallen blijven bruikbaar.
5. Vul de werkelijke betaal-/overige kosten en transportkosten in, ook bij nul. De winst-PDF is pas beschikbaar wanneer alle benodigde kosten zijn ingevuld. De berekening trekt de volledige inkoop inclusief overschot af. Instellingen blijven alleen tijdens de sessie bewaard.
6. Kies een klas of AKB en download de uitdeellijst, of download alle groepen in één PDF. AKB en Atheneum Klein-Brabant worden samengebracht. Andere klasnamen uit de export blijven behouden. Elke bestelling blijft een afzonderlijke regel met leerling en koper.

Het exportbestand bevat geen betaalstatus: omzet is het bedrag van alle bestellingen, niet een bevestiging van ontvangen betalingen. Het resultaat blijft voorlopig zolang de export voorlopig is. Bij gewijzigde productkolommen wordt de import geblokkeerd zodat onbekende producten niet stilzwijgend wegvallen. Formules worden niet uitgevoerd: gebruik de oorspronkelijke export met vaste waarden.

## Controle

`node --test excel-import.test.mjs`

Browserbibliotheken staan lokaal in `vendor/`. Voor lokale weergave kan een gewone statische HTTP-server gebruikt worden; `excel.js` is een ES-module.
