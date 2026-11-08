# Fika · Zweeds oefenen

Next.js-app om 200 veelgebruikte Zweedse woorden te oefenen. Start lokaal met
`npm ci` en `npm run dev`. Voor productie gebruik je `npm run build` en
`npm start`. Op Vercel volstaat het Next.js-preset zonder omgevingsvariabelen.
Zinnen bouwen is de hoofdoefening. Je kiest woorden uit een woordbank en kunt
gekozen tegels terugleggen. Eerder goed beantwoorde woorden komen als extra
keuzes terug. De browser leest Zweedse woorden en zinnen voor met een beschikbare Zweedse stem.
Spreekoefeningen laten je lokaal opnemen en terugluisteren. De app beoordeelt
de uitspraak niet automatisch.

Voortgang en dagdoel worden opgeslagen in IndexedDB in de gebruikte browser.
Een fout of overgeslagen woord komt in aanmerking voor herhaling na drie andere pogingen als er
voldoende kaarten zijn. Correcte antwoorden plannen herhaling na 1, 3, 7,
14 of 30 dagen. Het dagdoel is instelbaar en vormt geen limiet.

Woordenbron: Elena Volodina & Sofie Johansson Kokkinakis (2017), *Kelly*,
Språkbanken, [DOI](https://doi.org/10.23695/6act-rs25),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
De app selecteert de 200 unieke schrijfwijzen met de hoogste geregistreerde
ruwe frequentie en voegt Nederlandse vertalingen toe. De volgorde weerspiegelt
de frequentie in het SweWaC-webcorpus. Zie ook Kilgarriff et al. (2014),
[Corpus-based vocabulary lists for language learners for nine languages](https://doi.org/10.1007/s10579-013-9251-2).
