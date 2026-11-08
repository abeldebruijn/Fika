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
  const [confetti, setConfetti] = useState(false)
  const recorder = useRef(null)
  const meterCanvas = useRef(null)
  const meter = useRef(null)
  const successAudio = useRef(null)
  const confettiTimer = useRef(null)
  const attempt = useRef(0)
  const title = useRef(null)
  const autoAdvance = useRef(null)

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
    clearTimeout(autoAdvance.current)
    clearTimeout(confettiTimer.current)
    stopMeter()
    if (recorder.current?.state === 'recording') recorder.current.stop()
    successAudio.current?.close().catch(() => {})
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

  function playSuccessTune() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      const context = successAudio.current?.state === 'closed' ? null : successAudio.current
      const audio = context ?? new AudioContext()
      successAudio.current = audio
      // Start while the answer button's user gesture is still active on iOS Safari.
      audio.resume().catch(() => {})
      const start = audio.currentTime + 0.02
      const notes = [
        [523.25, 0, 0.22], [659.25, 0.23, 0.22], [783.99, 0.47, 0.24],
        [1046.5, 0.75, 0.31], [783.99, 1.12, 0.33],
      ]
      for (const [frequency, offset, duration] of notes) {
        const oscillator = audio.createOscillator()
        const volume = audio.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.value = frequency
        volume.gain.setValueAtTime(0.0001, start + offset)
        volume.gain.exponentialRampToValueAtTime(0.09, start + offset + 0.025)
        volume.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration)
        oscillator.connect(volume).connect(audio.destination)
        oscillator.start(start + offset)
        oscillator.stop(start + offset + duration)
      }
    } catch {
      // Audio is optional; checking an answer must still work if sound is blocked.
    }
  }

  function stopMeter() {
    const current = meter.current
    if (!current) return
    meter.current = null
    cancelAnimationFrame(current.frame)
    current.source.disconnect()
    current.context.close().catch(() => {})
  }

  function startMeter(stream) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      const samples = new Uint8Array(analyser.fftSize)
      const current = { context, source, frame: 0 }
      meter.current = current
      function draw() {
        if (meter.current !== current) return
        const canvas = meterCanvas.current
        if (canvas) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          const width = canvas.clientWidth
          const height = canvas.clientHeight
          if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
            canvas.width = Math.round(width * dpr)
            canvas.height = Math.round(height * dpr)
          }
          const brush = canvas.getContext('2d')
          if (brush) {
            brush.setTransform(dpr, 0, 0, dpr, 0, 0)
            brush.clearRect(0, 0, width, height)
            analyser.getByteTimeDomainData(samples)
            brush.fillStyle = '#1c6672'
            const count = 32
            const gap = 3
            const bar = (width - gap * (count - 1)) / count
            for (let i = 0; i < count; i++) {
              let peak = 0
              const from = Math.floor(i * samples.length / count)
              const to = Math.floor((i + 1) * samples.length / count)
              for (let j = from; j < to; j++) peak = Math.max(peak, Math.abs(samples[j] - 128) / 128)
              const size = Math.max(3, Math.min(height - 4, peak * height * 3.2))
              brush.fillRect(i * (bar + gap), (height - size) / 2, bar, size)
            }
          }
        }
        current.frame = requestAnimationFrame(draw)
      }
      context.resume().catch(() => {})
      current.frame = requestAnimationFrame(draw)
    } catch {
      stopMeter()
    }
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
          stopMeter()
          stream.getTracks().forEach(track => track.stop())
          if (attempt.current !== current) return
          setRecording(false)
          setAudioUrl(URL.createObjectURL(new Blob(chunks, { type: media.mimeType })))
        }
        media.start()
        setRecording(true)
        startMeter(stream)
      } catch (error) {
        stopMeter()
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
    const streak = correct ? (progress.correctStreak ?? 0) + 1 : 0
    const updated = { ...recordCard(progress, card, correct), correctStreak: streak }
    if (correct) playSuccessTune()
    if (correct && streak % 5 === 0) {
      clearTimeout(confettiTimer.current)
      setConfetti(true)
      confettiTimer.current = setTimeout(() => setConfetti(false), 2400)
    }
    update(updated)
    setFeedback({ correct })
    autoAdvance.current = setTimeout(() => {
      const next = makeCard(updated, section, card.kind === 'word' ? card.id : undefined)
      show(next, section)
    }, 2000)
  }

  function show(next, requestedSection = section) {
    clearTimeout(autoAdvance.current)
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
    const updated = feedback ? progress : { ...recordCard(progress, card, false), correctStreak: 0 }
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
            {recording && <div className="mic-meter" role="status" aria-label="Microfoon actief: live geluidsniveau"><span className="mic-dot" /> <canvas ref={meterCanvas} aria-hidden="true" /><span>Microfoon actief</span></div>}
            {audioUrl && <audio controls src={audioUrl} aria-label="Je eigen uitspraak" />}
          </div>}
          {!speech && !vocabulary && <form id="translation-form" className="translation" onSubmit={event => {
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
          </form>}
          <div className="feedback" aria-live="polite">
            {feedback && <p className={feedback.correct ? 'success' : 'retry'}>
              {speech ? 'Goed geoefend.' : feedback.correct ? 'Helemaal goed!' : vocabulary ? 'Dit woord komt later terug.' : 'Bijna. Dit is een voorbeeldantwoord.'}
              {!speech && <> <strong>{toSwedish ? card.swedish : vocabulary ? card.dutch : card.dutch[0]}</strong></>}
            </p>}
          </div>
          <div className="lesson-actions">
            <button className="check" type="submit" form={speech || vocabulary ? undefined : 'translation-form'}
              disabled={!!feedback || (vocabulary ? true : !speech && !selectedTiles.length)}
              onClick={speech ? () => submit(true) : undefined}>Controleer</button>
            <button className="next" onClick={advance}>{feedback ? 'Volgende' : 'Overslaan'} <span aria-hidden="true">→</span></button>
          </div>
        </>}
      </section>

    </div>
    {storageError && <p role="alert" className="save-error">Je browser kon de voortgang niet lokaal opslaan.</p>}
    {confetti && <div className="confetti-layer" aria-hidden="true">{Array.from({ length: 32 }, (_, i) => <i key={i} style={{ '--x': `${(i * 37 + 17) % 100}%`, '--drift': `${(i % 2 ? 1 : -1) * (20 + i * 4)}px`, '--delay': `${(i % 7) * 0.055}s`, '--color': ['#edbf4a', '#2e9eb0', '#ef7891', '#89b774'][i % 4] }} />)}</div>}
  </main>
}
