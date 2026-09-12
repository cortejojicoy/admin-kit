/**
 * An in-memory stand-in for a real backend, so the example runs with nothing
 * else installed. Module state, so it resets on every server restart.
 */
export interface Person {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'staff'
  active: boolean
}

export const people: Person[] = [
  { id: '1', name: 'Ada Okonjo', email: 'ada@axiomkit.test', role: 'admin', active: true },
  { id: '2', name: 'Blaise Moreau', email: 'blaise@axiomkit.test', role: 'manager', active: true },
  { id: '3', name: 'Chen Wei', email: 'chen@axiomkit.test', role: 'staff', active: true },
  { id: '4', name: 'Dalia Haddad', email: 'dalia@axiomkit.test', role: 'staff', active: false },
]

let nextId = people.length + 1

export function createPerson(input: Partial<Person>): Person {
  const person: Person = {
    id: String(nextId++),
    name: input.name ?? 'Unnamed',
    email: input.email ?? '',
    role: (input.role as Person['role']) ?? 'staff',
    active: input.active ?? true,
  }
  people.push(person)
  return person
}
