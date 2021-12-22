import React, { useEffect, useState } from 'react'
import Layout from '../../components/Layout/Layout'
import DefaultLayoutView from '../../components/World/DefaultLayoutView'
import { LoadEngineWithScene } from '../../components/World/LoadEngineWithScene'
import { LoadLocationScene } from '../../components/World/LoadLocationScene'
import NetworkInstanceProvisioning from '../../components/World/NetworkInstanceProvisioning'
import { useTranslation } from 'react-i18next'
import MediaChannelConnection from '../../components/World/MediaChannelConnection'

interface Props {
  match?: any
}

const LocationPage = (props: Props) => {
  const { t } = useTranslation()
  const [harmonyOpen, setHarmonyOpen] = useState(false)
  const params = props?.match?.params!
  const locationName = params.locationName ?? `${params.projectName}/${params.sceneName}`

  return (
    <>
      <NetworkInstanceProvisioning locationName={locationName} />
      <MediaChannelConnection />
      <LoadLocationScene locationName={props.match.params.locationName} />
      <LoadEngineWithScene />
      <Layout
        pageTitle={t('location.locationName.pageTitle')}
        harmonyOpen={harmonyOpen}
        setHarmonyOpen={setHarmonyOpen}
      >
        <DefaultLayoutView allowDebug={true} locationName={locationName} />
      </Layout>
    </>
  )
}

export default LocationPage
