'use client'

import { useEffect, useRef, useState } from 'react'
import words from './words.json'
import { sentences } from './sentences'
import { dateKey, dueWords, initialProgress, nextWord, record, SECTION_SIZE } from './learning'
import { loadProgress, saveProgress } from './storage'

function normalize(text) {
  return text.normalize('NFC').toLowerCase().trim().replace(/[.!?,;:]/g, '').replace(/\s+/g, ' ')
}

function wordCard(id, step) {
  const [swedish, dutch] = words[id]
  const distractors = []
  for (let offset = 1; distractors.length < 3; offset++) {
    const option = words[(id + offset * 17) % words.length][1]
    const meanings = dutch.split(' / ')
    if (!distractors.includes(option) && !option.split(' / ').some(part => meanings.includes(part))) {
      distractors.push(option)
    }
  }
  distractors.splice((id + step * 3) % 4, 0, dutch)
  return { id, kind: 'word', swedish, dutch, options: distractors }
}

const exerciseCycle = [
  'toSwedish', 'toDutch', 'word', 'toSwedish', 'toDutch', 'speech',
  'toSwedish', 'toDutch', 'word', 'toSwedish', 'toDutch', 'word',
]
const starterTiles = {
  toSwedish: ['tåg', 'karta', 'biljett', 'här', 'du', 'vi'],
  toDutch: ['trein', 'kaart', 'kaartje', 'hier', 'jij', 'wij'],
}

function makeTiles(sentence, kind, progress) {
  const required = normalize(sentence).split(' ')
  const learned = Object.entries(progress.words)
    .filter(([, word]) => word.first && word.level > 0)
    .sort(([, a], [, b]) => b.level - a.level)
    .flatMap(([id]) => {
      const [swedish, dutch] = words[id]
      return kind === 'toSwedish' ? [swedish] : dutch.split(' / ')
    })
    .map(normalize)
    .filter(word => /^\p{L}+$/u.test(word))
  const extras = [...new Set([...learned, ...starterTiles[kind]])]
    .filter(word => !required.includes(word))
    .slice(0, 3)
  const tiles = [...required, ...extras].map((word, id) => ({ word, id }))
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tile = tiles[i]
    tiles[i] = tiles[j]
    tiles[j] = tile
  }
  return tiles
}

function makeCard(progress, section, previous) {
  const slot = progress.step % exerciseCycle.length
  const kind = exerciseCycle[slot]
  if (kind === 'word') return wordCard(nextWord(progress, section, previous), progress.step)

  const cycle = Math.floor(progress.step / exerciseCycle.length)
  const translations = exerciseCycle.slice(0, slot)
    .filter(type => type === 'toSwedish' || type === 'toDutch').length
  // Change the sentence paired with each direction on subsequent passes.
  const translationNumber = cycle * 8 + translations
  const index = kind === 'speech' ? cycle : translationNumber + Math.floor(translationNumber / sentences.length)
  const [swedish, dutch] = sentences[index % sentences.length]
  const tiles = kind === 'speech' ? [] : makeTiles(kind === 'toSwedish' ? swedish : dutch[0], kind, progress)
  return { kind, swedish, dutch, tiles }
}

function recordCard(progress, card, correct) {
  if (card.kind === 'word') return record(progress, card.id, correct)
  return { ...progress, step: progress.step + 1 }
}

