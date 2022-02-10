import { DataTypes, Sequelize } from 'sequelize'

export const getClientSetting = async () => {

  return {
    logo: './logo.svg',
    title: 'XREngine',
    url: 'https://pawcity.xyz',
    releaseName: 'local',
    siteDescription: 'Connected Worlds for Everyone',
    favicon32px: '/favicon-32x32.png',
    favicon16px: '/favicon-16x16.png',
    icon192px: '/android-chrome-192x192.png',
    icon512px: '/android-chrome-512x512.png'
  }
  }
}