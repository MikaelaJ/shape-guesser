import { isState, placeName, type Place } from './geo'

// Facts used as clues: population in millions and part of the world.
// Rounded estimates: around 2023 for countries, the 2020 census for US
// states. Keyed by the name in the map data.
type Fact = [population: number, region: string]

const countryFacts: Record<string, Fact> = {
  Afghanistan: [41.5, 'South Asia'],
  Algeria: [45.6, 'North Africa'],
  Angola: [36.7, 'Southern Africa'],
  Argentina: [46, 'South America'],
  Australia: [26.6, 'Oceania'],
  Austria: [9.1, 'Central Europe'],
  Azerbaijan: [10.1, 'the Caucasus'],
  Bangladesh: [172, 'South Asia'],
  Belarus: [9.2, 'Eastern Europe'],
  Benin: [13.7, 'West Africa'],
  Bhutan: [0.79, 'South Asia'],
  Bolivia: [12.4, 'South America'],
  'Bosnia and Herz.': [3.2, 'the Balkans'],
  Botswana: [2.7, 'Southern Africa'],
  Brazil: [203, 'South America'],
  Bulgaria: [6.4, 'the Balkans'],
  'Burkina Faso': [23.3, 'West Africa'],
  Cambodia: [17.4, 'Southeast Asia'],
  Cameroon: [28.6, 'Central Africa'],
  Canada: [40, 'North America'],
  'Central African Rep.': [5.7, 'Central Africa'],
  Chad: [18.3, 'Central Africa'],
  Chile: [19.6, 'South America'],
  China: [1410, 'East Asia'],
  Colombia: [52, 'South America'],
  Congo: [6.1, 'Central Africa'],
  'Costa Rica': [5.2, 'Central America'],
  "Côte d'Ivoire": [29, 'West Africa'],
  Croatia: [3.9, 'the Balkans'],
  Cuba: [10.1, 'the Caribbean'],
  Czechia: [10.9, 'Central Europe'],
  'Dem. Rep. Congo': [102, 'Central Africa'],
  Denmark: [5.9, 'Northern Europe'],
  'Dominican Rep.': [11.3, 'the Caribbean'],
  Ecuador: [18, 'South America'],
  Egypt: [113, 'North Africa'],
  Eritrea: [3.7, 'East Africa'],
  Estonia: [1.4, 'the Baltics'],
  Ethiopia: [127, 'East Africa'],
  Finland: [5.6, 'Northern Europe'],
  France: [68, 'Western Europe'],
  Gabon: [2.4, 'Central Africa'],
  Georgia: [3.7, 'the Caucasus'],
  Germany: [84, 'Western Europe'],
  Ghana: [34, 'West Africa'],
  Greece: [10.4, 'Southern Europe'],
  Greenland: [0.057, 'the Arctic, North America'],
  Guatemala: [18, 'Central America'],
  Guinea: [14.2, 'West Africa'],
  Guyana: [0.81, 'South America'],
  Honduras: [10.6, 'Central America'],
  Hungary: [9.6, 'Central Europe'],
  Iceland: [0.39, 'Northern Europe'],
  India: [1430, 'South Asia'],
  Indonesia: [278, 'Southeast Asia'],
  Iran: [89, 'the Middle East'],
  Iraq: [45, 'the Middle East'],
  Ireland: [5.2, 'Northern Europe'],
  Italy: [59, 'Southern Europe'],
  Japan: [124, 'East Asia'],
  Jordan: [11.3, 'the Middle East'],
  Kazakhstan: [20, 'Central Asia'],
  Kenya: [55, 'East Africa'],
  Kyrgyzstan: [7, 'Central Asia'],
  Laos: [7.6, 'Southeast Asia'],
  Latvia: [1.9, 'the Baltics'],
  Liberia: [5.4, 'West Africa'],
  Libya: [6.9, 'North Africa'],
  Lithuania: [2.9, 'the Baltics'],
  Madagascar: [30, 'East Africa'],
  Malawi: [21, 'Southern Africa'],
  Malaysia: [34, 'Southeast Asia'],
  Mali: [23, 'West Africa'],
  Mauritania: [4.9, 'West Africa'],
  Mexico: [129, 'North America'],
  Moldova: [2.5, 'Eastern Europe'],
  Mongolia: [3.4, 'East Asia'],
  Morocco: [37.8, 'North Africa'],
  Mozambique: [34, 'Southern Africa'],
  Myanmar: [54.6, 'Southeast Asia'],
  Namibia: [3, 'Southern Africa'],
  Nepal: [30.9, 'South Asia'],
  Netherlands: [17.9, 'Western Europe'],
  'New Zealand': [5.2, 'Oceania'],
  Nicaragua: [7, 'Central America'],
  Niger: [27, 'West Africa'],
  Nigeria: [224, 'West Africa'],
  'North Korea': [26, 'East Asia'],
  Norway: [5.5, 'Northern Europe'],
  Oman: [4.6, 'the Middle East'],
  Pakistan: [240, 'South Asia'],
  Panama: [4.5, 'Central America'],
  'Papua New Guinea': [10.3, 'Oceania'],
  Paraguay: [6.9, 'South America'],
  Peru: [34, 'South America'],
  Philippines: [115, 'Southeast Asia'],
  Poland: [37, 'Central Europe'],
  Portugal: [10.5, 'Southern Europe'],
  Romania: [19, 'Eastern Europe'],
  Russia: [144, 'Eastern Europe and northern Asia'],
  'S. Sudan': [11.1, 'East Africa'],
  'Saudi Arabia': [36.9, 'the Middle East'],
  Senegal: [18, 'West Africa'],
  Serbia: [6.6, 'the Balkans'],
  'Sierra Leone': [8.8, 'West Africa'],
  Slovakia: [5.4, 'Central Europe'],
  Somalia: [18, 'East Africa'],
  'South Africa': [61, 'Southern Africa'],
  'South Korea': [51.7, 'East Asia'],
  Spain: [48, 'Southern Europe'],
  'Sri Lanka': [22, 'South Asia'],
  Sudan: [48, 'North Africa'],
  Suriname: [0.62, 'South America'],
  Sweden: [10.5, 'Northern Europe'],
  Switzerland: [8.8, 'Central Europe'],
  Syria: [23, 'the Middle East'],
  Taiwan: [23.4, 'East Asia'],
  Tajikistan: [10.1, 'Central Asia'],
  Tanzania: [67, 'East Africa'],
  Thailand: [71.8, 'Southeast Asia'],
  Togo: [9.1, 'West Africa'],
  Tunisia: [12.5, 'North Africa'],
  Turkey: [85, 'Western Asia and southeastern Europe'],
  Turkmenistan: [6.5, 'Central Asia'],
  Uganda: [48.6, 'East Africa'],
  Ukraine: [37, 'Eastern Europe'],
  'United Arab Emirates': [9.5, 'the Middle East'],
  'United Kingdom': [68, 'Northern Europe'],
  'United States of America': [335, 'North America'],
  Uruguay: [3.4, 'South America'],
  Uzbekistan: [35, 'Central Asia'],
  Venezuela: [28.8, 'South America'],
  Vietnam: [99, 'Southeast Asia'],
  Yemen: [34, 'the Middle East'],
  Zambia: [20.6, 'Southern Africa'],
  Zimbabwe: [16.7, 'Southern Africa'],
}

