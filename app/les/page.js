'use client'

import { useEffect, useRef, useState } from 'react'
import words from '../words.json'
import { sentences, sentenceOrder } from '../sentences'
import { sentenceHints } from '../glossary'
import { initialProgress, nextWord, record } from '../learning'
import { loadProgress, saveProgress } from '../storage'

function normalize(text) {
  return text.normalize('NFC').toLowerCase().trim().replace(/[.!?,;:]/g, '').replace(/\s+/g, ' ')
}

function loadSpeech(cache, text, generated) {
  const existing = cache.get(text)
  if (existing) return existing

  const request = generated ? fetch('/api/spraak', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }) : fetch(`/api/spraak?text=${encodeURIComponent(text)}`)
  const pending = request.then(response => {
    if (!response.ok) throw new Error('De uitspraak kon niet worden geladen.')
    return response.arrayBuffer()
  }).catch(error => {
    cache.delete(text)
    throw error
  })
  cache.set(text, pending)
  return pending
}

async function recordingToWav(blob) {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) throw new Error('Deze browser kan de opname niet omzetten naar WAV.')
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer())
    const rate = decoded.sampleRate
    const length = decoded.length
    if (length * 2 + 44 > 2_000_000) throw new Error('De opname is te lang. Neem een kortere zin op.')
    const bytes = new ArrayBuffer(44 + length * 2)
    const view = new DataView(bytes)
    const label = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)) }
    label(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true)
    label(8, 'WAVE'); label(12, 'fmt '); view.setUint32(16, 16, true)
    view.setUint16(20, 1, true); view.setUint16(22, 1, true)
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true)
    view.setUint16(32, 2, true); view.setUint16(34, 16, true)
    label(36, 'data'); view.setUint32(40, length * 2, true)
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i))
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channels.reduce((sum, channel) => sum + channel[i], 0) / channels.length))
      view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true)
    }
    return new Blob([bytes], { type: 'audio/wav' })
  } finally {
    context.close().catch(() => {})
  }
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
const ROUND_LENGTH = exerciseCycle.length

function newRun(section) {
  return { section, answers: [] }
}

