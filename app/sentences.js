export const sentences = [
  ['Kan jag få en kanelbulle?', ['Mag ik een kaneelbroodje?', 'Kan ik een kaneelbroodje krijgen?']],
  ['Var ligger stationen?', ['Waar ligt het station?', 'Waar is het station?']],
  ['Jag skulle vilja ha en kaffe.', ['Ik wil graag een koffie.', 'Ik zou graag een koffie willen.']],
  ['Kan jag betala med kort?', ['Kan ik met kaart betalen?', 'Kan ik pinnen?']],
  ['Jag har bokat ett rum.', ['Ik heb een kamer geboekt.', 'Ik heb een kamer gereserveerd.']],
  ['När går nästa tåg?', ['Wanneer vertrekt de volgende trein?', 'Wanneer gaat de volgende trein?']],
  ['Var finns toaletten?', ['Waar is het toilet?', 'Waar is de wc?']],
  ['Kan jag få notan?', ['Mag ik de rekening?', 'Kan ik de rekening krijgen?']],
  ['Har ni havremjölk?', ['Hebben jullie havermelk?', 'Heeft u havermelk?']],
  ['Går den här bussen till centrum?', ['Gaat deze bus naar het centrum?', 'Rijdt deze bus naar het centrum?']],
  ['En biljett till Stockholm, tack.', ['Een kaartje naar Stockholm, alstublieft.', 'Een ticket naar Stockholm, alstublieft.']],
  ['Var kan jag köpa en biljett?', ['Waar kan ik een kaartje kopen?', 'Waar kan ik een ticket kopen?']],
  ['Vi har bokat bord för två.', ['We hebben een tafel voor twee gereserveerd.', 'Wij hebben een tafel voor twee gereserveerd.']],
  ['Finns det något vegetariskt?', ['Is er iets vegetarisch?']],
  ['Jag är allergisk mot nötter.', ['Ik ben allergisch voor noten.']],
  ['Kan vi sitta ute?', ['Kunnen we buiten zitten?', 'Kunnen wij buiten zitten?']],
  ['Kan jag få ett glas vatten?', ['Mag ik een glas water?', 'Kan ik een glas water krijgen?']],
  ['Hur mycket kostar det?', ['Hoeveel kost het?', 'Hoeveel kost dat?']],
  ['Jag tittar bara, tack.', ['Ik kijk alleen even, bedankt.', 'Ik kijk alleen even, dank je.']],
  ['Har ni en större storlek?', ['Hebben jullie een grotere maat?', 'Heeft u een grotere maat?']],
  ['Vilken väg är det till museet?', ['Welke kant is het op naar het museum?', 'Hoe kom ik bij het museum?']],
  ['Är det långt härifrån?', ['Is het ver van hier?', 'Is het hier ver vandaan?']],
  ['Vilken tid öppnar ni?', ['Hoe laat gaan jullie open?', 'Hoe laat gaat u open?']],
  ['När måste vi checka ut?', ['Wanneer moeten we uitchecken?', 'Wanneer moeten wij uitchecken?']],
  ['Kan jag lämna väskan här?', ['Kan ik de tas hier achterlaten?', 'Kan ik hier de tas achterlaten?']],
  ['Vad är lösenordet till wifi?', ['Wat is het wifiwachtwoord?', 'Wat is het wachtwoord voor wifi?']],
  ['Ursäkta, pratar du engelska?', ['Sorry, spreek je Engels?', 'Pardon, spreek je Engels?']],
  ['Kan du säga det en gång till?', ['Kun je dat nog een keer zeggen?', 'Kun jij dat nog een keer zeggen?']],
  ['Kan du prata lite långsammare?', ['Kun je wat langzamer praten?', 'Kun je iets langzamer praten?']],
  ['Jag behöver hjälp.', ['Ik heb hulp nodig.']],
  ['Var ligger närmaste apotek?', ['Waar is de dichtstbijzijnde apotheek?', 'Waar ligt de dichtstbijzijnde apotheek?']],
  ['Jag har tappat bort mitt pass.', ['Ik ben mijn paspoort kwijt.', 'Ik heb mijn paspoort verloren.']],
]

