import population from './data/population.json'
import { isState, placeName, type Place } from './geo'

// Population comes from Wikidata (CC0), fetched by
// scripts/fetch-population.mjs and keyed by the map's own codes: ISO 3166-1
// numeric for countries, FIPS for states. Each figure has its year.
type Population = { wikidata: string; population: number; year: number }
const countryPopulation: Record<string, Population> = population.countries
const statePopulation: Record<string, Population> = population.states

// The part of the world, written by hand: Wikidata only has continents,
// which make a weak clue. Keyed by the name in the map data.
const countryRegions: Record<string, string> = {
  Afghanistan: 'South Asia',
  Algeria: 'North Africa',
  Angola: 'Southern Africa',
  Argentina: 'South America',
  Australia: 'Oceania',
  Austria: 'Central Europe',
  Azerbaijan: 'the Caucasus',
  Bangladesh: 'South Asia',
  Belarus: 'Eastern Europe',
  Benin: 'West Africa',
  Bhutan: 'South Asia',
  Bolivia: 'South America',
  'Bosnia and Herz.': 'the Balkans',
  Botswana: 'Southern Africa',
  Brazil: 'South America',
  Bulgaria: 'the Balkans',
  'Burkina Faso': 'West Africa',
  Cambodia: 'Southeast Asia',
  Cameroon: 'Central Africa',
  Canada: 'North America',
  'Central African Rep.': 'Central Africa',
  Chad: 'Central Africa',
  Chile: 'South America',
  China: 'East Asia',
  Colombia: 'South America',
  Congo: 'Central Africa',
  'Costa Rica': 'Central America',
  "Côte d'Ivoire": 'West Africa',
  Croatia: 'the Balkans',
  Cuba: 'the Caribbean',
  Czechia: 'Central Europe',
  'Dem. Rep. Congo': 'Central Africa',
  Denmark: 'Northern Europe',
  'Dominican Rep.': 'the Caribbean',
  Ecuador: 'South America',
  Egypt: 'North Africa',
  Eritrea: 'East Africa',
  Estonia: 'the Baltics',
  Ethiopia: 'East Africa',
  Finland: 'Northern Europe',
  France: 'Western Europe',
  Gabon: 'Central Africa',
  Georgia: 'the Caucasus',
  Germany: 'Western Europe',
  Ghana: 'West Africa',
  Greece: 'Southern Europe',
  Greenland: 'the Arctic, North America',
  Guatemala: 'Central America',
  Guinea: 'West Africa',
  Guyana: 'South America',
  Honduras: 'Central America',
  Hungary: 'Central Europe',
  Iceland: 'Northern Europe',
  India: 'South Asia',
  Indonesia: 'Southeast Asia',
  Iran: 'the Middle East',
  Iraq: 'the Middle East',
  Ireland: 'Northern Europe',
  Italy: 'Southern Europe',
  Japan: 'East Asia',
  Jordan: 'the Middle East',
  Kazakhstan: 'Central Asia',
  Kenya: 'East Africa',
  Kyrgyzstan: 'Central Asia',
  Laos: 'Southeast Asia',
  Latvia: 'the Baltics',
  Liberia: 'West Africa',
  Libya: 'North Africa',
  Lithuania: 'the Baltics',
  Madagascar: 'East Africa',
  Malawi: 'Southern Africa',
  Malaysia: 'Southeast Asia',
  Mali: 'West Africa',
  Mauritania: 'West Africa',
  Mexico: 'North America',
  Moldova: 'Eastern Europe',
  Mongolia: 'East Asia',
  Morocco: 'North Africa',
  Mozambique: 'Southern Africa',
  Myanmar: 'Southeast Asia',
  Namibia: 'Southern Africa',
  Nepal: 'South Asia',
  Netherlands: 'Western Europe',
  'New Zealand': 'Oceania',
  Nicaragua: 'Central America',
  Niger: 'West Africa',
  Nigeria: 'West Africa',
  'North Korea': 'East Asia',
  Norway: 'Northern Europe',
  Oman: 'the Middle East',
  Pakistan: 'South Asia',
  Panama: 'Central America',
  'Papua New Guinea': 'Oceania',
  Paraguay: 'South America',
  Peru: 'South America',
  Philippines: 'Southeast Asia',
  Poland: 'Central Europe',
  Portugal: 'Southern Europe',
  Romania: 'Eastern Europe',
  Russia: 'Eastern Europe and northern Asia',
  'S. Sudan': 'East Africa',
  'Saudi Arabia': 'the Middle East',
  Senegal: 'West Africa',
  Serbia: 'the Balkans',
  'Sierra Leone': 'West Africa',
  Slovakia: 'Central Europe',
  Somalia: 'East Africa',
  'South Africa': 'Southern Africa',
  'South Korea': 'East Asia',
  Spain: 'Southern Europe',
  'Sri Lanka': 'South Asia',
  Sudan: 'North Africa',
  Suriname: 'South America',
  Sweden: 'Northern Europe',
  Switzerland: 'Central Europe',
  Syria: 'the Middle East',
  Taiwan: 'East Asia',
  Tajikistan: 'Central Asia',
  Tanzania: 'East Africa',
  Thailand: 'Southeast Asia',
  Togo: 'West Africa',
  Tunisia: 'North Africa',
  Turkey: 'Western Asia and southeastern Europe',
  Turkmenistan: 'Central Asia',
  Uganda: 'East Africa',
  Ukraine: 'Eastern Europe',
  'United Arab Emirates': 'the Middle East',
  'United Kingdom': 'Northern Europe',
  'United States of America': 'North America',
  Uruguay: 'South America',
  Uzbekistan: 'Central Asia',
  Venezuela: 'South America',
  Vietnam: 'Southeast Asia',
  Yemen: 'the Middle East',
  Zambia: 'Southern Africa',
  Zimbabwe: 'Southern Africa',
}

