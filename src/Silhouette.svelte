<script lang="ts">
  import { geoAzimuthalEqualArea, geoCentroid, geoPath } from 'd3-geo'
  import type { Place } from './geo'

  // The country's or US state's outline on its own, with no map around it.
  // The projection is centred on the place itself, so the shape isn't
  // stretched (unlike a world map, where Greenland looks bigger than Africa)
  // and its position gives nothing away.

  const SIZE = 220

  let { country }: { country: Place } = $props()

  const d = $derived.by(() => {
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
  })
</script>

<svg
  viewBox="0 0 {SIZE} {SIZE}"
  class="silhouette"
  role="img"
  aria-label="Outline of the mystery shape"
>
  <path {d} />
</svg>
