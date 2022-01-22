let myCfg = {
  VITE_GA_TRACKING_ID: '',
  VITE_SENTRY_DSN: '',
  VITE_APP_HOST: 'pawcity.xyz',
  VITE_APP_PORT: '443',
  VITE_SERVER_HOST: 'api-server.pawcity.xyz',
  VITE_SERVER_PORT: '443',
  VITE_GAMESERVER_HOST: 'gameserver2.pawcity.xyz',
  VITE_GAMESERVER_PORT: '443',
  VITE_FEATHERS_STORE_KEY: 'TheOverlay-Auth-Store',
  VITE_LOCAL_STORAGE_KEY: 'theoverlay-client-store-key-v1',
  VITE_EMAILJS_SERVICE_ID: '',
  VITE_EMAILJS_TEMPLATE_ID: '',
  VITE_EMAILJS_USER_ID: '',
  VITE_ROOT_REDIRECT: 'false',
  VITE_READY_PLAYER_ME_URL: 'https://xre.readyplayer.me',
  VITE_MEDIATOR_SERVER: 'https://authn.io',
  VITE_ETH_MARKETPLACE: 'http://127.0.0.1:4000'
}
//@ts-ignore
;(globalThis as any).process = {
  env: { ...(import.meta as any).env, APP_ENV: (import.meta as any).env.MODE, ...myCfg }
}
