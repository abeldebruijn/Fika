'use client'

import { useEffect, useRef, useState } from 'react'
import words from '../words.json'
import { sentences, sentenceOrder } from '../sentences'
import { wordMeaning } from '../glossary'
import { initialProgress, nextWord, record } from '../learning'
import { loadProgress, saveProgress } from '../storage'

function normalize(text) {
  return text.normalize('NFC').toLowerCase().trim().replace(/[.!?,;:]/g, '').replace(/\s+/g, ' ')
}

function canShowMeaning(progress, word, language) {
  const key = `${language}:${word.toLocaleLowerCase(language).replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')}`
  const history = progress.promptWords?.[key]
  return (history?.seen ?? 0) <= 5 || !!history?.wrong
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

  const lessonIds = sentenceOrder.slice(section * 20, section * 20 + 20)
  const sentenceProgress = progress.sentences ?? {}
  const due = lessonIds.filter(id => sentenceProgress[id]?.due <= progress.step)
    .sort((a, b) => sentenceProgress[a].due - sentenceProgress[b].due)
  const shouldReview = due.length > 0 && progress.step % 3 === 0
  const position = progress.lessonPositions?.[section] ?? 0
  const id = shouldReview ? due[0] : lessonIds[position % lessonIds.length]
  const [swedish, dutch] = sentences[id]
  const tiles = kind === 'speech' ? [] : makeTiles(kind === 'toSwedish' ? swedish : dutch[0], kind, progress)
  return { id, kind, swedish, dutch, tiles, review: shouldReview }
}

function recordCard(progress, card, correct) {
  if (card.kind === 'word') return record(progress, card.id, correct)
  const step = progress.step + 1
  const previous = progress.sentences?.[card.id] ?? { seen: 0, streak: 0 }
  const streak = correct ? previous.streak + 1 : 0
  const prompt = card.kind === 'toSwedish' ? card.dutch[0] : card.swedish
  const language = card.kind === 'toSwedish' ? 'nl' : 'sv'
  const promptWords = { ...progress.promptWords }
  if (card.kind !== 'speech') {
    for (const word of prompt.toLocaleLowerCase(language).match(/\p{L}+/gu) ?? []) {
      const key = `${language}:${word}`
      promptWords[key] = { seen: (promptWords[key]?.seen ?? 0) + 1, wrong: !correct }
    }
  }
  return {
    ...progress,
    step,
    lessonPositions: {
      ...progress.lessonPositions,
      [progress.section ?? 0]: (progress.lessonPositions?.[progress.section ?? 0] ?? 0) + (card.review ? 0 : 1),
    },
    promptWords,
    sentences: {
      ...progress.sentences,
      [card.id]: {
        seen: previous.seen + 1,
        streak,
        due: step + (correct ? [0, 8, 24, 72, 144, 288][Math.min(streak, 5)] : 3),
      },
    },
  }
}

export default function Home() {
  const [progress, setProgress] = useState(initialProgress)
  const [ready, setReady] = useState(false)
  const [section, setSection] = useState(0)
  const [card, setCard] = useState(() => wordCard(0, 0))
  const [answer, setAnswer] = useState('')
  const [selectedTiles, setSelectedTiles] = useState([])
  const [feedback, setFeedback] = useState(null)
  const [selectedPromptWord, setSelectedPromptWord] = useState(null)
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
      const requested = Number(new URLSearchParams(window.location.search).get('sectie'))
      const current = Number.isInteger(requested) && requested >= 1 && requested <= 10 ? requested - 1 : data.section ?? 0
      const selected = { ...data, section: current }
      setProgress(selected)
      if (current !== data.section) saveProgress(selected).catch(() => setStorageError(true))
      setSection(current)
      setCard(makeCard(selected, current))
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

  function show(next, requestedSection = section) {
    attempt.current++
    if (recorder.current?.state === 'recording') recorder.current.stop()
    setRecording(false)
    setAudioUrl('')
    setAudioMessage('')
    setAnswer('')
    setSelectedTiles([])
    setFeedback(null)
    setSelectedPromptWord(null)
    setSection(requestedSection)
    setCard(next)
    requestAnimationFrame(() => title.current?.focus())
  }

  function advance() {
    const updated = feedback ? progress : recordCard(progress, card, false)
    if (!feedback) update(updated)
    const next = makeCard(updated, section, card.kind === 'word' ? card.id : undefined)
    show(next, section)
  }

  const vocabulary = card.kind === 'word'
  const speech = card.kind === 'speech'
  const toSwedish = card.kind === 'toSwedish'
  const prompt = toSwedish ? card.dutch[0] : card.swedish
  const promptLanguage = toSwedish ? 'nl' : 'sv'
  const promptParts = prompt.split(/(\s+)/)

  return <main className="lesson-shell">
    <header className="lesson-header">
      <a className="lesson-exit" href="/" aria-label="Terug naar lessen">← <span>Alle lessen</span></a>
      <span className="lesson-mark"><span className="flag" aria-hidden="true" /> fika<span>.</span></span>
      <span className="lesson-position">{String(section + 1).padStart(2, '0')} / 10</span>
    </header>
    <div className="lesson-content">
      <section className="card" aria-label="Oefening">
        <div className="card-top"><span>SECTIE {String(section + 1).padStart(2, '0')}</span>
          <span>{vocabulary ? 'WOORDEN' : speech ? 'SPREKEN' : toSwedish ? 'NL → SV' : 'SV → NL'}</span></div>
        <progress className="lesson-progress" value={progress.step % exerciseCycle.length} max={exerciseCycle.length} aria-label="Voortgang oefenronde" />
        <h2 ref={title} tabIndex={-1}>{!ready ? 'Voortgang laden…' : vocabulary ? 'Wat betekent dit woord?' : speech ? 'Zeg deze zin hardop' : 'Bouw de vertaling'}</h2>
        {ready && <>
          <div className={vocabulary || speech ? "prompt" : "prompt sentence-prompt"}>
            {vocabulary || speech ? <strong lang="sv">{prompt}</strong> :
              <div className="prompt-words" lang={toSwedish ? 'nl' : 'sv'}>
                {promptParts.map((part, index) => /^\s+$/.test(part) ? part :
                  <button type="button" key={index} className="prompt-word"
                    disabled={!canShowMeaning(progress, part, promptLanguage)}
                    aria-label={`Vertaling van ${part}`}
                    aria-expanded={selectedPromptWord === index}
                    onClick={() => setSelectedPromptWord(selectedPromptWord === index ? null : index)}>
                    {part}
                  </button>)}
              </div>}
            {(!toSwedish || feedback) && <button className="sound" onClick={listen} aria-label="Luister naar de Zweedse uitspraak">♫</button>}
          </div>
          {!vocabulary && !speech && selectedPromptWord !== null &&
            <p className="word-gloss" role="status">
              <strong>{promptParts[selectedPromptWord]}</strong>
              <span> → {wordMeaning(promptParts[selectedPromptWord], toSwedish ? 'nl' : 'sv')}</span>
            </p>}
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

    </div>
    {storageError && <p role="alert" className="save-error">Je browser kon de voortgang niet lokaal opslaan.</p>}
  </main>
}
