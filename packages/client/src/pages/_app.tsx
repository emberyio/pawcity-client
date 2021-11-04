import { initGA, logPageView } from '@xrengine/client-core/src/common/components/analytics'
import { Config } from '@xrengine/common/src/config'
import { AuthAction } from '@xrengine/client-core/src/user/services/AuthService'
import GlobalStyle from '@xrengine/client-core/src/util/GlobalStyle'
import { theme } from '@xrengine/client-core/src/theme'
import React, { useCallback, useEffect } from 'react'
import { Helmet } from 'react-helmet'
import { useDispatch } from '@xrengine/client-core/src/store'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, Theme, StyledEngineProvider } from '@mui/material/styles'
import RouterComp from '../route/public'
import './styles.scss'
// import {  } from 'styled-components'

declare module '@mui/styles/defaultTheme' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface DefaultTheme extends Theme {}
}

declare module '@mui/styles/defaultTheme' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface DefaultTheme extends Theme {}
}

const App = (): any => {
  const dispatch = useDispatch()

  const initApp = useCallback(() => {
    if (process.env && process.env.NODE_CONFIG) {
      ;(window as any).env = process.env.NODE_CONFIG
    } else {
      ;(window as any).env = (window as any).env ?? ''
    }

    dispatch(AuthAction.restoreAuth())

    initGA()

    logPageView()
  }, [])

  useEffect(initApp, [])

  return (
    <>
      <Helmet>
        <title>{Config.publicRuntimeConfig.title}</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=0, shrink-to-fit=no"
        />
      </Helmet>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
          <GlobalStyle />
          <RouterComp />
        </ThemeProvider>
      </StyledEngineProvider>
    </>
  )
}

const AppPage = () => {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}

export default AppPage
