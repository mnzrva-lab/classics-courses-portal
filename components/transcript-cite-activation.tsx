'use client'

import { useEffect } from 'react'

/**
 * One lightweight citation activator for the whole transcript.
 *
 * On touchscreens, a tapped or text-selected passage is the only passage
 * showing a Cite control. This avoids 100+ persistent buttons on mobile.
 * A genuine single-paragraph text selection is retained for "Citation + link".
 * The normal keyboard focus and desktop hover controls stay available via CSS.
 */
export default function TranscriptCiteActivation() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-library-transcript]')
    if (!root) return

    let active: HTMLElement | null = null
    let pointerDown: { x: number; y: number } | null = null

    function paragraphFromNode(node: Node | null): HTMLElement | null {
      if (!node) return null
      const element = node.nodeType === Node.ELEMENT_NODE
        ? node as HTMLElement
        : node.parentElement
      const paragraph = element?.closest<HTMLElement>('[data-transcript-paragraph]') ?? null
      return paragraph && root?.contains(paragraph) ? paragraph : null
    }

    function activate(paragraph: HTMLElement | null, selectedQuote = '') {
      if (active !== paragraph) {
        active?.removeAttribute('data-cite-active')
        active?.removeAttribute('data-cite-selected-quote')
        active = paragraph
      }
      if (active) {
        active.setAttribute('data-cite-active', 'true')
        if (selectedQuote) active.dataset.citeSelectedQuote = selectedQuote
        else active.removeAttribute('data-cite-selected-quote')
      }
    }

    // Only quote selected text when the entire selection belongs to one
    // transcript paragraph. Never attribute a cross-paragraph selection to
    // a single speaker.
    function quoteInParagraph(paragraph: HTMLElement): string {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return ''
      if (paragraphFromNode(selection.anchorNode) !== paragraph ||
          paragraphFromNode(selection.focusNode) !== paragraph) return ''
      const copy = paragraph.querySelector('.transcript-copy')
      if (!copy?.contains(selection.anchorNode) ||
          !copy.contains(selection.focusNode)) return ''
      return selection.toString().trim()
    }

    function handleSelection() {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
      const paragraph = paragraphFromNode(selection.anchorNode)
      if (!paragraph) return
      const selectedText = quoteInParagraph(paragraph)
      if (selectedText) activate(paragraph, selectedText)
    }

    function handleTouchStart(event: PointerEvent) {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
      pointerDown = { x: event.clientX, y: event.clientY }
    }

    function handleTouchEnd(event: PointerEvent) {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
      const moved = !pointerDown || Math.hypot(
        event.clientX - pointerDown.x,
        event.clientY - pointerDown.y,
      ) > 12
      pointerDown = null
      if (moved) return

      const target = event.target instanceof Element ? event.target : null
      if (!target || target.closest('.library-transcript-cite')) return
      const paragraph = target.closest<HTMLElement>('[data-transcript-paragraph]')
      if (paragraph && root?.contains(paragraph) && target.closest('.transcript-copy')) {
        // Preserve a genuine within-paragraph quote after touch selection.
        // A previous selection or multiple-speaker selection cannot leak in.
        activate(paragraph, quoteInParagraph(paragraph))
      }
    }

    function handleOutsideTap(event: PointerEvent) {
      if (!active) return
      const target = event.target instanceof Node ? event.target : null
      if (!target || active.contains(target)) return
      // Only one passage is active. Tapping outside closes its action row.
      activate(null)
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') activate(null)
    }

    document.addEventListener('selectionchange', handleSelection)
    document.addEventListener('pointerdown', handleOutsideTap)
    document.addEventListener('keydown', handleEscape)
    root.addEventListener('pointerdown', handleTouchStart)
    root.addEventListener('pointerup', handleTouchEnd)

    return () => {
      document.removeEventListener('selectionchange', handleSelection)
      document.removeEventListener('pointerdown', handleOutsideTap)
      document.removeEventListener('keydown', handleEscape)
      root.removeEventListener('pointerdown', handleTouchStart)
      root.removeEventListener('pointerup', handleTouchEnd)
      active?.removeAttribute('data-cite-active')
      active?.removeAttribute('data-cite-selected-quote')
    }
  }, [])

  return null
}
