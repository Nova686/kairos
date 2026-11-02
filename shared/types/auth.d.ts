declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    displayName: string
    isAdmin: boolean
  }
}

export {}
