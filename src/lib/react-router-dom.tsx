import {
    Children,
    createContext,
    isValidElement,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
    type ReactElement,
  } from 'react'
  
  const RouterContext = createContext<RouterContextValue | null>(null)
  
  const getLocationState = (): RouterLocation => ({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  })
  
  type RouterLocation = {
    pathname: string
    search: string
    hash: string
  }
  
  type NavigateOptions = {
    replace?: boolean
  }
  
  type NavigateFunction = (to: string, options?: NavigateOptions) => void
  
  type RouterContextValue = {
    location: RouterLocation
    navigate: NavigateFunction
  }
  
  export function BrowserRouter({ children }: { children: ReactNode }) {
    const [location, setLocation] = useState<RouterLocation>(() => getLocationState())
  
    useEffect(() => {
      const handlePopState = () => {
        setLocation(getLocationState())
      }
  
      window.addEventListener('popstate', handlePopState)
      return () => window.removeEventListener('popstate', handlePopState)
    }, [])
  
    const navigate = useCallback<NavigateFunction>((to, options) => {
      if (options?.replace) {
        window.history.replaceState(null, '', to)
      } else {
        window.history.pushState(null, '', to)
      }
      setLocation(getLocationState())
    }, [])
  
    const value = useMemo<RouterContextValue>(
      () => ({
        location,
        navigate,
      }),
      [location, navigate],
    )
  
    return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  }
  
  type RouteProps = {
    path: string
    element: ReactNode
  }
  
  export function Route(_props: RouteProps) {
    return null
  }
  
  function matchPath(pathname: string, routePath: string) {
    if (routePath === '*') {
      return true
    }
  
    if (routePath.endsWith('/*')) {
      const base = routePath.slice(0, -2)
      return pathname === base || pathname.startsWith(`${base}/`)
    }
  
    return pathname === routePath
  }
  
  type RoutesProps = {
    children: ReactNode
  }
  
  export function Routes({ children }: RoutesProps) {
    const router = useRouterContext('Routes')
    const { pathname } = router.location
  
    const routeElements = Children.toArray(children).filter(isValidElement) as ReactElement<RouteProps>[]
  
    for (const child of routeElements) {
      const { path, element } = child.props
      if (matchPath(pathname, path)) {
        return <>{element}</>
      }
    }
  
    return null
  }
  
  export function Navigate({ to, replace = false }: { to: string; replace?: boolean }) {
    const router = useRouterContext('Navigate')
  
    useEffect(() => {
      router.navigate(to, { replace })
    }, [replace, router, to])
  
    return null
  }
  
  export function useNavigate(): NavigateFunction {
    return useRouterContext('useNavigate').navigate
  }
  
  export function useLocation(): RouterLocation {
    return useRouterContext('useLocation').location
  }
  
  function useRouterContext(hookName: string): RouterContextValue {
    const context = useContext(RouterContext)
    if (!context) {
      throw new Error(`${hookName} must be used within a BrowserRouter`)
    }
    return context
  }