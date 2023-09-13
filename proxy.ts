import { proxySchema } from 'better-sqlite3-proxy'
import { db } from './db'

export type User = {
  id?: null | number
  nickname: string
}

export type Face = {
  id?: null | number
  user_id: number
  user?: User
  filename: string
  width: number
  height: number
  descriptor: string
}

export type DBProxy = {
  user: User[]
  face: Face[]
}

export let proxy = proxySchema<DBProxy>({
  db,
  tableFields: {
    user: [],
    face: [
      /* foreign references */
      ['user', { field: 'user_id', table: 'user' }],
    ],
  },
})
