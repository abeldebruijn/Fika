'use client'

import { useEffect, useState } from 'react'
import { sentenceOrder } from '../sentences'
import { loadProgress } from '../storage'

const SECTION_SIZE = 20

export default function ResultPage() {
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(false)
  const [section, setSection] = useState(0)

  useEffect(() => {
    const requested = Number(new URLSearchParams(window.location.search).get('sectie'))
    const current = Number.isInteger(requested) && requested >= 1 && requested <= 10 ? requested - 1 : 0
    setSection(current)
    loadProgress().then(saved => setProgress(saved ?? {})).catch(() => setError(true))
  }, [])

  const result = progress?.results?.[section]
  const answers = result?.answers ?? []
  const correct = answers.filter(item => item.correct).length
  const mistakes = answers.filter(item => !item.correct)
  const lessonIds = sentenceOrder.slice(section * SECTION_SIZE, (section + 1) * SECTION_SIZE)
  const lessonSet = new Set(lessonIds)
  const roundSeen = new Set(answers.filter(item => item.kind !== 'word' && lessonSet.has(item.id)).map(item => item.id)).size
  const everSeen = lessonIds.filter(id => progress?.sentences?.[id]?.seen > 0).length
  const percent = count => Math.round(count / SECTION_SIZE * 100)

  return <main className="result-shell">
    <header className="lesson-header">
      <a className="lesson-exit" href="/" aria-label="Terug naar lessen">← <span>Alle lessen</span></a>
      <span className="lesson-mark"><span className="flag" aria-hidden="true" /> fika<span>.</span></span>
      <span className="lesson-position">{String(section + 1).padStart(2, '0')} / 10</span>
    </header>
    {error ? <p role="alert">Je resultaten konden niet uit de browser worden geladen.</p> : !progress ?
      <p>Resultaten laden…</p> : !result ?
      <section className="result-card"><h1>Nog geen afgeronde ronde</h1><a className="result-primary" href={`/les?sectie=${section + 1}`}>Begin deze les →</a></section> :
      <section className="result-card">
        <p className="eyebrow">SECTIE {String(section + 1).padStart(2, '0')} · RONDE AFGEROND</p>
        <h1>Goed geoefend!</h1>
        <p className="result-lead">Je hebt {correct} van de {answers.length} oefeningen goed gedaan.</p>
        <div className="result-score" aria-label="Score van deze ronde"><strong>{Math.round(correct / answers.length * 100)}%</strong><span>{correct} goed · {mistakes.length} gemist</span></div>
        <div className="result-coverage">
          <div><span>Zinnen deze ronde</span><strong>{percent(roundSeen)}%</strong><small>{roundSeen} van 20 unieke zinnen</small><progress value={roundSeen} max={SECTION_SIZE} /></div>
          <div><span>Zinnen ooit gezien</span><strong>{percent(everSeen)}%</strong><small>{everSeen} van 20 unieke zinnen</small><progress value={everSeen} max={SECTION_SIZE} /></div>
        </div>
        <div className="result-mistakes">
          <h2>{mistakes.length ? 'Deze kun je nog oefenen' : 'Alles goed gedaan!'}</h2>
          {mistakes.length ? <ul>{mistakes.map((item, index) => <li key={index}>
            <span>{item.kind === 'word' ? 'Woord' : item.kind === 'speech' ? 'Uitspraak' : item.kind === 'toSwedish' ? 'NL → SV' : 'SV → NL'}{item.skipped ? ' · overgeslagen' : ''}</span>
            <p>{item.prompt}</p>
            <strong>{item.expected}</strong>
            {!item.skipped && item.given && <small>Jouw antwoord: {item.given}</small>}
          </li>)}</ul> : <p>Je hebt in deze ronde geen fouten gemaakt.</p>}
        </div>
        <div className="result-actions">
          <a className="result-primary" href={`/les?sectie=${section + 1}&opnieuw=1`}>Nogmaals proberen →</a>
          <a className="result-secondary" href="/">Alle lessen</a>
        </div>
      </section>}
  </main>
}
