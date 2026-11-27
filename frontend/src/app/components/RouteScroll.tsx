import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/** Una pantalla nueva empieza arriba; filtros, pasos y navegación atrás conservan su posición. */
export function RouteScroll() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const previousPath = useRef(pathname)
  useLayoutEffect(() => {
    if (previousPath.current !== pathname && navigationType !== 'POP') {
      const scrolling = document.scrollingElement ?? document.documentElement
      scrolling.scrollTop = 0
      scrolling.scrollLeft = 0
    }
    previousPath.current = pathname
  }, [pathname, navigationType])
  return null
}