function finishRun(progress, card, correct, skipped = false, given = '') {
  const section = progress.section ?? 0
  const previous = progress.activeRun?.section === section && progress.activeRun.answers.length < ROUND_LENGTH
    ? progress.activeRun : newRun(section)
  const answer = {
    id: card.id, kind: card.kind, correct, skipped,
    prompt: card.kind === 'toSwedish' ? card.dutch[0] : card.swedish,
    expected: card.kind === 'word' ? card.dutch : card.kind === 'toDutch' ? card.dutch[0] : card.swedish,
    given,
  }
  const run = { ...previous, answers: [...previous.answers, answer] }
  return { ...progress, activeRun: run, results: run.answers.length === ROUND_LENGTH
    ? { ...progress.results, [section]: run } : progress.results }
}
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
  if (progress.generatedPending) {
    const { id, swedish, dutch } = progress.generatedPending
    return { id, kind: 'toSwedish', swedish, dutch: [dutch], tiles: makeTiles(swedish, 'toSwedish', progress), generated: true }
  }
  const slot = progress.activeRun?.section === section ? progress.activeRun.answers.length % ROUND_LENGTH : 0
  const kind = exerciseCycle[slot]
  if (kind === 'word') return wordCard(nextWord(progress, section, previous), progress.step)

  const lessonIds = sentenceOrder.slice(section * 20, section * 20 + 20)
  const sentenceProgress = progress.sentences ?? {}
  const generated = Object.keys(progress.generatedSentences ?? {})
    .filter(id => progress.generatedSentences[id].section === section)
  const due = [...lessonIds, ...generated].filter(id => sentenceProgress[id]?.due <= progress.step)
    .sort((a, b) => sentenceProgress[a].due - sentenceProgress[b].due)
  const shouldReview = due.length > 0 && progress.step % 3 === 0
  const position = progress.lessonPositions?.[section] ?? 0
  const id = shouldReview ? due[0] : lessonIds[position % lessonIds.length]
  const [swedish, dutch] = typeof id === 'string'
    ? [progress.generatedSentences[id].swedish, [progress.generatedSentences[id].dutch]]
    : sentences[id]
  const tiles = kind === 'speech' ? [] : makeTiles(kind === 'toSwedish' ? swedish : dutch[0], kind, progress)
  return { id, kind, swedish, dutch, tiles, review: shouldReview, generated: typeof id === 'string' }
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
    generatedPending: progress.generatedPending?.id === card.id ? null : progress.generatedPending,
    generatedSentences: card.generated ? {
      ...progress.generatedSentences,
      [card.id]: { section: progress.section ?? 0, swedish: card.swedish, dutch: card.dutch[0] },
    } : progress.generatedSentences,
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
  const [transcribing, setTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [confetti, setConfetti] = useState(false)
  const recorder = useRef(null)
  const recordedBlob = useRef(null)
  const speechCache = useRef(new Map())
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
      const restarting = new URLSearchParams(window.location.search).has('opnieuw')
      if (restarting || selected.activeRun?.section !== current || selected.activeRun.answers.length >= ROUND_LENGTH) {
        selected.activeRun = newRun(current)
      }
      if (restarting) selected.lessonPositions = { ...selected.lessonPositions, [current]: 0 }
      setProgress(selected)
      if (current !== data.section || selected.activeRun !== data.activeRun || restarting) saveProgress(selected).catch(() => setStorageError(true))
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

  useEffect(() => {
    if (ready && !card.generated) {
      loadSpeech(speechCache.current, card.swedish, false).catch(() => {})
    }
  }, [ready, card.swedish, card.generated])

  function update(data) {
    setProgress(data)
    return saveProgress(data).then(() => setStorageError(false)).catch(() => setStorageError(true))
  }

  async function listen() {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) { setAudioMessage('Deze browser ondersteunt audio niet.'); return }
    const current = attempt.current
    try {
      const audio = successAudio.current?.state === 'closed' ? null : successAudio.current
      const context = audio ?? new AudioContext()
      successAudio.current = context
      // Resume on the tap so iPhone Safari allows playback after the network request.
      const resume = context.resume()
      setAudioMessage('Zweedse uitspraak laden…')
      const [bytes] = await Promise.all([
        loadSpeech(speechCache.current, card.swedish, card.generated), resume,
      ])
      if (attempt.current !== current) return
      const decoded = await context.decodeAudioData(bytes.slice(0))
      if (attempt.current !== current) return
      const player = context.createBufferSource()
      player.buffer = decoded
      player.connect(context.destination)
      player.start()
      setAudioMessage('')
    } catch {
      if (attempt.current === current) setAudioMessage('Afspelen lukte niet. Probeer het opnieuw.')
    }
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
          const blob = new Blob(chunks, { type: media.mimeType || chunks[0]?.type || 'audio/mp4' })
          recordedBlob.current = blob
          setAudioUrl(URL.createObjectURL(blob))
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

  async function submitSpeech() {
    if (!recordedBlob.current || transcribing || feedback) return
    const current = attempt.current
    setTranscribing(true)
    setAudioMessage('Je Zweeds wordt herkend…')
    try {
      const blob = await recordingToWav(recordedBlob.current)
      if (attempt.current !== current) return
      const form = new FormData()
      form.append('audio', blob, 'uitspraak.wav')
      const result = await fetch('/api/herken', { method: 'POST', body: form })
      const data = await result.json()
      if (!result.ok) throw new Error(data.error ?? 'Je uitspraak kon niet worden herkend.')
      if (attempt.current !== current) return
      setTranscript(data.text)
      setAudioMessage('')
      const heard = normalize(data.text)
      const expected = normalize(card.swedish)
      const a = Array.from(heard), b = Array.from(expected)
      let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
      for (let i = 1; i <= a.length; i++) {
        const row = [i]
        for (let j = 1; j <= b.length; j++) row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
        previous = row
      }
      submit(previous[b.length] <= Math.max(2, Math.floor(b.length * 0.18)), data.text)
    } catch (error) {
      if (attempt.current === current) setAudioMessage(error.message)
    } finally {
      if (attempt.current === current) setTranscribing(false)
    }
  }

  function submit(value, spoken = '') {
    if (feedback) return
    const expected = card.kind === 'toSwedish' ? [card.swedish] : card.dutch
    const correct = card.kind === 'word' ? value === expected
      : card.kind === 'speech' ? value === true
      : expected.some(option => normalize(option) === normalize(value))
    const streak = correct ? (progress.correctStreak ?? 0) + 1 : 0
    const updated = finishRun({ ...recordCard(progress, card, correct), correctStreak: streak }, card, correct, false,
      card.kind === 'speech' ? spoken : card.kind === 'word' ? value : selectedTiles.map(tile => tile.word).join(' '))
    if (correct) playSuccessTune()
    if (correct && streak % 5 === 0) {
      clearTimeout(confettiTimer.current)
      setConfetti(true)
      confettiTimer.current = setTimeout(() => setConfetti(false), 2400)
    }
    update(updated)
    setFeedback({ correct })
    const next = updated.activeRun.answers.length < ROUND_LENGTH
      ? makeCard(updated, section, card.kind === 'word' ? card.id : undefined)
      : null
    if (next && !next.generated) loadSpeech(speechCache.current, next.swedish, false).catch(() => {})
    autoAdvance.current = setTimeout(() => {
      if (next) show(next, section)
      else window.location.assign(`/resultaat?sectie=${section + 1}`)
    }, 2000)
  }

  function show(next, requestedSection = section) {
    clearTimeout(autoAdvance.current)
    attempt.current++
    if (recorder.current?.state === 'recording') recorder.current.stop()
    setRecording(false)
    setAudioUrl('')
    recordedBlob.current = null
    setTranscript('')
    setTranscribing(false)
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
    const updated = feedback ? progress : finishRun({ ...recordCard(progress, card, false), correctStreak: 0 }, card, false, true)
    if (!feedback) update(updated)
    if (updated.activeRun.answers.length >= ROUND_LENGTH) {
      clearTimeout(autoAdvance.current)
      saveProgress(updated).finally(() => window.location.assign(`/resultaat?sectie=${section + 1}`))
      return
    }
    const next = makeCard(updated, section, card.kind === 'word' ? card.id : undefined)
    show(next, section)
  }

  const vocabulary = card.kind === 'word'
  const speech = card.kind === 'speech'
  const toSwedish = card.kind === 'toSwedish'
  const prompt = toSwedish ? card.dutch[0] : card.swedish
  const promptLanguage = toSwedish ? 'nl' : 'sv'
  const promptParts = prompt.split(/(\s+)/)
  const hints = vocabulary || speech ? {} : sentenceHints(
    promptParts, promptLanguage, normalize(toSwedish ? card.swedish : card.dutch[0]).split(' '),
  )

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
        <progress className="lesson-progress" value={progress.activeRun?.section === section ? progress.activeRun.answers.length : 0} max={ROUND_LENGTH} aria-label="Voortgang oefenronde" />
        <h2 ref={title} tabIndex={-1}>{!ready ? 'Voortgang laden…' : vocabulary ? 'Wat betekent dit woord?' : speech ? 'Zeg deze zin hardop' : 'Bouw de vertaling'}</h2>
        {ready && <>
          <div className={vocabulary || speech ? "prompt" : "prompt sentence-prompt"}>
            {vocabulary || speech ? <strong lang="sv">{prompt}</strong> :
              <div className="prompt-words" lang={toSwedish ? 'nl' : 'sv'}>
                {promptParts.map((part, index) => /^\s+$/.test(part) ? part :
                  <button type="button" key={index} className="prompt-word"
                    disabled={!hints[index] || !canShowMeaning(progress, part, promptLanguage)}
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
              <span> → {hints[selectedPromptWord]}</span>
            </p>}
          {speech && <p className="hint">{card.dutch[0]} Luister, spreek de zin in en controleer wat is herkend.</p>}
          {audioMessage && <p role="status" className="hint">{audioMessage}</p>}
          {vocabulary && <div className="options">
            {card.options.map(option => <button key={option} disabled={!!feedback}
              className={feedback && option === card.dutch ? 'correct' : feedback && option === answer ? 'wrong' : ''}
              onClick={() => { setAnswer(option); submit(option) }}>{option}</button>)}
          </div>}
          {speech && <div className="speech">
            <button onClick={toggleRecording} disabled={transcribing}>{recording ? 'Stop opname' : 'Neem jezelf op'}</button>
            {recording && <div className="mic-meter" role="status" aria-label="Microfoon actief: live geluidsniveau"><span className="mic-dot" /> <canvas ref={meterCanvas} aria-hidden="true" /><span>Microfoon actief</span></div>}
            {audioUrl && <audio controls src={audioUrl} aria-label="Je eigen uitspraak" />}
            {transcript && <p className="recognized">Herkend: <strong lang="sv">{transcript}</strong></p>}
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
          <div className="lesson-actions">
            {feedback && <div className={`feedback ${feedback.correct ? 'success' : 'retry'}`} aria-live="polite" role="status">
              <span>{feedback.correct ? 'Helemaal goed!' : 'Juiste antwoord'}</span>
              <strong lang={toSwedish || speech ? 'sv' : 'nl'}>{toSwedish || speech ? card.swedish : vocabulary ? card.dutch : card.dutch[0]}</strong>
              {!feedback.correct && <small>{speech ? 'Luister en probeer het later opnieuw.' : 'Deze oefening komt later terug.'}</small>}
            </div>}
            <button className="check" type="submit" form={speech || vocabulary ? undefined : 'translation-form'}
              disabled={!!feedback || transcribing || (vocabulary ? true : speech ? !audioUrl || recording : !selectedTiles.length)}
              onClick={speech ? submitSpeech : undefined}>{transcribing ? 'Luisteren…' : 'Controleer'}</button>
            <button className="next" onClick={advance}>{feedback ? 'Volgende' : 'Overslaan'} <span aria-hidden="true">→</span></button>
          </div>
        </>}
      </section>

    </div>
    {storageError && <p role="alert" className="save-error">Je browser kon de voortgang niet lokaal opslaan.</p>}
    {confetti && <div className="confetti-layer" aria-hidden="true">{Array.from({ length: 32 }, (_, i) => <i key={i} style={{ '--x': `${(i * 37 + 17) % 100}%`, '--drift': `${(i % 2 ? 1 : -1) * (20 + i * 4)}px`, '--delay': `${(i % 7) * 0.055}s`, '--color': ['#edbf4a', '#2e9eb0', '#ef7891', '#89b774'][i % 4] }} />)}</div>}
  </main>
}
