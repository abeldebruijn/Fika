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

function makeCard(progress, section, previous, allowBonus = true) {
  const id = nextWord(progress, section, previous)
  if (!allowBonus || progress.step === 0 || progress.step % 4 !== 0) return wordCard(id, progress.step)
  const number = progress.step / 4 - 1
  const [swedish, dutch, related] = sentences[Math.floor(number / 3) % sentences.length]
  return { id: related, kind: ['toSwedish', 'toDutch', 'speech'][number % 3], swedish, dutch }
}

export default function Home() {
  const [progress, setProgress] = useState(initialProgress)
  const [ready, setReady] = useState(false)
  const [section, setSection] = useState(0)
  const [card, setCard] = useState(() => wordCard(0, 0))
  const [answer, setAnswer] = useState('')
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
      setCard(wordCard(first, data.step))
    }).catch(() => active && setStorageError(true))
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
    update(record(progress, card.id, correct, card.kind === 'word'))
    setFeedback({ correct })
  }

  function show(next, requestedSection = Math.floor(next.id / SECTION_SIZE)) {
    attempt.current++
    if (recorder.current?.state === 'recording') recorder.current.stop()
    setRecording(false)
    setAudioUrl('')
    setAudioMessage('')
    setAnswer('')
    setFeedback(null)
    setSection(requestedSection)
    setCard(next)
    requestAnimationFrame(() => title.current?.focus())
  }

  function advance() {
    const updated = feedback ? progress : record(progress, card.id, false, card.kind === 'word')
    if (!feedback) update(updated)
    const next = makeCard(updated, section, card.id)
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
      <p>200 woorden, verdeeld over 10 secties.</p></div>
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
        <h2 ref={title} tabIndex={-1}>{!ready ? 'Voortgang laden…' : vocabulary ? 'Wat betekent dit woord?' : speech ? 'Zeg deze zin hardop' : 'Vertaal deze zin'}</h2>
        {ready && <>
          <div className="prompt">
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
          {!speech && !vocabulary && <form className="translation" onSubmit={event => { event.preventDefault(); if (answer.trim()) submit(answer) }}>
            <input aria-label="Jouw vertaling" placeholder="Typ je vertaling…" value={answer}
              disabled={!!feedback} onChange={event => setAnswer(event.target.value)} autoComplete="off" />
            {toSwedish && <div className="letters">{['å', 'ä', 'ö'].map(letter => <button type="button" key={letter} disabled={!!feedback}
              onClick={() => setAnswer(answer + letter)}>{letter}</button>)}</div>}
            <button type="submit" disabled={!!feedback || !answer.trim()}>Controleer</button>
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