// US Census Bureau regions, with the Northeast and West split into their
// divisions, which are easier to picture
const newEngland = 'New England'
const midAtlantic = 'the Mid-Atlantic'
const midwest = 'the Midwest'
const south = 'the South'
const mountain = 'the Mountain West'
const pacific = 'the Pacific'

const stateRegions: Record<string, string> = {
  Alabama: south,
  Alaska: pacific,
  Arizona: mountain,
  Arkansas: south,
  California: pacific,
  Colorado: mountain,
  Connecticut: newEngland,
  Delaware: south,
  Florida: south,
  Georgia: south,
  Hawaii: pacific,
  Idaho: mountain,
  Illinois: midwest,
  Indiana: midwest,
  Iowa: midwest,
  Kansas: midwest,
  Kentucky: south,
  Louisiana: south,
  Maine: newEngland,
  Maryland: south,
  Massachusetts: newEngland,
  Michigan: midwest,
  Minnesota: midwest,
  Mississippi: south,
  Missouri: midwest,
  Montana: mountain,
  Nebraska: midwest,
  Nevada: mountain,
  'New Hampshire': newEngland,
  'New Jersey': midAtlantic,
  'New Mexico': mountain,
  'New York': midAtlantic,
  'North Carolina': south,
  'North Dakota': midwest,
  Ohio: midwest,
  Oklahoma: south,
  Oregon: pacific,
  Pennsylvania: midAtlantic,
  'Rhode Island': newEngland,
  'South Carolina': south,
  'South Dakota': midwest,
  Tennessee: south,
  Texas: south,
  Utah: mountain,
  Vermont: newEngland,
  Virginia: south,
  Washington: pacific,
  'West Virginia': south,
  Wisconsin: midwest,
  Wyoming: mountain,
}

// "about 59 million", "about 5.4 million", "about 390 000"
export function formatPopulation(people: number) {
  const millions = people / 1e6
  if (millions >= 1000) return `about ${(millions / 1000).toFixed(1)} billion`
  if (millions >= 10) return `about ${Math.round(millions)} million`
  if (millions >= 1) return `about ${millions.toFixed(1).replace(/\.0$/, '')} million`
  return `about ${Math.round(millions * 1000)} 000`
}

export type Clue = { label: string; value: string }

// The clues for a place, in the order they're given
export function cluesFor(place: Place): Clue[] {
  const state = isState(place)
  const people = (state ? statePopulation : countryPopulation)[String(place.id)]
  const region = (state ? stateRegions : countryRegions)[place.properties.name]
  const clues: Clue[] = []
  if (people)
    clues.push({
      label: 'Population',
      value: `${formatPopulation(people.population)} (${people.year})`,
    })
  if (region)
    clues.push(
      state
        ? { label: 'Part of the world', value: `a US state, in ${region}` }
        : { label: 'Part of the world', value: region },
    )
  // From the name shown in the answer, not the map data's abbreviation
  clues.push({ label: 'Starts with', value: placeName(place)[0] })
  return clues
}
