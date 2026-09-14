'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type TeacherBio = { full_name: string; bio: string }

export default function TeacherBioEnhancer() {
  const pathname = usePathname()
  const [mount, setMount] = useState<HTMLElement | null>(null)
  const [bios, setBios] = useState<TeacherBio[]>([])

  useEffect(() => {
    const match = pathname.match(/^\/courses\/[^/]+\/[^/]+\/([^/]+)\/?$/)
    if (!match) return
    const main = document.querySelector<HTMLElement>('main.container.page')
    const title = main?.querySelector<HTMLElement>('.class-title')
    if (!main || !title) return

    const teacherLine = title.nextElementSibling instanceof HTMLElement && title.nextElementSibling.classList.contains('lead')
      ? title.nextElementSibling as HTMLElement
      : null
    if (!teacherLine) return

    const bioMount = document.createElement('div')
    bioMount.className = 'teacher-bio-mount'
    teacherLine.insertAdjacentElement('afterend', bioMount)
    setMount(bioMount)

    let cancelled = false
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('sessions')
        .select('session_teachers(teachers(full_name,bio))')
        .eq('slug', decodeURIComponent(match[1]))
        .maybeSingle()
      if (cancelled) return
      const next = ((data as any)?.session_teachers ?? [])
        .map((item: any) => item.teachers)
        .filter((teacher: any) => teacher?.full_name && teacher?.bio?.trim())
        .map((teacher: any) => ({ full_name: teacher.full_name, bio: teacher.bio.trim() }))
      setBios(next)
    }
    void load()

    return () => {
      cancelled = true
      bioMount.remove()
      setMount(null)
      setBios([])
    }
  }, [pathname])

  if (!mount || !bios.length) return null
  return createPortal(
    <details className="teacher-bio-details">
      <summary>{bios.length === 1 ? `About ${bios[0].full_name}` : 'About the teachers'}</summary>
      <div className="teacher-bio-copy">
        {bios.map((teacher) => <div key={teacher.full_name}><strong>{teacher.full_name}</strong><div>{teacher.bio}</div></div>)}
      </div>
    </details>,
    mount,
  )
}