export default function Home() {
  const [progress, setProgress] = useState(initialProgress)
  const [ready, setReady] = useState(false)
  const [section, setSection] = useState(0)
  const [card, setCard] = useState(() => wordCard(0, 0))
  const [answer, setAnswer] = useState('')
  const [selectedTiles, setSelectedTiles] = useState([])
  const [feedback, setFeedback] = useState(null)
  const [storageError, setStorageError] = useState(false)
  const [audioMessage, setAudioMessage] = useState('')
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const recorder = useRef(null)
  const attempt = useRef(0)
  const title = useRef(null)

  useEffect(() => {
    let active = true
    loadProgress().then(saved => {
      if (!active) return
      const data = saved ?? initialProgress
      const first = nextWord(data, data.section ?? 0)
      const current = Math.floor(first / SECTION_SIZE)
      setProgress(data)
      setSection(current)
      setCard(makeCard(data, current))
    }).catch(() => {
      if (!active) return
      setStorageError(true)
      setCard(makeCard(initialProgress, 0))
    })
      .finally(() => active && setReady(true))
    return () => { active = false }
  }, [])

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  function update(data) {
    setProgress(data)
    saveProgress(data).then(() => setStorageError(false)).catch(() => setStorageError(true))
  }

  function listen() {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setAudioMessage('Deze browser ondersteunt voorlezen niet.')
      return
    }
    const engine = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(card.swedish)
    utterance.lang = 'sv-SE'
    utterance.rate = 0.85
    const voice = engine.getVoices().find(item => item.lang.toLowerCase().startsWith('sv') && item.localService)
    if (voice) utterance.voice = voice
    utterance.onerror = event => {
      if (!['interrupted', 'canceled'].includes(event.error)) {
        setAudioMessage('Afspelen lukte niet. Controleer of je apparaat een Zweedse stem heeft.')
      }
    }
    setAudioMessage('')
    engine.cancel()
    engine.speak(utterance)
  }

  async function toggleRecording() {
    if (recorder.current?.state === 'recording') {
      recorder.current.stop()
      return
    }
    const current = ++attempt.current
    setAudioMessage('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (attempt.current !== current) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      try {
        const media = new MediaRecorder(stream)
        const chunks = []
        recorder.current = media
        media.ondataavailable = event => chunks.push(event.data)
        media.onstop = () => {
          stream.getTracks().forEach(track => track.stop())
          if (attempt.current !== current) return
          setRecording(false)
          setAudioUrl(URL.createObjectURL(new Blob(chunks, { type: media.mimeType })))
        }
        media.start()
        setRecording(true)
      } catch (error) {
        stream.getTracks().forEach(track => track.stop())
        throw error
      }
    } catch {
      if (attempt.current === current) setAudioMessage('De microfoon is niet beschikbaar. Je kunt de zin hardop nazeggen en doorgaan.')
    }
  }

  function submit(value) {
    if (feedback) return
    const expected = card.kind === 'toSwedish' ? [card.swedish] : card.dutch
    const correct = card.kind === 'word' ? value === expected
      : card.kind === 'speech' ? value === true
      : expected.some(option => normalize(option) === normalize(value))
    update(recordCard(progress, card, correct))
    setFeedback({ correct })
  }

  function show(next, requestedSection = Math.floor(next.id / SECTION_SIZE)) {
    attempt.current++
    if (recorder.current?.state === 'recording') recorder.current.stop()
    setRecording(false)
    setAudioUrl('')
    setAudioMessage('')
    setAnswer('')
    setSelectedTiles([])
    setFeedback(null)
    setSection(requestedSection)
    setCard(next)
    requestAnimationFrame(() => title.current?.focus())
  }

  function advance() {
    const updated = feedback ? progress : recordCard(progress, card, false)
    if (!feedback) update(updated)
    const next = makeCard(updated, section, card.kind === 'word' ? card.id : undefined)
    show(next, next.kind === 'word' ? undefined : section)
  }

  function chooseSection(index) {
    const start = index * SECTION_SIZE
    const fresh = words.slice(start, start + SECTION_SIZE)
      .findIndex((_, offset) => !progress.words[start + offset]?.first)
    const data = { ...progress, section: index }
    update(data)
    show(wordCard(start + Math.max(0, fresh), data.step), index)
  }

  const today = dateKey()
  const known = Object.values(progress.words).filter(word => word.first)
  const daily = known.filter(word => word.first === today).length
  const due = dueWords(progress, today).length
  const vocabulary = card.kind === 'word'
  const speech = card.kind === 'speech'
  const toSwedish = card.kind === 'toSwedish'
  const prompt = toSwedish ? card.dutch[0] : card.swedish

  return <main className="shell">
    <header className="header">
      <a className="brand" href="./"><span className="flag" aria-hidden="true" /> fika<span>.</span></a>
      <span className="header-note">ZWEEDS IN KLEINE STAPPEN</span>
    </header>

    <section className="hero">
      <div><p className="eyebrow">HEJ! · JOUW TAALTRAINER</p><h1>Een beetje Zweeds,<br />elke dag.</h1>
      <p>Oefen Zweedse reiszinnen en 200 veelgebruikte woorden.</p></div>
      <div className="goal">
        <label htmlFor="goal">Nieuwe woorden per dag</label>
        <div className="goal-line"><strong>{daily}</strong><span> / </span><select id="goal" value={progress.goal} disabled={!ready} onChange={event => update({ ...progress, goal: Number(event.target.value) })}>
          {[3, 5, 10, 15, 20].map(amount => <option key={amount}>{amount}</option>)}
        </select></div>
        <progress value={Math.min(daily, progress.goal)} max={progress.goal} aria-label="Voortgang dagdoel" />
        <small>{daily >= progress.goal ? 'Dagdoel gehaald! Je kunt verder.' : `Nog ${progress.goal - daily} voor je dagdoel`}</small>
      </div>
    </section>

    <div className="grid">
      <section className="card" aria-label="Oefening">
        <div className="card-top"><span>SECTIE {String(section + 1).padStart(2, '0')}</span>
          <span>{vocabulary ? 'WOORDEN' : speech ? 'SPREKEN' : toSwedish ? 'NL → SV' : 'SV → NL'}</span></div>
        <progress className="lesson-progress" value={progress.step % exerciseCycle.length} max={exerciseCycle.length} aria-label="Voortgang oefenronde" />
        <h2 ref={title} tabIndex={-1}>{!ready ? 'Voortgang laden…' : vocabulary ? 'Wat betekent dit woord?' : speech ? 'Zeg deze zin hardop' : 'Bouw de vertaling'}</h2>
        {ready && <>
          <div className={vocabulary || speech ? "prompt" : "prompt sentence-prompt"}>
            <strong lang={toSwedish ? 'nl' : 'sv'}>{prompt}</strong>
            {(!toSwedish || feedback) && <button className="sound" onClick={listen} aria-label="Luister naar de Zweedse uitspraak">♫</button>}
          </div>
          {speech && <p className="hint">{card.dutch[0]} Luister en vergelijk je uitspraak met het voorbeeld.</p>}
          {audioMessage && <p role="status" className="hint">{audioMessage}</p>}
          {vocabulary && <div className="options">
            {card.options.map(option => <button key={option} disabled={!!feedback}
              className={feedback && option === card.dutch ? 'correct' : feedback && option === answer ? 'wrong' : ''}
              onClick={() => { setAnswer(option); submit(option) }}>{option}</button>)}
          </div>}
          {speech && <div className="speech">
            <button onClick={toggleRecording}>{recording ? 'Stop opname' : 'Neem jezelf op'}</button>
            {audioUrl && <audio controls src={audioUrl} aria-label="Je eigen uitspraak" />}
            <button disabled={!!feedback} onClick={() => submit(true)}>Ik heb het uitgesproken</button>
          </div>}
          {!speech && !vocabulary && <form className="translation" onSubmit={event => {
            event.preventDefault()
            if (selectedTiles.length) submit(selectedTiles.map(tile => tile.word).join(' '))
          }}>
            <div className="tile-answer" role="group" aria-label="Jouw zin">
              {selectedTiles.length ? selectedTiles.map(tile => <button type="button" key={tile.id}
                lang={toSwedish ? 'sv' : 'nl'} aria-label={`Leg ${tile.word} terug`}
                disabled={!!feedback} onClick={() => setSelectedTiles(tiles => tiles.filter(item => item.id !== tile.id))}>
                {tile.word}
              </button>) : <span>Tik de woorden aan in de juiste volgorde</span>}
            </div>
            <div className="tile-bank" role="group" aria-label="Woordbank">
              {card.tiles.map(tile => {
                const used = selectedTiles.some(item => item.id === tile.id)
                return <button type="button" key={tile.id} lang={toSwedish ? 'sv' : 'nl'}
                  disabled={!!feedback} aria-disabled={used}
                  onClick={() => setSelectedTiles(tiles => tiles.some(item => item.id === tile.id) ? tiles : [...tiles, tile])}>
                  {tile.word}
                </button>
              })}
            </div>
            <button className="check" type="submit" disabled={!!feedback || !selectedTiles.length}>Controleer</button>
          </form>}
          <div className="feedback" aria-live="polite">
            {feedback && <p className={feedback.correct ? 'success' : 'retry'}>
              {speech ? 'Goed geoefend.' : feedback.correct ? 'Helemaal goed!' : vocabulary ? 'Dit woord komt later terug.' : 'Bijna. Dit is een voorbeeldantwoord.'}
              {!speech && <> <strong>{toSwedish ? card.swedish : vocabulary ? card.dutch : card.dutch[0]}</strong></>}
            </p>}
          </div>
          <button className="next" onClick={advance}>{feedback ? 'Volgende' : 'Overslaan en verder'} <span aria-hidden="true">→</span></button>
        </>}
      </section>

      <aside className="sections">
        <h2>Jouw leerpad</h2>
        <p>{known.length} van 200 gezien · {due} te herhalen</p>
        <nav aria-label="Kies een sectie">
          {Array.from({ length: 10 }, (_, index) => {
            const start = index * SECTION_SIZE
            const count = words.slice(start, start + SECTION_SIZE)
              .filter((_, offset) => progress.words[start + offset]?.first).length
            return <button key={index} disabled={!ready} aria-current={section === index ? 'step' : undefined} onClick={() => chooseSection(index)}>
              <span className="number">{String(index + 1).padStart(2, '0')}</span>
              <span>Woorden {start + 1}–{start + SECTION_SIZE}</span><small>{count}/20</small>
            </button>
          })}
        </nav>
      </aside>
    </div>
    <footer>
      {storageError && <p role="alert">Je browser kon de voortgang niet lokaal opslaan.</p>}
      <p>Voortgang blijft in deze browser. <a href="https://doi.org/10.23695/6act-rs25">Woordenbron: Kelly, Språkbanken</a> (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>).</p>
    </footer>
  </main>
}
