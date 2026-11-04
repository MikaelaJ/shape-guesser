// Fetches the latest population of every country and US state from
// Wikidata (https://www.wikidata.org, CC0) and saves it to
// src/data/population.json, which the game's clues read.
//
// Run it with `pnpm data:population` to refresh the numbers. The result is
// committed, so the game never depends on Wikidata being up.
//
// The map data and Wikidata are matched by code, not name:
// - countries: ISO 3166-1 numeric, the map's id and Wikidata's P299
//   (Sweden, https://www.wikidata.org/wiki/Q34, is 752)
// - US states: FIPS numeric, the map's id and Wikidata's P5087
//   (California, Q99, is 06)
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const world = require('world-atlas/countries-50m.json')
const us = require('us-atlas/states-10m.json')

const ENDPOINT = 'https://query.wikidata.org/sparql'
// Wikidata asks for a User-Agent that says who is calling
const USER_AGENT = 'outlinr-data/1.0 (https://mikaelajohansson.com/shape-guesser/)'

async function sparql(query) {
  const response = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT },
  })
  if (!response.ok) throw new Error(`Wikidata answered ${response.status}`)
  return (await response.json()).results.bindings
}

// Where the code belongs to a different Wikidata item than the map's
// shape: ISO 528 is the Kingdom of the Netherlands (with the Caribbean
// islands), the map's shape is the country in Europe.
const OVERRIDES = { 528: 'Q55' }

// Every population statement with a date, for the items that have one of
// the codes. `extra` narrows which items count.
const populationQuery = (property, codes, extra = '') => `
  SELECT ?code ?item ?population ?date WHERE {
    VALUES ?code { ${codes.map((c) => `"${c}"`).join(' ')} }
    ?item wdt:${property} ?code .
    ${extra}
    ?item p:P1082 ?statement .
    ?statement ps:P1082 ?population ;
               pq:P585 ?date ;
               wikibase:rank ?rank .
    FILTER(?rank != wikibase:DeprecatedRank)
  }`

// Keep the most recent figure per code
function latest(rows) {
  const best = {}
  for (const row of rows) {
    const code = row.code.value
    const date = row.date.value
    if (!/^\d{4}-/.test(date)) continue
    if (best[code] && best[code].date >= date) continue
    best[code] = {
      date,
      wikidata: row.item.value.replace('http://www.wikidata.org/entity/', ''),
      population: Math.round(Number(row.population.value)),
    }
  }
  return Object.fromEntries(
    Object.entries(best)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, { date, ...rest }]) => [code, { ...rest, year: Number(date.slice(0, 4)) }]),
  )
}

const countryCodes = world.objects.countries.geometries.map((g) => g.id).filter(Boolean)
const stateCodes = us.objects.states.geometries.map((g) => g.id)

const overrideQuery = `
  SELECT ?code ?item ?population ?date WHERE {
    VALUES (?code ?item) { ${Object.entries(OVERRIDES)
      .map(([code, qid]) => `("${code}" wd:${qid})`)
      .join(' ')} }
    ?item p:P1082 ?statement .
    ?statement ps:P1082 ?population ;
               pq:P585 ?date ;
               wikibase:rank ?rank .
    FILTER(?rank != wikibase:DeprecatedRank)
  }`

const countries = {
  ...latest(
    await sparql(populationQuery('P299', countryCodes.filter((c) => !(c in OVERRIDES)))),
  ),
  ...latest(await sparql(overrideQuery)),
}
// Only US states (Q35657), not other things that share a FIPS code
const states = latest(
  await sparql(populationQuery('P5087', stateCodes, '?item wdt:P31 wd:Q35657 .')),
)

const missing = [
  ...countryCodes.filter((c) => !countries[c]),
  ...stateCodes.filter((c) => !states[c]),
]
writeFileSync(
  new URL('../src/data/population.json', import.meta.url),
  `${JSON.stringify(
    {
      source: 'Wikidata, https://www.wikidata.org (CC0), property P1082 (population)',
      fetched: new Date().toISOString().slice(0, 10),
      countries,
      states,
    },
    null,
    2,
  )}\n`,
)
console.log(
  `Saved ${Object.keys(countries).length} countries and ${Object.keys(states).length} states.`,
  missing.length ? `No population for codes: ${missing.join(', ')}` : '',
)