// US Census Bureau regions, with the Northeast and West split into their
// divisions, which are easier to picture
const newEngland = 'New England'
const midAtlantic = 'the Mid-Atlantic'
const midwest = 'the Midwest'
const south = 'the South'
const mountain = 'the Mountain West'
const pacific = 'the Pacific'

const stateFacts: Record<string, Fact> = {
  Alabama: [5.02, south],
  Alaska: [0.733, pacific],
  Arizona: [7.15, mountain],
  Arkansas: [3.01, south],
  California: [39.5, pacific],
  Colorado: [5.77, mountain],
  Connecticut: [3.61, newEngland],
  Delaware: [0.99, south],
  Florida: [21.5, south],
  Georgia: [10.7, south],
  Hawaii: [1.46, pacific],
  Idaho: [1.84, mountain],
  Illinois: [12.8, midwest],
  Indiana: [6.79, midwest],
  Iowa: [3.19, midwest],
  Kansas: [2.94, midwest],
  Kentucky: [4.51, south],
  Louisiana: [4.66, south],
  Maine: [1.36, newEngland],
  Maryland: [6.18, south],
  Massachusetts: [7.03, newEngland],
  Michigan: [10.1, midwest],
  Minnesota: [5.71, midwest],
  Mississippi: [2.96, south],
  Missouri: [6.15, midwest],
  Montana: [1.08, mountain],
  Nebraska: [1.96, midwest],
  Nevada: [3.1, mountain],
  'New Hampshire': [1.38, newEngland],
  'New Jersey': [9.29, midAtlantic],
  'New Mexico': [2.12, mountain],
  'New York': [20.2, midAtlantic],
  'North Carolina': [10.4, south],
  'North Dakota': [0.779, midwest],
  Ohio: [11.8, midwest],
  Oklahoma: [3.96, south],
  Oregon: [4.24, pacific],
  Pennsylvania: [13, midAtlantic],
  'Rhode Island': [1.1, newEngland],
  'South Carolina': [5.12, south],
  'South Dakota': [0.887, midwest],
  Tennessee: [6.91, south],
  Texas: [29.1, south],
  Utah: [3.27, mountain],
  Vermont: [0.643, newEngland],
  Virginia: [8.63, south],
  Washington: [7.71, pacific],
  'West Virginia': [1.79, south],
  Wisconsin: [5.89, midwest],
  Wyoming: [0.577, mountain],
}

// "about 59 million", "about 5.4 million", "about 390 000"
export function formatPopulation(millions: number) {
  if (millions >= 1000) return `about ${(millions / 1000).toFixed(1)} billion`
  if (millions >= 10) return `about ${Math.round(millions)} million`
  if (millions >= 1) return `about ${millions.toFixed(1).replace(/\.0$/, '')} million`
  return `about ${Math.round(millions * 1000)} 000`
}

export type Clue = { label: string; value: string }

// The clues for a place, in the order they're given
export function cluesFor(place: Place): Clue[] {
  const name = place.properties.name
  const state = isState(place)
  const [population, region] = (state ? stateFacts : countryFacts)[name] ?? [null, null]
  const clues: Clue[] = []
  if (population !== null) clues.push({ label: 'Population', value: formatPopulation(population) })
  if (region !== null)
    clues.push(
      state
        ? { label: 'Part of the world', value: `a US state, in ${region}` }
        : { label: 'Part of the world', value: region },
    )
  // From the name shown in the answer, not the map data's abbreviation
  clues.push({ label: 'Starts with', value: placeName(place)[0] })
  return clues
}
