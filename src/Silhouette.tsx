import { geoAzimuthalEqualArea, geoCentroid, geoPath } from 'd3-geo'
import { useMemo } from 'react'
import type { Place } from './geo'

const SIZE = 220

// The country's or state's outline on its own, with no map around it. The
// projection is centred on the place itself, so the shape isn't stretched
// (unlike a world map, where Greenland looks bigger than Africa) and its
// position gives nothing away.
export function Silhouette({ country, noun }: { country: Place; noun: string }) {
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
      aria-label={`Outline of the mystery ${noun}`}
    >
      <path d={d} />
    </svg>
  )
}
