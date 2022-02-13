import React, { useState } from 'react'
import { useAuthState } from '../../../user/services/AuthService'
import ConfirmModel from '../../common/ConfirmModel'
import { useFetchUsersAsAdmin } from '../../common/hooks/User.hooks'
import TableComponent from '../../common/Table'
import { userColumns, UserData, UserProps } from '../../common/variables/user'
import { UserService, USER_PAGE_LIMIT, useUserState } from '../../services/UserService'
import { useStyles } from '../../styles/ui'
import ViewUser from './ViewUser'

const UserTable = (props: UserProps) => {
  const { search } = props
  const classes = useStyles()
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(USER_PAGE_LIMIT)
  const [popConfirmOpen, setPopConfirmOpen] = useState(false)
  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('')
  const [viewModel, setViewModel] = useState(false)
  const [userAdmin, setUserAdmin] = useState(null)
  const authState = useAuthState()
  const user = authState.user
  const adminUserState = useUserState()
  const adminUsers = adminUserState.users.value
  const adminUserCount = adminUserState.total

  useFetchUsersAsAdmin(user, adminUserState, UserService, search)

  const handlePageChange = (event: unknown, newPage: number) => {
    const incDec = page < newPage ? 'increment' : 'decrement'
    UserService.fetchUsersAsAdmin(incDec)
    setPage(newPage)
  }

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value)
    setPage(0)
  }

  const closeViewModel = (open) => {
    setViewModel(open)
  }

  const handleCloseModel = () => {
    setPopConfirmOpen(false)
  }

  const submitDeleteUser = async () => {
    await UserService.removeUserAdmin(userId)
    setPopConfirmOpen(false)
  }

  const createData = (
    id: any,
    el: any,
    name: string,
    avatar: string | JSX.Element,
    status: string | JSX.Element,
    location: string | JSX.Element,
    inviteCode: string | JSX.Element,
    instanceId: string | JSX.Element
  ): UserData => {
    return {
      id,
      el,
      name,
      avatar,
      status,
      location,
      inviteCode,
      instanceId,
      action: (
        <>
          <a
            href="#h"
            className={classes.actionStyle}
            onClick={() => {
              setUserAdmin(el)
              setViewModel(true)
            }}
          >
            <span className={classes.spanWhite}>View</span>
          </a>
          {user.id.value !== id && (
            <a
              href="#h"
              className={classes.actionStyle}
              onClick={() => {
                setUserId(id)
                setUserName(name)
                setPopConfirmOpen(true)
              }}
            >
              <span className={classes.spanDange}>Delete</span>
            </a>
          )}
        </>
      )
    }
  }

  const rows = adminUsers.map((el) => {
    const loc = el.party?.id ? el.party.location : null
    const loca = loc ? (
      loc.name || <span className={classes.spanNone}>None</span>
    ) : (
      <span className={classes.spanNone}>None</span>
    )
    const ins = el.party?.id ? el.party.instance : null
    const inst = ins ? (
      ins.ipAddress || <span className={classes.spanNone}>None</span>
    ) : (
      <span className={classes.spanNone}>None</span>
    )

    return createData(
      el.id,
      el,
      el.name,
      el.avatarId || <span className={classes.spanNone}>None</span>,
      el.userRole || <span className={classes.spanNone}>None</span>,
      loca,
      el.inviteCode || <span className={classes.spanNone}>None</span>,
      inst
    )
  })

  return (
    <React.Fragment>
      <TableComponent
        rows={rows}
        column={userColumns}
        page={page}
        rowsPerPage={rowsPerPage}
        count={adminUserCount.value}
        handlePageChange={handlePageChange}
        handleRowsPerPageChange={handleRowsPerPageChange}
      />
      <ConfirmModel
        popConfirmOpen={popConfirmOpen}
        handleCloseModel={handleCloseModel}
        submit={submitDeleteUser}
        name={userName}
        label={'user'}
      />
      {userAdmin && viewModel && (
        <ViewUser openView={viewModel} userAdmin={userAdmin} closeViewModel={closeViewModel} />
      )}
    </React.Fragment>
  )
}

export default UserTable
