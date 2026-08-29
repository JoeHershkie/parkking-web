import { useEffect, useState } from 'react'

export type VisualViewportFrame = {
  /** Pixels the visual viewport has scrolled from the layout top. */
  offsetTop: number
  /** Visible viewport height (shrinks when the soft keyboard is open). */
  height: number
  /** Visible viewport width. */
  width: number
  /** Layout viewport height frozen while the keyboard is open. */
  layoutHeight: number
  /**
   * Estimated soft-keyboard overlap with the layout viewport.
   * Captured against the layout height from when tracking started / last
   * non-keyboard frame so iOS shrinking `innerHeight` still yields an inset.
   */
  keyboardInset: number
  /** True when the visual viewport has shrunk enough to imply a soft keyboard. */
  keyboardOpen: boolean
}

function readFrame(layoutHeight: number): VisualViewportFrame {
  const vv = window.visualViewport
  if (!vv) {
    return {
      offsetTop: 0,
      height: window.innerHeight,
      width: window.innerWidth,
      layoutHeight,
      keyboardInset: 0,
      keyboardOpen: false,
    }
  }
  const keyboardInset = Math.max(0, layoutHeight - vv.height - vv.offsetTop)
  // iOS sometimes shrinks innerHeight with the keyboard so inset alone is ~0;
  // treat a large drop vs the frozen layout height as keyboard-open too.
  const keyboardOpen =
    keyboardInset > 1 || vv.height < layoutHeight * 0.85
  return {
    offsetTop: vv.offsetTop,
    height: vv.height,
    width: vv.width,
    layoutHeight,
    keyboardInset,
    keyboardOpen,
  }
}

/**
 * Tracks the visual viewport so overlays can sit above the soft keyboard
 * without scrolling the underlying layout (map) into view.
 */
export function useVisualViewport(active = true): VisualViewportFrame {
  const [frame, setFrame] = useState<VisualViewportFrame>(() =>
    typeof window === 'undefined'
      ? {
          offsetTop: 0,
          height: 0,
          width: 0,
          layoutHeight: 0,
          keyboardInset: 0,
          keyboardOpen: false,
        }
      : readFrame(window.innerHeight),
  )

  useEffect(() => {
    if (!active) return

    // Capture baseline before the keyboard animates in.
    let layoutHeight = Math.max(
      window.innerHeight,
      window.visualViewport?.height ?? 0,
    )
    const vv = window.visualViewport

    const update = () => {
      const next = readFrame(layoutHeight)
      if (!next.keyboardOpen) {
        layoutHeight = Math.max(
          window.innerHeight,
          vv?.height ?? 0,
          layoutHeight,
        )
      }
      setFrame(readFrame(layoutHeight))
    }

    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [active])

  return frame
}
