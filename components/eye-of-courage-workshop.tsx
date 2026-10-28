'use client'

import { useEffect, useMemo, useState } from 'react'
import { eyeOfCourageProgram } from '@/content/eye-of-courage/program'
import { assumptionScenarios, beliefAreas, fourPowers, fourSteps } from './eye-of-courage-workshop-data'

const KEY = 'eye-of-courage-workbook-v1'
type Answers = Record<string, string>
type Checks = Record<string, string[]>
type Saved = { answers: Answers; checks: Checks }
const emptySaved: Saved = { answers: {}, checks: {} }

function Field({ id, label, value, onChange, rows = 3, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return <label className="eoc-field"><span>{label}</span><textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>
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

  const count = useMemo(() => {
    const activeIds = [
      ...assumptionScenarios.flatMap(scenario => scenario.prompts.map(prompt => prompt.id)),
      ...Object.keys(beliefAreas).map(area => 'own-' + area),
      ...fourPowers.map((_, i) => 'power-' + i),
      ...fourSteps.map((_, i) => 'step-' + i),
    ]
    const answers = activeIds.filter(id => data.answers[id]?.trim()).length
    const selections = Object.keys(beliefAreas).reduce((n, area) => n + (data.checks[area]?.length ?? 0), 0)
    return answers + selections
  }, [data])
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
      section('1. Automatic assumptions')
      assumptionScenarios.forEach((scenario, i) => {
        rows.push(new Paragraph({ text: String(i + 1) + '. ' + scenario.title, heading: HeadingLevel.HEADING_2 }))
        scenario.prompts.forEach(prompt => add(prompt.text, data.answers[prompt.id] ?? ''))
      })
      section('2. Explore the five areas')
      Object.keys(beliefAreas).forEach(area => {
        add(area + ': beliefs I checked', (data.checks[area] ?? []).map(x => '• ' + x).join('\n'))
        add(area + ': my own belief', data.answers['own-' + area] ?? '')
      })
      section('3. Interrupt + replace')
      rows.push(new Paragraph({ text: 'The Four Powers', heading: HeadingLevel.HEADING_2 }))
      fourPowers.forEach(([name, q], i) => add(name + ': ' + q, data.answers['power-' + i] ?? ''))
      rows.push(new Paragraph({ text: 'The Four Steps', heading: HeadingLevel.HEADING_2 }))
      fourSteps.forEach(([name, q], i) => add(name + ': ' + q, data.answers['step-' + i] ?? ''))
      const docx = new Document({ sections: [{ children: rows }] })
      const blob = await Packer.toBlob(docx); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'The_Eye_of_Courage_My_Workbook_Answers.docx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally { setExporting(false) }
  }

  return <div className="eoc-workshop">
    <section className="eoc-workshop-intro card cream"><div><div className="eyebrow">Interactive workbook</div><h2>Notice what comes up.</h2><p>Begin with five everyday situations from Class 2, explore the five areas of limiting beliefs, then use the Four Powers and Four Steps to practice a different response.</p></div><div className="eoc-workbook-rule"><strong>How to begin</strong><span>Finish each sentence with your first honest reaction. There are no right answers, and you do not have to make your answer sound better.</span></div></section>
    <div className="eoc-workshop-toolbar"><div className="eoc-local-status"><strong>Your reflections stay with you.</strong><span>Your answers are saved only in this browser on this device. They are not uploaded to V Houses or your student account. Clearing browser data, using private browsing, or switching browser or device may make them unavailable.</span><small>{savedAt ? `Saved locally at ${savedAt}` : ready ? 'Ready to save locally' : 'Loading saved answers…'}</small></div><div className="actions">{eyeOfCourageProgram.workbookPdfPath ? <><a className="button" href={eyeOfCourageProgram.workbookPdfPath} target="_blank" rel="noreferrer">View PDF</a><a className="button" href={eyeOfCourageProgram.workbookPdfPath} download>Download PDF</a></> : <span className="pill">Printable PDF will be added here</span>}<button className="button sage" onClick={downloadAnswers} disabled={exporting}>{exporting ? 'Preparing DOCX…' : 'Download my answers'}</button><button className="button" onClick={clearAll}>Clear saved answers</button></div><div className="meta">{count ? `${count} saved response${count === 1 ? '' : 's'} / selections` : 'No responses yet'}</div></div>

    <section className="eoc-workshop-section" id="assumptions">
      <Head n={1} eyebrow="First impressions" title="What do I automatically assume?" copy="Complete each unfinished sentence. Notice the thought that appears before you correct or explain it." />
      <div className="eoc-assumption-list">
        {assumptionScenarios.map((scenario, i) => (
          <article className="eoc-assumption-card" key={scenario.title}>
            <div className="eoc-assumption-heading"><span className="eoc-assumption-index">{i + 1}</span><h3>{scenario.title}</h3></div>
            <div className="eoc-assumption-prompts">
              {scenario.prompts.map(prompt => <Field key={prompt.id} id={prompt.id} label={prompt.text} rows={2} placeholder="Finish the sentence…" value={data.answers[prompt.id] ?? ''} onChange={v => set(prompt.id, v)} />)}
            </div>
            {scenario.hint ? <p className="eoc-assumption-hint">{scenario.hint}</p> : null}
          </article>
        ))}
      </div>
    </section>

    <section className="eoc-workshop-section" id="areas">
      <Head n={2} eyebrow="Check what feels familiar" title="Explore the five areas" copy="These are beliefs to notice, not statements to adopt. Read all five areas and check what feels familiar. Add your own belief if the list does not quite name it." />
      <div className="eoc-area-list">
        {Object.entries(beliefAreas).map(([area, beliefs]) => (
          <section className="eoc-area-card" key={area} aria-label={area + ' beliefs'}>
            <h3 className="eoc-area-title"><span>{area}</span><small>{(data.checks[area]?.length ?? 0) + (data.answers['own-' + area]?.trim() ? 1 : 0)} selected</small></h3>
            <div className="eoc-area-body">
              <div className="eoc-belief-list">
                {beliefs.map(belief => <label className="eoc-belief" key={belief}><input type="checkbox" checked={(data.checks[area] ?? []).includes(belief)} onChange={() => check(area, belief)} /><span>{belief}</span></label>)}
              </div>
              <Field id={'own-' + area} label={'My own ' + area.toLowerCase() + ' belief'} value={data.answers['own-' + area] ?? ''} onChange={v => set('own-' + area, v)} />
            </div>
          </section>
        ))}
      </div>
    </section>


    <section className="eoc-workshop-section" id="repair"><Head n={3} eyebrow="Interrupt + replace" title="Repair quickly, then create a different future" copy="When the pattern appears, use a fast repair rather than feeding shame or replaying the story. Once you can see the old loop, plant deliberately."/><div className="eoc-practice-columns"><div className="card"><div className="eyebrow">The four powers</div><h3>Repair quickly</h3>{fourPowers.map(([name,q],i) => <Field key={name} id={`power-${i}`} label={`${i+1}. ${name} · ${q}`} value={data.answers[`power-${i}`] ?? ''} onChange={v => set(`power-${i}`,v)}/>)}</div><div className="card cream"><div className="eyebrow">The four steps</div><h3>Create a different future</h3>{fourSteps.map(([name,q],i) => <Field key={name} id={`step-${i}`} label={`${i+1}. ${name} · ${q}`} value={data.answers[`step-${i}`] ?? ''} onChange={v => set(`step-${i}`,v)}/>)}</div></div></section>

    <div className="eoc-workshop-finish card sage"><div><div className="eyebrow">Keep your work</div><h2>Download a copy before you leave.</h2><p>Your browser copy stays on this device. A DOCX export gives you a portable copy of everything you wrote.</p></div><div className="actions"><button className="button sage" onClick={downloadAnswers} disabled={exporting}>{exporting ? 'Preparing DOCX…' : 'Download my answers'}</button><a className="button" href="#assumptions">Return to the beginning</a></div></div>
  </div>
}
