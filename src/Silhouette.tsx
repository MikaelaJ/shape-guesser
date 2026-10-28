import { geoAzimuthalEqualArea, geoCentroid, geoPath } from 'd3-geo'
import { useMemo } from 'react'
import type { Country } from './geo'

const SIZE = 220

// The country's outline on its own, with no map around it. The projection
// is centred on the country itself, so the shape isn't stretched (unlike a
// world map, where Greenland looks bigger than Africa) and its position
// gives nothing away.
export function Silhouette({ country }: { country: Country }) {
  const d = useMemo(() => {
    const [lon, lat] = geoCentroid(country)
    const projection = geoAzimuthalEqualArea()
      .rotate([-lon, -lat])
      .fitExtent(
        [
          [12, 12],
          [SIZE - 12, SIZE - 12],
        ],
        country,
      )
    return geoPath(projection)(country) ?? ''
  }, [country])

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="silhouette"
      role="img"
      aria-label="Outline of the mystery country"
    >
      <path d={d} />
    </svg>
  )
}
