// Short meanings in the travel sentences. Inflected forms have their own entry.
const swedish = {
  allergisk:'allergisch', apotek:'apotheek', bara:'alleen', betala:'betalen', behöver:'nodig hebben',
  biljett:'kaartje', bokat:'geboekt', bord:'tafel', bort:'weg', bussen:'de bus', centrum:'centrum',
  checka:'in- of uitchecken', den:'die / de', det:'het / dat', du:'jij', engelska:'Engels',
  en:'een (en-woord)', ett:'een (ett-woord)', finns:'is er / zijn er', få:'krijgen / mogen',
  för:'voor', glas:'glas', gång:'keer', går:'gaat / vertrekt', ha:'hebben', har:'heb / heeft',
  havremjölk:'havermelk', hjälp:'hulp', hur:'hoe', här:'hier', härifrån:'vanaf hier',
  i:'in', jag:'ik', kaffe:'koffie', kan:'kan', kanelbulle:'kaneelbroodje', kort:'kaart',
  kostar:'kost', köpa:'kopen', ligger:'ligt', lite:'een beetje', lämna:'achterlaten',
  långsammare:'langzamer', långt:'ver', lösenordet:'het wachtwoord', med:'met',
  mitt:'mijn', mot:'tegen / voor', museet:'het museum', måste:'moeten', mycket:'veel',
  när:'wanneer', närmaste:'dichtstbijzijnde', nästa:'volgende', ni:'jullie / u',
  notan:'de rekening', något:'iets', nötter:'noten', och:'en', pass:'paspoort',
  prata:'praten', pratar:'spreek / spreekt', rum:'kamer', sitta:'zitten',
  skulle:'zou', stationen:'het station', stockholm:'Stockholm', storlek:'maat',
  större:'grotere', säga:'zeggen', tack:'bedankt / alstublieft', tappat:'verloren',
  tid:'tijd', till:'naar / voor', tittar:'kijken', toaletten:'het toilet',
  tåg:'trein', två:'twee', ursäkta:'pardon / sorry', ut:'uit', ute:'buiten',
  vad:'wat', var:'waar', vatten:'water', vegetariskt:'vegetarisch', vi:'wij',
  vilja:'willen', vilken:'welke', väg:'weg / richting', väskan:'de tas', wifi:'wifi',
  är:'ben / is / zijn', öppnar:'openen',
}

const dutch = {
  achterlaten:'lämna', alleen:'bara', allergisch:'allergisk', alstublieft:'tack',
  apotheek:'apotek', bedankt:'tack', betalen:'betala', ben:'är', buiten:'ute',
  bus:'buss', centrum:'centrum', dat:'det', de:'den / det', deze:'den här',
  dichtstbijzijnde:'närmaste', een:'en / ett', engels:'engelska', er:'det',
  even:'bara', gaan:'gå', gaat:'går', geboekt:'bokat', gereserveerd:'bokat',
  glas:'glas', havermelk:'havremjölk', graag:'gärna', grotere:'större', heb:'har', hebben:'ha', het:'det',
  hier:'här', hoe:'hur', hoeveel:'hur mycket', hulp:'hjälp', ik:'jag',
  iets:'något', is:'är', je:'du', jullie:'ni', kaart:'kort', kaartje:'biljett',
  kamer:'rum', kan:'kan', kaneelbroodje:'kanelbulle', kant:'väg', keer:'gång',
  kijk:'tittar', koffie:'kaffe', kopen:'köpa', kost:'kostar', kun:'kan',
  kunnen:'kan', kwijt:'tappat bort', laat:'långsammare', langzamer:'långsammare',
  ligt:'ligger', maat:'storlek', mag:'kan / får', met:'med', mijn:'mitt',
  moeten:'måste', museum:'museet', naar:'till', nodig:'behöver', nog:'till',
  noten:'nötter', op:'på', open:'öppnar', paspoort:'pass', praten:'prata',
  rekening:'notan', stockholm:'Stockholm', sorry:'ursäkta', spreek:'pratar', station:'stationen',
  tafel:'bord', tas:'väskan', toilet:'toaletten', trein:'tåg', twee:'två',
  uitchecken:'checka ut', van:'från', ver:'långt', vertrekt:'går',
  vegetarisch:'vegetariskt', volgende:'nästa', voor:'för / mot', waar:'var',
  wanneer:'när', wat:'vad', water:'vatten', we:'vi', welke:'vilken',
  wifi:'wifi', wifiwachtwoord:'lösenordet till wifi', wil:'vill',
  zeggen:'säga', zitten:'sitta',
}

Object.assign(swedish, {
  centralstationen:'het centraal station', cappuccino:'cappuccino', mineralvatten:'mineraalwater', chokladboll:'chocoladebol', apoteket:'de apotheek', beställer:'bestel', biblioteket:'de bibliotheek',
  busshållplatsen:'de bushalte', butiken:'de winkel', cykel:'fiets', dela:'delen',
  efter:'naar / achter', från:'van / vanaf', färjan:'de veerboot', gå:'lopen / gaan',
  hotellet:'het hotel', hyra:'huren', idag:'vandaag', juice:'sapje', kommer:'komt',
  kvitto:'bonnetje', ledig:'vrij', letar:'zoeken', min:'mijn', mjölk:'melk',
  perrong:'perron', plats:'plek', på:'op / bij', restaurangen:'het restaurant',
  ringa:'bellen', sallad:'salade', smörgås:'broodje', soppa:'soep', stänger:'sluit',
  ta:'nemen', tar:'neem', taxi:'taxi', te:'thee', telefon:'telefoon', tåget:'de trein',
  utan:'zonder', utgången:'de uitgang', visa:'wijzen', vägen:'de weg', öppet:'open',
})
Object.assign(dutch, {
  centraal:'central', cappuccino:'cappuccino', mineraalwater:'mineralvatten', chocoladebol:'chokladboll', bellen:'ringa', bestel:'beställer', bibliotheek:'biblioteket', bij:'på / till',
  bonnetje:'kvitto', broodje:'smörgås', bushalte:'busshållplatsen', delen:'dela',
  fiets:'cykel', hotel:'hotellet', huren:'hyra', kom:'kommer', komt:'kommer',
  lopen:'gå', meenemen:'ta med', melk:'mjölk', mij:'mig', neem:'tar',
  perron:'perrong', plek:'plats', restaurant:'restaurangen', salade:'sallad',
  sapje:'juice', sluit:'stänger', soep:'soppa', taxi:'taxi', telefoon:'telefon',
  thee:'te', uitgang:'utgången', vandaag:'idag', veerboot:'färjan', vrije:'ledig',
  weg:'vägen', welk:'vilken', wijzen:'visa', winkel:'butiken', zoek:'letar',
  zonder:'utan',
})

export function wordMeaning(word, language) {
  const key = word.toLocaleLowerCase(language).replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')
  return (language === 'sv' ? swedish : dutch)[key] ?? 'Vertaling niet beschikbaar'
}
