'use client'

import { useEffect, useState } from 'react'
import words from './words.json'
import { dateKey, dueWords, initialProgress, SECTION_SIZE } from './learning'
import { loadProgress, saveProgress } from './storage'

export default function Overview() {
  const [progress, setProgress] = useState(initialProgress)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadProgress().then(saved => setProgress(saved ?? initialProgress))
      .catch(() => setError(true)).finally(() => setReady(true))
  }, [])

  function changeGoal(goal) {
    const updated = { ...progress, goal }
    setProgress(updated)
    saveProgress(updated).catch(() => setError(true))
  }

  const learned = Object.values(progress.words).filter(word => word.first)
  const daily = learned.filter(word => word.first === dateKey()).length
  const due = dueWords(progress).length
  const current = progress.section ?? 0

  return <main className="overview-shell">
    <header className="header">
      <a className="brand" href="/"><span className="flag" aria-hidden="true" /> fika<span>.</span></a>
      <a className="header-note" href="/instellingen">Instellingen</a>
    </header>
    <section className="overview-intro">
      <p className="eyebrow">JOUW ZWEEDSE REIS BEGINT HIER</p>
      <h1>En liten stund<br /><em>svenska.</em></h1>
      <p>Elke dag een paar woorden. Steeds meer zinnen die je in Zweden echt kunt gebruiken.</p>
      <a className="start-lesson" href={`/les?sectie=${current + 1}`}>Verder oefenen <span aria-hidden="true">↗</span></a>
      <span className="overview-index">200 ZINNEN · 10 SECTIES</span>
    </section>
    <section className="overview-stats" aria-label="Jouw voortgang">
      <div><small>VANDAAG</small><strong>{daily}<span> / {progress.goal}</span></strong><span>nieuwe woorden</span></div>
      <div><small>GEZIEN</small><strong>{learned.length}<span> / 200</span></strong><span>woorden</span></div>
      <div><small>HERHALEN</small><strong>{due}</strong><span>woorden klaar</span></div>
      <div className="goal-setting"><label htmlFor="goal">Dagdoel aanpassen</label><select id="goal" value={progress.goal} disabled={!ready} onChange={event => changeGoal(Number(event.target.value))}>{[3,5,10,15,20].map(goal => <option key={goal} value={goal}>{goal} woorden</option>)}</select></div>
    </section>
    <section className="overview-lessons">
      <div className="overview-heading"><div><p className="eyebrow">OP JOUW TEMPO</p><h2>Alle lessen</h2></div><span>01 — 10</span></div>
      <div className="lesson-list">{Array.from({ length: 10 }, (_, index) => {
        const start = index * SECTION_SIZE
        const count = words.slice(start, start + SECTION_SIZE).filter((_, offset) => progress.words[start + offset]?.first).length
        return <a key={index} href={`/les?sectie=${index + 1}`} className="lesson-row">
          <span className="lesson-row-number">{String(index + 1).padStart(2,'0')}</span>
          <span className="lesson-row-title">{['Aankomen','Onderweg','In het café','Eten bestellen','In het hotel','De stad in','Winkelen','Een praatje','Praktische vragen','Zelfstandig op reis'][index]}<small>Woorden {start + 1}–{start + 20}</small></span>
          <span className="lesson-row-count">{count} / 20</span><span className="lesson-row-arrow" aria-hidden="true">↗</span>
        </a>
      })}</div>
    </section>
    {error && <p role="alert">Je browser kon de voortgang niet lokaal laden of opslaan.</p>}
    <footer>Voortgang blijft in deze browser. <a href="https://doi.org/10.23695/6act-rs25">Woordenbron: Kelly, Språkbanken</a>.</footer>
  </main>
}
