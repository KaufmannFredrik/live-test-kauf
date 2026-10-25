/* =========================================================
   FISKE — ordliste.js
   Ordlisten i fiskekalenderen: ordene og forkortelsene som
   brukes på siden, med søk og temaer.
   ========================================================= */

(() => {
  const TEMA = [
    {id:'sjo', t:'Tidevann og sjø'},
    {id:'vaer', t:'Vær og lys'},
    {id:'utstyr', t:'Utstyr'},
    {id:'maate', t:'Fiskemåter'},
    {id:'art', t:'Arter'},
    {id:'regel', t:'Regler'},
    {id:'plass', t:'Plasser'},
    {id:'data', t:'Data og poeng'}
  ];

  // [tema, ord, forklaring]
  const ORD = [
    // Tidevann og sjø
    ['sjo', 'Flo', 'Når sjøen står høyest. I Trondheim er det flo omtrent to ganger i døgnet, med drøyt 12 timer og 25 minutter mellom.'],
    ['sjo', 'Fjære', 'Når sjøen står lavest, omtrent midt mellom to floer.'],
    ['sjo', 'Stigende sjø', 'Tiden fra fjære til flo, når vannet stiger. TOFA sier Hurtigrutekaia er best da.'],
    ['sjo', 'Fallende sjø', 'Tiden fra flo til fjære, når vannet synker.'],
    ['sjo', 'Full flo', 'Akkurat når sjøen står høyest. TOFA sier Trolla er best da.'],
    ['sjo', 'Snu (stille vann)', 'Tiden rundt flo og fjære når tidevannsstrømmen snur og nesten stopper.'],
    ['sjo', 'Tidevannsstrøm', 'Strømmen som oppstår når vannet renner inn og ut med tidevannet. Den er sterkest midt mellom flo og fjære.'],
    ['sjo', 'Springflo', 'Dagene rundt nymåne og fullmåne, når sola og månen drar samme vei og forskjellen mellom flo og fjære er størst. I Trondheim opptil ca. 2,8 m.'],
    ['sjo', 'Nippflo', 'Dagene rundt halvmåne, når forskjellen mellom flo og fjære er minst. I Trondheim ned mot ca. 0,7 m.'],
    ['sjo', 'Tidevannstabell', 'Oversikt over når det er flo og fjære, og hvor høyt vannet står. Siden henter den fra Kartverket.'],
    ['sjo', 'Sjøkartnull', 'Nivået dybdene i sjøkartet og høydene i tidevannstabellen regnes fra. Vannet går sjelden lavere enn dette.'],
    ['sjo', 'Dybdekurve', 'Linje i sjøkartet som binder sammen steder med samme dybde.'],
    ['sjo', 'Åpent vann (strøklengde)', 'Hvor langt vinden blåser over vann før den når plassen. Jo lenger strøk, jo større bølger. Siden har målt det i sjøkartet i 36 retninger for hver plass.'],
    ['sjo', 'Signifikant bølgehøyde', 'Snittet av den høyeste tredjedelen av bølgene, omtrent det en erfaren observatør anslår som bølgehøyden. Det er tallet siden regner ut for hver plass.'],
    ['sjo', 'Sjøgang', 'Skala for hvor grov sjøen er (WMO): smul sjø 0,1 til 0,5 m, lett sjø 0,5 til 1,25 m, moderat sjø 1,25 til 2,5 m og grov sjø 2,5 til 4 m bølgehøyde.'],
    ['sjo', 'Le', 'Ly for vinden. En plass ligger i le når vinden kommer fra land, og det ikke er åpent vann i vindretningen.'],
    ['sjo', 'Sjøtemperatur', 'Temperaturen i overflaten. Siden henter den for hver plass fra havvarselet til MET.'],

    // Vær og lys
    ['vaer', 'Dagslys', 'Sola står mer enn 10° over horisonten.'],
    ['vaer', 'Lav sol', 'Sola står mellom 2° og 10° over horisonten, tidlig om morgenen og sent på ettermiddagen.'],
    ['vaer', 'Skumring', 'Fra sola er 2° over horisonten til den er 6° under. Mange rovfisker jakter mest da.'],
    ['vaer', 'Mørkt', 'Sola er mellom 6° og 12° under horisonten (nautisk tussmørke). Det er for mørkt til å se godt uten lys.'],
    ['vaer', 'Natt', 'Sola er mer enn 12° under horisonten. Midt på sommeren blir det aldri natt i Trondheim.'],
    ['vaer', 'Solhøyde', 'Hvor mange grader sola står over eller under horisonten. Siden bruker den til å regne ut lyset.'],
    ['vaer', 'Vindstyrke', 'Stille under 0,3 m/s, flau vind 0,3 til 1,5, svak vind 1,6 til 3,3, lett bris 3,4 til 5,4, laber bris 5,5 til 7,9, frisk bris 8 til 10,7, liten kuling 10,8 til 13,8, stiv kuling 13,9 til 17,1 og sterk kuling fra 17,2 m/s.'],
    ['vaer', 'Vindretning', 'Retningen vinden kommer fra. «Vind fra nordvest» blåser mot sørøst.'],
    ['vaer', 'Byger', 'Nedbør som kommer og går, med opphold imellom.'],
    ['vaer', 'Sludd', 'Blanding av regn og snø.'],
    ['vaer', 'Lufttrykk', 'Er ikke med i poengene. Det finnes ikke kontrollerte studier som viser at det påvirker fisket.'],
    ['vaer', 'Solunar-tabeller', 'Tabeller som spår gode fisketider ut fra månens stilling. Forskningen finner ingen sikker effekt, så de er ikke med. Månen er med gjennom tidevannet.'],

    // Utstyr
    ['utstyr', 'Stang', 'Fiskestanga. Lengden oppgis ofte i fot, og kastevekten i gram.'],
    ['utstyr', 'Fot', 'Lengdemål for stenger. 1 fot er 30,48 cm, så en stang på 9 fot er ca. 2,7 m.'],
    ['utstyr', 'Kastevekt', 'Vekten stanga er laget for å kaste, for eksempel 15 til 60 g. Tyngre sluk eller søkke kan knekke stanga, lettere er vanskelig å kaste langt.'],
    ['utstyr', 'Allroundstang', 'Middels stang, ofte 9 til 10 fot og 15 til 60 g kastevekt. Passer til det meste av fiske fra land.'],
    ['utstyr', 'Surfstang', 'Lang og kraftig stang for lange kast med tunge søkker. TOFA anbefaler det på Trolla, med søkke på 150 til 200 g.'],
    ['utstyr', 'Snelle', 'Spolen snøret ligger på. Til fiske fra land brukes som regel haspelsnelle.'],
    ['utstyr', 'Flettesnor', 'Flettet snøre som nesten ikke strekker seg. Tynt og sterkt, og du kjenner hugget godt.'],
    ['utstyr', 'Sene (monofil)', 'Vanlig snøre av nylon i én tråd. Strekker seg litt.'],
    ['utstyr', 'Fluorokarbon', 'Snøre som er nesten usynlig i vann og tåler slitasje mot stein. Brukes ofte som forfang.'],
    ['utstyr', 'Forfang', 'Den nederste biten av snøret, mellom hovedsnøret og sluket eller kroken.'],
    ['utstyr', 'Søkke', 'Blylodd som får agnet ned og holder det på bunnen.'],
    ['utstyr', 'Krok', 'For de vanlige størrelsene betyr høyere tall mindre krok. Str. 28 er en bitteliten krok til mikromeite.'],
    ['utstyr', 'Treblekrok', 'Krok med tre spisser. Sitter ofte på sluk og wobblere, og er skarp, så bruk vernebriller.'],
    ['utstyr', 'Svivel', 'Liten virvel mellom snøre og forfang som hindrer at snøret tvinner seg.'],
    ['utstyr', 'Takkel', 'Alt som sitter nederst på snøret: kroker, søkke og sviveler.'],
    ['utstyr', 'Bunntakkel', 'Takkel med søkke som ligger på bunnen og en eller flere kroker med agn.'],
    ['utstyr', 'Glidende takkel', 'Bunntakkel der søkket glir fritt på snøret, så fisken ikke kjenner motstand når den tar agnet.'],
    ['utstyr', 'Makrelltakkel', 'Forfang med flere små kroker pyntet med blanke fjær eller plast, og et tungt sluk eller søkke i enden.'],
    ['utstyr', 'Sildehekle', 'Som en makrelltakkel, men med mindre kroker. Brukes til småsild.'],
    ['utstyr', 'Sluk', 'Kunstig agn av metall som blinker og vrir seg når du sveiver inn.'],
    ['utstyr', 'Skjesluk', 'Sluk formet som en bøyd skje. Vanlig til sei, lyr og torsk.'],
    ['utstyr', 'Sildesluk', 'Langt, slankt sluk som ligner en sild.'],
    ['utstyr', 'Pilk', 'Tungt metallsluk som slippes til bunnen og løftes og senkes. Klassisk til torsk.'],
    ['utstyr', 'Shad', 'Gummifisk med halespade som vibrerer. Fiskes på et jigghode.'],
    ['utstyr', 'Jigghode', 'Krok med innstøpt bly, som shad og andre gummiagn settes på.'],
    ['utstyr', 'Wobbler', 'Kunstig fisk av plast eller tre som svømmer når du sveiver den inn.'],
    ['utstyr', 'Kystwobbler', 'Slankt, tungt sluk laget for lange kast fra land, mest til sjøørret.'],
    ['utstyr', 'Flue', 'Kunstig agn av fjær og hår. Fiskes med fluestang, eller bak en tung dupp.'],
    ['utstyr', 'Agn', 'Ekte mat på kroken, for eksempel sild, makrell, reke eller blåskjell.'],
    ['utstyr', 'Landingshåv', 'Håv med langt skaft til å løfte fisken opp på kaia, så den ikke river seg løs.'],
    ['utstyr', 'Flytevest', 'Vest som holder deg flytende. Bruk den alltid på kaier og svaberg hvis du er alene eller fisker i mørket.'],
    ['utstyr', 'Hodelykt', 'Lykt på hodet, så du har hendene fri. Ta med ekstra batterier.'],
    ['utstyr', 'Brodder', 'Pigger under skoene som gir feste på is og glatte svaberg om vinteren.'],
    ['utstyr', 'Polariserte solbriller', 'Briller som fjerner gjenskinnet fra vannflaten, så du ser bedre ned i vannet.'],

    // Fiskemåter
    ['maate', 'Spinnfiske', 'Du kaster ut et sluk eller en wobbler og sveiver det inn igjen.'],
    ['maate', 'Pilking (jigging)', 'Du lar sluket synke til bunnen og løfter og senker stangtuppen. Hugget kommer ofte mens sluket synker.'],
    ['maate', 'Bunnfiske (bunnmeite)', 'Du legger agn på bunnen med et søkke og venter på at fisken skal ta det.'],
    ['maate', 'Meite', 'Fiske med agn på krok.'],
    ['maate', 'Mikromeite', 'Fiske med bitte små kroker og tynn sene etter små arter. TOFA anbefaler krok str. 28 og 0,14 mm sene bak kaia på Trolla.'],
    ['maate', 'Artsfiske', 'Å prøve å få flest mulig forskjellige arter, også små arter få fisker etter. Skansen er kjent for det.'],
    ['maate', 'Fang og slipp (gjenutsetting)', 'Å slippe fisken ut igjen. Fukt hendene, løsne kroken forsiktig og hold fisken i vannet til den svømmer selv.'],
    ['maate', 'Hugg', 'Når fisken biter på.'],
    ['maate', 'Slakk', 'Løst snøre. «Ta inn slakken» betyr å sveive til snøret er stramt, så du kjenner hugget.'],
    ['maate', 'Vak', 'Plask og ringer i overflaten når fisk jager eller tar noe der.'],
    ['maate', 'Stim', 'Mange fisker som svømmer sammen, som makrell, sild og sei.'],
    ['maate', 'Bifangst', 'Fisk du får uten å fiske etter den, for eksempel en laks når du fisker etter torsk.'],

    // Arter
    ['art', 'Torsk', 'Gadus morhua. Den viktigste matfisken i Norge. Fra land er de største torskene ofte om vinteren. Minstemål 55 cm her.'],
    ['art', 'Hvitting', 'Merlangius merlangus. Mindre slektning av torsken, vanlig på mudder- og sandbunn. Minstemål 32 cm.'],
    ['art', 'Hyse', 'Melanogrammus aeglefinus. Torskefisk med en svart flekk over brystfinnen. Minstemål 40 cm.'],
    ['art', 'Sei', 'Pollachius virens. Stimfisk som gir kraftig kamp. Vanligst fra land om sommeren og høsten.'],
    ['art', 'Lyr', 'Pollachius pollachius. Nær slektning av sei, med underkjeven som stikker fram. Holder seg ved tare og stein.'],
    ['art', 'Makrell', 'Scomber scombrus. Stimfisk som kommer inn mot kysten om sommeren, når sjøen er varm nok.'],
    ['art', 'Sild og småsild', 'Clupea harengus. Stimfisk. Småsild er ung sild, og er godt agn til torsk og bunnfiske.'],
    ['art', 'Kveite', 'Hippoglossus hippoglossus. Den største flatfisken, kan bli over 2 m. Fredet 20. desember til 20. april, minstemål 84 cm.'],
    ['art', 'Lysing', 'Merluccius merluccius. Torskelignende fisk med store, skarpe tenner. Minstemål 30 cm.'],
    ['art', 'Flatfisk', 'Fisk som ligger på siden på bunnen, med begge øynene på samme side, for eksempel rødspette og kveite.'],
    ['art', 'Rødspette', 'Pleuronectes platessa. Flatfisk med oransje prikker. Minstemål 29 cm.'],
    ['art', 'Sandflyndre', 'Limanda limanda. Liten flatfisk på sandbunn.'],
    ['art', 'Skrubbe', 'Platichthys flesus. Flatfisk som tåler brakkvann og går inn i elvemunninger.'],
    ['art', 'Lomre', 'Microstomus kitt. Flatfisk med lite hode og liten munn. TOFA nevner den ved Hurtigrutekaia.'],
    ['art', 'Flyndre', 'Fellesnavn på flatfisker.'],
    ['art', 'Bunnfisk', 'Fisk som lever ved bunnen, som torsk, hvitting og flatfisk.'],
    ['art', 'Sjøørret', 'Salmo trutta. Ørret som vandrer ut i sjøen for å spise. Svak bestand i fjorden, så TOFA ber deg slippe den ut. Minstemål 35 cm.'],
    ['art', 'Laks', 'Salmo salar. Vandrer fra havet opp i elvene for å gyte. Fredet i sjøen 1. mars til 31. mai.'],
    ['art', 'Anadrom laksefisk', 'Laks, sjøørret og sjørøye: fisk som vokser opp i elv, vandrer ut i sjøen og går tilbake til elva for å gyte.'],
    ['art', 'Leppefisk', 'Fargerike fisker som lever ved stein og tang, for eksempel grønngylt og rødnebb/blåstål.'],
    ['art', 'Hågjel', 'Galeus melastomus. Liten hai som er svart inni munnen. Tas på agn om natta ved Ilsvikøra.'],
    ['art', 'Svarthå', 'Etmopterus spinax. Liten, mørk hai med lysorganer på buken.'],
    ['art', 'Havmus', 'Chimaera monstrosa. Bruskfisk i slekt med haier og rokker, med stort hode og lang, tynn hale.'],
    ['art', 'Kloskate', 'Amblyraja radiata. Rokke med torner på ryggen.'],
    ['art', 'Skate', 'Flate bruskfisker med vingeformede finner, også kalt rokker. TOFA sier Ilsvikøra er plassen for dem i Trondheim.'],
    ['art', 'Slimål', 'Myxine glutinosa. Ålelignende dyr uten kjever som lager mye slim. Kan spise agnet og fisken på kroken.'],
    ['art', 'Paddetorsk', 'Raniceps raninus. Liten, mørk torskefisk med stort hode, som lever i tang og stein.'],
    ['art', 'Vanlig fløyfisk', 'Callionymus lyra. Liten bunnfisk. Hannen har en lang, fargerik ryggfinne.'],
    ['art', 'Kvabbe (ålekvabbe)', 'Zoarces viviparus. Ålelignende bunnfisk i tang og stein nær land. Føder levende unger.'],
    ['art', 'Tangsprell', 'Pholis gunnellus. Liten, ålelignende fisk med mørke flekker langs ryggen, som lever i tangen.'],
    ['art', 'Kutling', 'Små bunnfisker som lever på grunt vann.'],
    ['art', 'Ulke', 'Bunnfisker med stort hode og pigger på gjellelokket.'],
    ['art', 'Panserulke', 'Agonus cataphractus. Liten bunnfisk dekket av beinplater. Skansen er kjent for den.'],
    ['art', 'Hårvar', 'Zeugopterus punctatus. Liten flatfisk som holder seg på stein og fjell.'],
    ['art', 'Stor kantnål', 'Syngnathus acus. Lang og tynn fisk i slekt med sjøhesten.'],

    // Regler
    ['regel', 'Minstemål', 'Den minste lengden en fisk må ha for at du kan beholde den. Er den kortere, skal den slippes ut.'],
    ['regel', 'Fredet', 'Arten eller området er stengt for fiske i en periode. Får du fisken likevel, skal den slippes ut.'],
    ['regel', 'Munningsfredningssone', 'Område utenfor en elv med laks og sjøørret der fisket er begrenset. Utenfor Nidelva er sone 1 (Nedre Elvehavna og Nyhavna) stengt for alt fiske, og i sone 2 (Ila til Lade) kan du bare fiske etter saltvannsfisk med stang fra land.'],
    ['regel', '100-metersonen', 'De første 100 meterne ut i sjøen fra grensen mellom elv og sjø. Der er fiske forbudt.'],
    ['regel', 'Saltvannsfisk', 'Fisk som lever i sjøen hele livet, som torsk, sei og makrell. Altså ikke laks og sjøørret.'],
    ['regel', 'Fiskekort', 'Tillatelse til å fiske. Du trenger det ikke for å fiske med stang i saltvann.'],
    ['regel', 'Nautisk mil', '1852 meter. Minstemålet på torsk er 55 cm innenfor 4 nautiske mil fra grunnlinjen.'],
    ['regel', 'Grunnlinjen', 'Rette linjer langs ytterkanten av kysten som havområdene regnes fra.'],
    ['regel', 'Statsforvalteren', 'Statens kontor i fylket. Lager blant annet reglene for fiske etter laks og sjøørret i sjøen.'],
    ['regel', 'Fiskeridirektoratet', 'Statens etat for fiske i sjøen. Står for minstemål og regler for fritidsfiske.'],
    ['regel', 'Miljødirektoratet', 'Statens etat som har ansvaret for laks og sjøørret, blant annet når fisket må strammes inn.'],
    ['regel', 'Mattilsynet', 'Gir råd om hvilken fisk det er trygt å spise, for eksempel fra havneområder.'],
    ['regel', 'TOFA', 'Trondheim og Omland Fiskeadministrasjon. Har skrevet beskrivelsene av fiskeplassene siden bygger på.'],
    ['regel', 'Lovdata', 'Nettstedet der alle norske lover og forskrifter ligger, også fiskereglene.'],

    // Plasser
    ['plass', 'Kai', 'Mur eller plattform langs vannet der båter legger til. Gode fiskeplasser fordi det ofte er dypt rett utenfor.'],
    ['plass', 'Pir', 'Kai som stikker ut i sjøen, som Pir I på Brattøra.'],
    ['plass', 'Molo', 'Vegg av stein eller betong som skjermer en havn mot bølger.'],
    ['plass', 'Brygge', 'Plattform av tre eller betong ut i vannet, som Storsandbrygga.'],
    ['plass', 'Flytebrygge', 'Brygge som flyter og følger tidevannet, vanlig i småbåthavner.'],
    ['plass', 'Småbåthavn', 'Havn for småbåter, ofte med flytebrygger. Vis hensyn til båtene.'],
    ['plass', 'Svaberg', 'Glatt fjell som går rett ned i sjøen. Glatt når det er vått eller isete.'],
    ['plass', 'Steinfylling', 'Kant av store steiner langs vannet. Mange arter holder seg mellom steinene, men det er lett å sette seg fast.'],
    ['plass', 'Tang og tare', 'Brunalger på stein langs land. Tang vokser i fjæra, tare dypere ned. Fisk holder seg der, og redskapen setter seg lett fast.'],
    ['plass', 'Elvemunning', 'Der elva renner ut i sjøen.'],
    ['plass', 'Mudderbunn', 'Bløt bunn av fin leire og slam, som utenfor Ilsvikøra.'],

    // Data og poeng
    ['data', 'Poeng', 'Tall fra 0 til 100 for hvor godt fisket ser ut. Det er produktet av sesong, lys, strøm, vær, vind, bølger og bestand.'],
    ['data', 'Veldig bra, Bra, Middels og Svakt', 'Ordene for poengene, satt ut fra et vanlig år: «Veldig bra» er de beste 10 % av timene, «Bra» de neste 25 % og «Middels» de neste 35 %.'],
    ['data', 'Beste', '«Beste dag», «Beste tid», «Beste plass» og «Beste fiskemåte» lar siden finne det med høyest poeng som passer resten av valgene dine.'],
    ['data', 'Sesong', 'Hvor godt fisket er i denne delen av året, fra månedskalenderen i fiskeguiden.'],
    ['data', 'Normal', 'Snittet over mange år for samme tid på året, for eksempel vanlig sjøtemperatur i oktober.'],
    ['data', 'HSI (habitatmodell)', 'Måte fiskeforskere regner ut hvor godt et sted passer for en art: hver faktor blir et tall fra 0 til 1, og tallene ganges sammen. Poengene her er laget på samme måte.'],
    ['data', 'Yr og MET', 'Yr er værvarselet til Meteorologisk institutt (MET). Siden henter vind, skyer, nedbør og temperatur for hvert klokkeslett.'],
    ['data', 'Kartverket', 'Statens kartverk. Siden henter tidevannstabellen, sjøkartet og kartet derfra.'],
    ['data', 'Sjøkart', 'Kart over sjøen med dybder, skjær, kaier og fyrlykter.'],
    ['data', 'NorKyst800', 'Havmodellen til MET for kysten av Norge, med ruter på 800 m. Gir sjøtemperaturen i havvarselet.'],
    ['data', 'Modellrute', 'Den 800 m store ruta i havmodellen sjøtemperaturen gjelder for. Ruta er ofte noen hundre meter ute fra plassen.'],
    ['data', '≈ (omtrent)', 'Merket ved en faktor betyr at det mangler varsel eller tidevannstabell, så siden bruker vanlige verdier for årstiden.']
  ];

  // Bilder fra Wikimedia Commons med fri lisens. Siden lenker til dem, så den har ingen egne bildefiler.
  // [adresse, bredde, høyde, fotograf, lisens, lenke til lisensen, siden på Commons, hva bildet viser når det trengs]
  // Bildene av artene ligger i js/arter.js sammen med resten av faktaene om dem.
  const BILDER = {
    "Skate": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/FMIB_50423_White_Ray_%28Raia_betis%29.jpeg/330px-FMIB_50423_White_Ray_%28Raia_betis%29.jpeg", 330, 326, "Charles Bevalet", "fri bruk", "", "https://commons.wikimedia.org/wiki/File:FMIB_50423_White_Ray_(Raia_betis).jpeg", "Storskate (gammel tegning)"],
    "Sluk": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/Little_Cleo_lure_P5300030.jpg/330px-Little_Cleo_lure_P5300030.jpg", 330, 223, "Hubert Derus", "CC BY 2.5", "https://creativecommons.org/licenses/by/2.5", "https://commons.wikimedia.org/wiki/File:Little_Cleo_lure_P5300030.jpg", ""],
    "Wobbler": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4b/Assorted_cranks.JPG/330px-Assorted_cranks.JPG", 330, 248, "E_tac", "fri bruk", "", "https://commons.wikimedia.org/wiki/File:Assorted_cranks.JPG", ""],
    "Flue": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/ClassicTriumphBassFly.jpg/330px-ClassicTriumphBassFly.jpg", 330, 248, "Mike Cline", "fri bruk", "", "https://commons.wikimedia.org/wiki/File:ClassicTriumphBassFly.jpg", ""],
    "Snelle": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Fishing_reel.svg/330px-Fishing_reel.svg.png", 330, 283, "Jan Tik og Chabacano", "CC BY-SA 3.0", "http://creativecommons.org/licenses/by-sa/3.0/", "https://commons.wikimedia.org/wiki/File:Fishing_reel.svg", "Haspelsnelle"],
    "Krok": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/3/37/Fish_hooks.jpg/330px-Fish_hooks.jpg", 330, 374, "Mike Cline", "CC BY-SA 3.0", "http://creativecommons.org/licenses/by-sa/3.0/", "https://commons.wikimedia.org/wiki/File:Fish_hooks.jpg", ""],
    "Søkke": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/9/95/Angeln_zubehoer_grundblei_01.jpg/330px-Angeln_zubehoer_grundblei_01.jpg", 330, 237, "Raboe001", "CC BY-SA 2.5", "https://creativecommons.org/licenses/by-sa/2.5", "https://commons.wikimedia.org/wiki/File:Angeln_zubehoer_grundblei_01.jpg", ""],
    "Stang": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Fishing_Rods.jpg/330px-Fishing_Rods.jpg", 330, 514, "Alabama Extension", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Fishing_Rods.jpg", ""],
    "Brodder": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/2/22/Broddar_2.jpg/330px-Broddar_2.jpg", 330, 233, "Holger.Ellgaard", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Broddar_2.jpg", ""],
    "Shad": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/Gummifisch2.JPG/330px-Gummifisch2.JPG", 330, 248, "Leszek Baraniec", "fri bruk med navn", "", "https://commons.wikimedia.org/wiki/File:Gummifisch2.JPG", ""],
    "Svivel": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Angeln_zubehoer_wirbel_01.jpg/330px-Angeln_zubehoer_wirbel_01.jpg", 330, 203, "Raboe001", "CC BY-SA 2.5", "https://creativecommons.org/licenses/by-sa/2.5", "https://commons.wikimedia.org/wiki/File:Angeln_zubehoer_wirbel_01.jpg", ""],
    "Hodelykt": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bd/LED-headlamp.jpg/330px-LED-headlamp.jpg", 330, 190, "Evan-Amos", "fri bruk", "", "https://commons.wikimedia.org/wiki/File:LED-headlamp.jpg", ""],
    "Flytevest": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Red_life_jacket.jpg/330px-Red_life_jacket.jpg", 330, 248, "Santeri Viinamäki", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Red_life_jacket.jpg", ""],
    "Pilk": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Pilker_1.JPG/330px-Pilker_1.JPG", 330, 248, "Gordito1869", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", "https://commons.wikimedia.org/wiki/File:Pilker_1.JPG", ""]
  };

  const $ = id => document.getElementById(id);
  const list = $('glossList'), q = $('glossQ'), cats = $('glossCats'), count = $('glossCount');
  if (!list) return;
  let tema = 'alle';
  const esc = t => t.replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
  const byWord = (a, b) => a[1].localeCompare(b[1], 'nb');
  // Latinske navn i starten av forklaringen skrives i kursiv.
  const def = t => esc(t).replace(/^([A-Z][a-z]+ [a-z]+)\. /, '<i>$1</i>. ');
  // Artene i js/arter.js, etter ordet de har i ordlisten.
  const ART = {};
  if (typeof ARTER !== 'undefined') ARTER.forEach(a => { ART[a.ord] = a; });
  // Artene vises som kobberstikk eller fotografi, etter bryteren øverst på siden.
  const pic = word => BILDER[word] || (ART[word] && (typeof artBilde === 'function' ? artBilde(ART[word]) : ART[word].bilde));
  // Bildet med fotograf og lisens under, som lisensene krever. Er ordet et samlenavn, står arten på bildet under.
  const fig = word => {
    const b = pic(word), a = ART[word], [src, w, h, who, lic, licUrl, page, own] = b;
    const what = own || (a && !word.toLowerCase().includes(a.navn.toLowerCase()) ? a.navn : '');
    const l = licUrl ? `<a href="${licUrl}" target="_blank" rel="noopener">${esc(lic)}</a>` : esc(lic);
    // Et kobberstikk har boka, tavla og navnet på stikket som bildetekst, så tegneren står der allerede.
    const cap = a && b === a.plansje ? esc(what).replace(/: (.+)$/, ': <i>$1</i>') + '. ' + l : (what ? esc(what) + '. ' : '') + `Bilde: ${esc(who)}, ${l}`;
    return `<dd class="pic"><figure><a href="${page}" target="_blank" rel="noopener"><img src="${src}" width="${w}" height="${h}" loading="lazy" alt="${esc(a ? a.navn : what || word)}"></a>` +
      `<figcaption>${cap}</figcaption></figure></dd>`;
  };
  // Artene og samlenavnene lenker til siden med fiskeartene.
  const more = word => {
    const href = ART[word] ? 'arter.html#' + ART[word].id : (typeof artHref === 'function' && artHref(word));
    return href ? ` <a class="more" href="${href}">Les mer på artssiden</a>` : '';
  };
  const dl = rows => '<dl>' + rows.map(r => {
    const dd = `<dd>${def(r[2])}${r[0] === 'art' ? more(r[1]) : ''}</dd>`;
    return pic(r[1]) ? `<div class="haspic"><dt>${esc(r[1])}</dt>${dd}${fig(r[1])}</div>` : `<div><dt>${esc(r[1])}</dt>${dd}</div>`;
  }).join('') + '</dl>';

  function render(){
    const s = q.value.trim().toLowerCase();
    cats.innerHTML = [{id:'alle', t:'Alle'}].concat(TEMA).map(k =>
      `<button type="button" class="chip" data-tema="${k.id}" aria-pressed="${tema === k.id}">${k.t}</button>`).join('');
    const hits = ORD.filter(r => (tema === 'alle' || r[0] === tema) && (!s || (r[1] + ' ' + r[2]).toLowerCase().includes(s)));
    count.textContent = hits.length ? `Viser ${hits.length} av ${ORD.length} ord.` : `Fant ingen ord for «${q.value.trim()}».`;
    // Uten søk og tema: gruppert etter tema. Ellers én liste i alfabetisk rekkefølge.
    list.innerHTML = tema === 'alle' && !s
      ? TEMA.map(k => `<h4>${k.t}</h4>` + dl(hits.filter(r => r[0] === k.id).sort(byWord))).join('')
      : dl(hits.sort(byWord));
  }
  q.addEventListener('input', render);
  document.addEventListener('fiske:bilder', render);
  cats.addEventListener('click', e => {
    const b = e.target.closest('[data-tema]'); if (!b) return;
    tema = b.dataset.tema;
    render();
  });
  render();
})();