const places = [
  ['centralstationen', 'het centraal station'], ['hotellet', 'het hotel'], ['museet', 'het museum'],
  ['apoteket', 'de apotheek'], ['restaurangen', 'het restaurant'], ['butiken', 'de winkel'],
  ['biblioteket', 'de bibliotheek'], ['busshållplatsen', 'de bushalte'],
]
const placeQuestions = [
  (sv, nl) => [`Var ligger ${sv}?`, `Waar ligt ${nl}?`],
  (sv, nl) => [`Hur kommer jag till ${sv}?`, `Hoe kom ik bij ${nl}?`],
  (sv, nl) => [`Är ${sv} öppet idag?`, `Is ${nl} vandaag open?`],
  (sv, nl) => [`Kan jag gå till ${sv}?`, `Kan ik naar ${nl} lopen?`],
  (sv, nl) => [`Går bussen till ${sv}?`, `Gaat de bus naar ${nl}?`],
  (sv, nl) => [`Jag letar efter ${sv}.`, `Ik zoek ${nl}.`],
  (sv, nl) => [`Hur långt är det till ${sv}?`, `Hoe ver is het naar ${nl}?`],
  (sv, nl) => [`Vilken tid stänger ${sv}?`, `Hoe laat sluit ${nl}?`],
  (sv, nl) => [`Kan du visa vägen till ${sv}?`, `Kun je mij de weg naar ${nl} wijzen?`],
  (sv, nl) => [`Finns det wifi på ${sv}?`, `Is er wifi bij ${nl}?`],
]
const dishes = [
  ['en cappuccino', 'een cappuccino'], ['en te', 'een thee'], ['ett glas mineralvatten', 'een glas mineraalwater'],
  ['en chokladboll', 'een chocoladebol'], ['en smörgås', 'een broodje'],
  ['en sallad', 'een salade'], ['en soppa', 'een soep'], ['en juice', 'een sapje'],
]
const foodRequests = [
  (sv, nl) => [`Kan jag få ${sv}?`, `Mag ik ${nl}?`],
  (sv, nl) => [`Jag skulle vilja ha ${sv}.`, `Ik wil graag ${nl}.`],
  (sv, nl) => [`Har ni ${sv}?`, `Hebben jullie ${nl}?`],
  (sv, nl) => [`Vad kostar ${sv}?`, `Wat kost ${nl}?`],
  (sv, nl) => [`Jag beställer ${sv}.`, `Ik bestel ${nl}.`],
  (sv, nl) => [`Kan jag köpa ${sv} här?`, `Kan ik hier ${nl} kopen?`],
  (sv, nl) => [`Finns det ${sv} utan mjölk?`, `Is er ${nl} zonder melk?`],
  (sv, nl) => [`Kan du ta med ${sv}?`, `Kun je ${nl} meenemen?`],
  (sv, nl) => [`Kan vi dela på ${sv}?`, `Kunnen we ${nl} delen?`],
  (sv, nl) => [`Jag tar ${sv}, tack.`, `Ik neem ${nl}, alstublieft.`],
]
const moreTravel = [
  ['Var ligger utgången?', ['Waar is de uitgang?']],
  ['Kan du ringa en taxi?', ['Kun je een taxi bellen?']],
  ['Finns det en ledig plats?', ['Is er een vrije plek?']],
  ['Vilken perrong går tåget från?', ['Van welk perron vertrekt de trein?']],
  ['Jag har tappat min telefon.', ['Ik ben mijn telefoon kwijt.']],
  ['Kan jag få ett kvitto?', ['Mag ik een bonnetje?']],
  ['När kommer färjan?', ['Wanneer komt de veerboot?']],
  ['Kan jag hyra en cykel?', ['Kan ik een fiets huren?']],
]

for (const [place, dutch] of places) {
  for (const question of placeQuestions) {
    const [swedish, translation] = question(place, dutch)
    sentences.push([swedish, [translation]])
  }
}
for (const [dish, dutch] of dishes) {
  for (const request of foodRequests) {
    const [swedish, translation] = request(dish, dutch)
    sentences.push([swedish, [translation]])
  }
}
sentences.push(...moreTravel)
