'use client'

import { useEffect, useMemo, useState } from 'react'
import { eyeOfCourageProgram } from '@/content/eye-of-courage/program'
import { beliefAreas, focusQuestions, fourPowers, fourSteps, reactionQuestions } from './eye-of-courage-workshop-data'

const KEY = 'eye-of-courage-workbook-v1'
type Answers = Record<string, string>
type Checks = Record<string, string[]>
type Saved = { answers: Answers; checks: Checks }
const emptySaved: Saved = { answers: {}, checks: {} }

function Field({ id, label, value, onChange, rows = 3 }: { id: string; label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return <label className="eoc-field"><span>{label}</span><textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /></label>
}

function Head({ n, eyebrow, title, copy }: { n: number; eyebrow: string; title: string; copy: string }) {
  return <div className="eoc-workshop-section-head"><div className="eoc-step-number">{n}</div><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p className="lead">{copy}</p></div></div>
}

export default function EyeOfCourageWorkshop() {
  const [data, setData] = useState<Saved>(emptySaved)
  const [ready, setReady] = useState(false)
  const [savedAt, setSavedAt] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setData({ ...emptySaved, ...JSON.parse(raw) }) } catch {}
    setReady(true)
  }, [])
  useEffect(() => {
    if (!ready) return
    const t = window.setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(data)); setSavedAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) } catch {}
    }, 250)
    return () => clearTimeout(t)
  }, [data, ready])

  const count = useMemo(() => Object.values(data.answers).filter(v => v.trim()).length + Object.values(data.checks).reduce((n, a) => n + a.length, 0), [data])
  const set = (id: string, value: string) => setData(d => ({ ...d, answers: { ...d.answers, [id]: value } }))
  const check = (area: string, value: string) => setData(d => {
    const old = d.checks[area] ?? []
    const next = old.includes(value) ? old.filter(x => x !== value) : [...old, value]
    return { ...d, checks: { ...d.checks, [area]: next } }
  })

  function clearAll() {
    if (!confirm('Clear every answer saved in this browser for The Eye of Courage workbook?')) return
    setData(emptySaved); try { localStorage.removeItem(KEY) } catch {}; setSavedAt('')
  }

  async function downloadAnswers() {
    setExporting(true)
    try {
      const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx')
      const rows: InstanceType<typeof Paragraph>[] = []
      rows.push(new Paragraph({ text: 'The Eye of Courage', heading: HeadingLevel.TITLE }))
      rows.push(new Paragraph({ text: 'Blindspots & Leadership · My Workshop Reflections' }))
      rows.push(new Paragraph({ text: 'Guadalajara · Casa Tartuk · September 11–12, 2026' }))
      const add = (q: string, a: string) => { rows.push(new Paragraph({ children: [new TextRun({ text: q, bold: true })] })); rows.push(new Paragraph({ text: a.trim() || 'Not answered', spacing: { after: 160 } })) }
      const section = (t: string) => rows.push(new Paragraph({ text: t, heading: HeadingLevel.HEADING_1 }))
      section('Safety before change')
      ;[['safety-comfort','What helps me feel comfortable enough to look honestly at myself?'],['safety-defensive','How do I know I am becoming defensive, afraid, shut down, or overwhelmed?'],['safety-slow','What helps me slow down instead of reacting automatically?'],['safety-support','Who or what can support me if this work becomes too intense?']].forEach(([id,q]) => add(q, data.answers[id] ?? ''))
      section('The script becomes automatic'); add('Where do I already see a loop like this?', data.answers['loop-example'] ?? ''); add('A sentence that repeats in my mind:', data.answers['loop-sentence'] ?? '')
      section('Five reactions that reveal the script'); reactionQuestions.forEach((q,i) => add(q, data.answers[`reaction-${i}`] ?? ''))
      section('Five areas of limiting beliefs'); Object.keys(beliefAreas).forEach(area => { add(`${area}: beliefs I checked`, (data.checks[area] ?? []).map(x => `• ${x}`).join('\n')); add(`${area}: my own belief`, data.answers[`own-${area}`] ?? '') })
      section('Choose one'); add('My area', data.answers['focus-area'] ?? ''); focusQuestions.forEach((q,i) => add(q, data.answers[`focus-${i}`] ?? ''))
      section('Seven-day practice'); for (let day=1;day<=7;day++) { rows.push(new Paragraph({ text: `Day ${day}`, heading: HeadingLevel.HEADING_2 })); ['Trigger / exact thought','Body signal','What I did next','Different action'].forEach((q,i) => add(q, data.answers[`day-${day}-${i}`] ?? '')) }
      section('Four Powers'); fourPowers.forEach(([name,q],i) => add(`${name}: ${q}`, data.answers[`power-${i}`] ?? ''))
      section('Four Steps'); fourSteps.forEach(([name,q],i) => add(`${name}: ${q}`, data.answers[`step-${i}`] ?? ''))
      section('Rejoice and lead'); [['rejoice-good','What goodness did I notice?'],['rejoice-why','Why do I want more of it?'],['rejoice-me','What does it say about me?'],['rejoice-how','How will I rejoice?'],['lead-others','What becomes possible for other people when I stop reinforcing this pattern?'],['lead-uplift','Who can I raise, support, or uplift this week?'],['lead-action','What would one simple leadership action look like?'],['lead-impact','What impact would I want to rejoice in at the end of my life?'],['commit-belief','The belief I will watch'],['commit-action','The different action I will practice'],['commit-good','The goodness I will deliberately rejoice in']].forEach(([id,q]) => add(q, data.answers[id] ?? ''))
      const docx = new Document({ sections: [{ children: rows }] })
      const blob = await Packer.toBlob(docx); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'The_Eye_of_Courage_My_Workbook_Answers.docx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally { setExporting(false) }
  }

  return <div className="eoc-workshop">
    <section className="eoc-workshop-intro card cream"><div><div className="eyebrow">Interactive workbook</div><h2>Notice. Check. Choose one. Practice.</h2><p>This is a participant tool built from the two classes, not a summary. Use it to notice one automatic belief, interrupt the old loop, and practice a different response long enough to create new evidence.</p></div><div className="eoc-workbook-rule"><strong>One rule for this workbook</strong><span>Choose one pattern. A small amount of discipline applied to one pattern is more useful than trying to change everything at once.</span></div></section>
    <div className="eoc-workshop-toolbar"><div className="eoc-local-status"><strong>Your reflections stay with you.</strong><span>Your answers are saved only in this browser on this device. They are not uploaded to V Houses or your student account. Clearing browser data, using private browsing, or switching browser or device may make them unavailable.</span><small>{savedAt ? `Saved locally at ${savedAt}` : ready ? 'Ready to save locally' : 'Loading saved answers…'}</small></div><div className="actions">{eyeOfCourageProgram.workbookPdfPath ? <><a className="button" href={eyeOfCourageProgram.workbookPdfPath} target="_blank" rel="noreferrer">View PDF</a><a className="button" href={eyeOfCourageProgram.workbookPdfPath} download>Download PDF</a></> : <span className="pill">Printable PDF will be added here</span>}<button className="button sage" onClick={downloadAnswers} disabled={exporting}>{exporting ? 'Preparing DOCX…' : 'Download my answers'}</button><button className="button" onClick={clearAll}>Clear saved answers</button></div><div className="meta">{count ? `${count} saved response${count === 1 ? '' : 's'} / selections` : 'No responses yet'}</div></div>
    <nav className="eoc-step-nav">{[['1','Safety','safety'],['2','Spot the loop','loop'],['3','Reaction check','reactions'],['4','Five areas','areas'],['5','Choose one','choose-one'],['6','7-day practice','seven-days'],['7','Interrupt + replace','repair'],['8','Rejoice + lead','leadership']].map(([n,l,id]) => <a key={id} href={`#${id}`}><span>{n}</span>{l}</a>)}</nav>

    <section className="eoc-workshop-section" id="safety"><Head n={1} eyebrow="Before you begin" title="Safety before change" copy="When fear, worry, or anxiety takes over, old patterns reassert themselves. The goal is not to force insight. It is to become safe enough to see clearly and choose."/><div className="eoc-fields-grid">{[['safety-comfort','What helps me feel comfortable enough to look honestly at myself?'],['safety-defensive','How do I know I am becoming defensive, afraid, shut down, or overwhelmed?'],['safety-slow','What helps me slow down instead of reacting automatically?'],['safety-support','Who or what can support me if this work becomes too intense?']].map(([id,q]) => <Field key={id} id={id} label={q} value={data.answers[id] ?? ''} onChange={v => set(id,v)}/>)}</div><div className="info-callout"><strong>Keep it workable</strong><br/>If you need to understand or process a story more deeply, the class explicitly makes room for therapy. The workbook itself is for awareness, choice, and practice.</div></section>

    <section className="eoc-workshop-section" id="loop"><Head n={2} eyebrow="The blindspot" title="The script becomes automatic" copy="Beliefs can become so deep that they are not merely ideas you hold. They become the way you show up, shaping what you notice, how you react, and what you do next."/><div className="eoc-loop">{[['Show up','Who am I in this moment?'],['Story','What is automatically true?'],['Reaction','What fires in me?'],['Action','What do I do next?'],['Reinforce','What does that action help prove?']].map(([a,b]) => <div key={a}><strong>{a}</strong><span>{b}</span></div>)}</div><div className="eoc-fields-grid"><Field id="loop-example" label="Where do I already see a loop like this?" value={data.answers['loop-example'] ?? ''} onChange={v => set('loop-example',v)}/><Field id="loop-sentence" label="A sentence that repeats in my mind:" value={data.answers['loop-sentence'] ?? ''} onChange={v => set('loop-sentence',v)}/></div></section>

    <section className="eoc-workshop-section" id="reactions"><Head n={3} eyebrow="Reaction survey" title="Five reactions that reveal the script" copy="Answer quickly and honestly. Positive reactions can show where there may be less work. Negative or charged reactions are clues. Do not make a good answer."/><div className="eoc-numbered-fields">{reactionQuestions.map((q,i) => <div className="eoc-numbered-field" key={q}><span>{i+1}</span><Field id={`reaction-${i}`} label={q} value={data.answers[`reaction-${i}`] ?? ''} onChange={v => set(`reaction-${i}`,v)}/></div>)}</div></section>

    <section className="eoc-workshop-section" id="areas"><Head n={4} eyebrow="Check what feels familiar" title="Explore the five areas" copy="These are beliefs to notice, not statements to adopt. Check what feels familiar, then add your own belief if the list does not quite name it."/><div className="eoc-area-list">{Object.entries(beliefAreas).map(([area, beliefs]) => <details className="eoc-area-card" key={area}><summary><span>{area}</span><small>{(data.checks[area]?.length ?? 0) + (data.answers[`own-${area}`]?.trim() ? 1 : 0) || 'Open'}</small></summary><div className="eoc-area-body"><div className="eoc-belief-list">{beliefs.map(b => <label className="eoc-belief" key={b}><input type="checkbox" checked={(data.checks[area] ?? []).includes(b)} onChange={() => check(area,b)}/><span>{b}</span></label>)}</div><Field id={`own-${area}`} label={`My own ${area.toLowerCase()} belief`} value={data.answers[`own-${area}`] ?? ''} onChange={v => set(`own-${area}`,v)}/></div></details>)}</div></section>

    <section className="eoc-workshop-section" id="choose-one"><Head n={5} eyebrow="Focus" title="Choose one. Not ten. One." copy="Choose the area that created the strongest useful reaction. Then choose one belief inside it. If you cannot choose, use the belief that appears the next time you get upset."/><div className="eoc-area-choice">{Object.keys(beliefAreas).map(area => <label className={data.answers['focus-area'] === area ? 'selected' : ''} key={area}><input type="radio" name="focus-area" checked={data.answers['focus-area'] === area} onChange={() => set('focus-area',area)}/><span>{area}</span></label>)}</div><div className="eoc-fields-stack">{focusQuestions.map((q,i) => <Field key={q} id={`focus-${i}`} label={q} value={data.answers[`focus-${i}`] ?? ''} onChange={v => set(`focus-${i}`,v)}/>)}</div></section>

    <section className="eoc-workshop-section" id="seven-days"><Head n={6} eyebrow="Seven-day practice" title="Shine a light without feeding the story" copy="For one week, simply notice. When the old script appears, name it, notice the body signal, and watch what you choose next. Then try one different response."/><div className="eoc-day-list">{Array.from({length:7},(_,x)=>x+1).map(day => <details className="eoc-day-card" key={day} open={day===1}><summary><strong>Day {day}</strong><span>{[0,1,2,3].some(i => data.answers[`day-${day}-${i}`]?.trim()) ? 'Started' : 'Not started'}</span></summary><div className="eoc-day-fields">{['Trigger / exact thought','Body signal','What I did next','Different action'].map((q,i) => <Field key={q} id={`day-${day}-${i}`} label={q} rows={2} value={data.answers[`day-${day}-${i}`] ?? ''} onChange={v => set(`day-${day}-${i}`,v)}/>)}</div></details>)}</div></section>

    <section className="eoc-workshop-section" id="repair"><Head n={7} eyebrow="Interrupt + replace" title="Repair quickly, then create a different future" copy="When the pattern appears, use a fast repair rather than feeding shame or replaying the story. Once you can see the old loop, plant deliberately."/><div className="eoc-practice-columns"><div className="card"><div className="eyebrow">The four powers</div><h3>Repair quickly</h3>{fourPowers.map(([name,q],i) => <Field key={name} id={`power-${i}`} label={`${i+1}. ${name} · ${q}`} value={data.answers[`power-${i}`] ?? ''} onChange={v => set(`power-${i}`,v)}/>)}</div><div className="card cream"><div className="eyebrow">The four steps</div><h3>Create a different future</h3>{fourSteps.map(([name,q],i) => <Field key={name} id={`step-${i}`} label={`${i+1}. ${name} · ${q}`} value={data.answers[`step-${i}`] ?? ''} onChange={v => set(`step-${i}`,v)}/>)}</div></div></section>

    <section className="eoc-workshop-section" id="leadership"><Head n={8} eyebrow="Rejoicing + automatic leadership" title="Own the seed you want to become" copy="Rejoicing is more than feeling good. It is paying attention to goodness, celebrating it because you want more of it in your world, and recognizing that the goodness you perceive is connected to the person you are becoming."/><div className="eoc-fields-grid">{[['rejoice-good','What kindness, courage, generosity, patience, repair, or growth did I notice?'],['rejoice-why','Why does this belong in the world I want to live in?'],['rejoice-me','If I can perceive this goodness, what causes might I already carry?'],['rejoice-how','How will I deliberately call it out, celebrate it, or remember it tonight?']].map(([id,q]) => <Field key={id} id={id} label={q} value={data.answers[id] ?? ''} onChange={v => set(id,v)}/>)}</div><div className="eoc-leadership-block card"><div className="eyebrow">Automatic leadership</div><h3>What becomes possible when the pattern weakens?</h3><div className="eoc-fields-grid">{[['lead-others','What becomes possible for other people when I stop reinforcing this pattern?'],['lead-uplift','Who can I raise, support, or uplift this week?'],['lead-action','What would one simple leadership action look like if I were not protecting the old story?'],['lead-impact','What impact would I want to be able to rejoice in at the end of my life?']].map(([id,q]) => <Field key={id} id={id} label={q} value={data.answers[id] ?? ''} onChange={v => set(id,v)}/>)}</div></div><div className="eoc-commitment"><div className="eyebrow">My one-week commitment</div><h3>Keep it small enough to complete.</h3>{[['commit-belief','The belief I will watch'],['commit-action','The different action I will practice'],['commit-good','The goodness I will deliberately rejoice in']].map(([id,q]) => <Field key={id} id={id} label={q} rows={2} value={data.answers[id] ?? ''} onChange={v => set(id,v)}/>)}</div></section>
    <div className="eoc-workshop-finish card sage"><div><div className="eyebrow">Keep your work</div><h2>Download a copy before you leave.</h2><p>Your browser copy stays on this device. A DOCX export gives you a portable copy of everything you wrote.</p></div><div className="actions"><button className="button sage" onClick={downloadAnswers} disabled={exporting}>{exporting ? 'Preparing DOCX…' : 'Download my answers'}</button><a className="button" href="#safety">Return to the beginning</a></div></div>
  </div>
}
