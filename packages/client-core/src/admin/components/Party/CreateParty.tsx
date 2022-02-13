import React, { useState } from 'react'
import { LocationService } from '../../services/LocationService'
import { useDispatch } from '../../../store'
import { useAuthState } from '../../../user/services/AuthService'
import { PartyService } from '../../services/PartyService'
import { InstanceService } from '../../services/InstanceService'
import DialogContentText from '@mui/material/DialogContentText'
import { PartyProps } from '../../common/variables/party'
import { useStyles } from '../../styles/ui'
import { useLocationState } from '../../services/LocationService'
import { useInstanceState } from '../../services/InstanceService'
import { Instance } from '@xrengine/common/src/interfaces/Instance'
import CreateModel from '../../common/CreateModel'
import Paper from '@mui/material/Paper'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import { validateForm } from '../../common/validation/formValidation'
import { useFetchAdminInstance } from '../../common/hooks/Instance.hooks'
import { useFetchAdminLocations } from '../../common/hooks/Location.hooks'

const CreateParty = (props: PartyProps) => {
  const classes = useStyles()
  CreateParty
  const { open, handleClose } = props

  const [newParty, setNewParty] = useState({
    location: '',
    instance: '',
    formErrors: {
      location: '',
      instance: ''
    }
  })
  const dispatch = useDispatch()
  const authState = useAuthState()
  const user = authState.user
  const adminLocationState = useLocationState()
  const locationData = adminLocationState.locations
  const adminInstanceState = useInstanceState()
  const adminInstances = adminInstanceState
  const instanceData = adminInstances.instances

  //Call custom hooks
  useFetchAdminInstance(user, adminInstanceState, InstanceService)
  useFetchAdminLocations(user, adminLocationState, LocationService)

  const handleChange = (e) => {
    const { name, value } = e.target
    let temp = newParty.formErrors
    switch (name) {
      case 'location':
        temp.location = value.length < 2 ? 'Location is required' : ''
        break
      case 'instance':
        temp.instance = value.length < 2 ? 'Instance is required' : ''
        break

      default:
        break
    }
    setNewParty({ ...newParty, [name]: value, formErrors: temp })
  }

  const data: Instance[] = []
  instanceData.value.forEach((element) => {
    data.push(element)
  })

  const submitParty = async () => {
    const data = {
      locationId: newParty.location,
      instanceId: newParty.instance
    }
    let temp = newParty.formErrors
    if (!newParty.location) {
      temp.location = "Location can't be empty"
    }
    if (!newParty.instance) {
      temp.instance = "Instance can't be empty"
    }
    setNewParty({ ...newParty, formErrors: temp })

    if (validateForm(newParty, newParty.formErrors)) {
      await PartyService.createAdminParty(data)
      setNewParty({ ...newParty, location: '', instance: '' })
      handleClose()
    }
  }
  return (
    <CreateModel open={open} action="Create" text="party" handleClose={handleClose} submit={submitParty}>
      <label>Instance</label>
      <Paper
        component="div"
        className={newParty.formErrors.instance.length > 0 ? classes.redBorder : classes.createInput}
      >
        <FormControl fullWidth>
          <Select
            labelId="demo-controlled-open-select-label"
            id="demo-controlled-open-select"
            value={newParty.instance}
            fullWidth
            displayEmpty
            onChange={handleChange}
            className={classes.select}
            name="instance"
            MenuProps={{ classes: { paper: classes.selectPaper } }}
          >
            <MenuItem value="" disabled>
              <em>Select instance</em>
            </MenuItem>
            {data.map((el) => (
              <MenuItem value={el?.id} key={el?.id}>
                {el?.ipAddress}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      <label>Location</label>
      <Paper
        component="div"
        className={newParty.formErrors.location.length > 0 ? classes.redBorder : classes.createInput}
      >
        <FormControl fullWidth>
          <Select
            labelId="demo-controlled-open-select-label"
            id="demo-controlled-open-select"
            value={newParty.location}
            fullWidth
            displayEmpty
            onChange={handleChange}
            className={classes.select}
            name="location"
            MenuProps={{ classes: { paper: classes.selectPaper } }}
          >
            <MenuItem value="" disabled>
              <em>Select location</em>
            </MenuItem>
            {locationData.value.map((el) => (
              <MenuItem value={el?.id} key={el?.id}>
                {el?.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      <DialogContentText className={classes.marginBottm}>
        <span className={classes.spanWhite}> Don't see Location? </span>
        <a href="/admin/locations" className={classes.textLink}>
          Create One
        </a>
      </DialogContentText>
    </CreateModel>
  )
}

export default CreateParty
