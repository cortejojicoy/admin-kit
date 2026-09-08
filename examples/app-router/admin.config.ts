import { defineAdminConfig } from '@cortejojicoy/admin-kit'

/**
 * The example's configuration — plain data, so it can be built on the server
 * and handed to a client component, and so the `admin-kit docs` CLI can read it
 * in plain Node.
 */
export const adminConfig = defineAdminConfig({
  app: {
    name: 'Northwind',
    logoIconKey: 'grid',
    description: 'Everything you run today, in one place.',
  },
  router: 'app',

  auth: {
    provider: 'jwt',
    jwt: {
      endpoints: { login: '/api/auth/login', me: '/api/auth/me', logout: '/api/auth/logout' },
      tokenStorage: 'server-cookie',
      cookieName: 'northwind_session',
    },
    loginPage: { path: '/login', subtitle: 'Use any email with the password "demo".' },
    publicRoutes: ['/login', '/api/auth'],
  },

  access: {
    roles: {
      admin: ['*'],
      manager: ['users:*', 'orders:*', 'REPORTS', 'ORDERS', 'USERS'],
      staff: ['users:list', 'users:read', 'orders:list', 'ORDERS'],
    },
    hierarchy: { admin: ['manager'], manager: ['staff'] },
    deny: { manager: ['users:delete'] },
    adminRoles: ['admin'],
  },

  modules: [
    {
      code: 'USERS',
      title: 'People',
      description: 'Accounts, roles and access.',
      href: '/admin/users',
      iconKey: 'users',
      group: 'workspace',
      placement: 'tile',
      emphasis: 'primary',
      stats: [{ label: 'Active accounts', value: '128' }],
    },
    {
      code: 'ALERTS',
      title: 'Alerts',
      description: 'Anything that needs attention right now.',
      href: '/alerts',
      iconKey: 'alert',
      group: 'workspace',
      placement: 'tile',
      emphasis: 'critical',
      stats: [{ label: 'Open', value: '3' }],
    },
    {
      code: 'ORDERS',
      title: 'Orders',
      description: 'Fulfilment queue and order history.',
      href: '/orders',
      iconKey: 'list',
      group: 'workspace',
      placement: 'tile',
    },
    {
      code: 'REPORTS',
      title: 'Reports',
      description: 'Operational reporting and exports.',
      href: '/reports',
      iconKey: 'activity',
      group: 'workspace',
      placement: 'tile',
    },
    // Stations: one click away from anywhere, but not competing with the tiles
    // people actually start their day in.
    { code: 'INBOX', title: 'Inbox', href: '/inbox', iconKey: 'bell', placement: 'dock' },
    { code: 'SEARCH', title: 'Lookup', href: '/lookup', iconKey: 'search', placement: 'dock' },
  ],

  resources: [
    {
      name: 'users',
      label: 'Person',
      labelPlural: 'People',
      endpoints: {
        list: '/api/users',
        one: '/api/users/:id',
        create: { method: 'POST', path: '/api/users' },
        update: { method: 'PATCH', path: '/api/users/:id' },
        remove: { method: 'DELETE', path: '/api/users/:id' },
      },
      query: { page: 'page', perPage: 'per_page', search: 'q' },
      fields: [
        { name: 'id', label: 'ID', readOnly: true, sortable: true },
        { name: 'name', required: true, sortable: true },
        { name: 'email', type: 'email', required: true, sortable: true },
        { name: 'role', type: 'select', options: [
          { label: 'Admin', value: 'admin' },
          { label: 'Manager', value: 'manager' },
          { label: 'Staff', value: 'staff' },
        ] },
        { name: 'active', type: 'boolean' },
      ],
      permissions: {
        list: 'users:list',
        one: 'users:read',
        create: 'users:create',
        update: 'users:update',
        remove: 'users:delete',
      },
    },
  ],

  navigation: {
    sections: [
      {
        id: 'people',
        label: 'People & access',
        items: [
          { label: 'Overview', href: '/admin', iconKey: 'dashboard' },
          { label: 'People', href: '/admin/users', iconKey: 'users', permissions: ['users:list'] },
        ],
      },
    ],
  },

  panels: {
    app: { home: '/dashboard', dockOrder: ['INBOX', 'SEARCH'] },
    admin: { basePath: '/admin', title: 'Northwind admin' },
  },
})
