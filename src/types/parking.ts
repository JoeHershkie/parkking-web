import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
} from 'geojson'
import type { FilterPolarity, Schedule } from '../lib/schedule'

export type { Schedule } from '../lib/schedule'
export type ScheduleCategory =
  | 'no_parking'
  | 'no_stopping'
  | 'no_standing'
  | 'restricted_periods'

export interface ParkingProperties {
  Highway: string
  Rule: string
  schedule_category: ScheduleCategory | string
  Side: string
  max: string | null
  schedule?: Schedule
  maxMinutes?: number | null
  disjoint_block?: boolean | null
  _id?: number | string
  side_mode?: string | null
  curb_geometry_method?: string | null
  curb_confidence?: number | null
  curb_coverage?: number | null
  median_offset_m?: number | null
  curb_override?: boolean | null
  curb_warnings?: string[] | null
  /** Client-only fields set by schedule filter enrichment */
  _polarity?: FilterPolarity
  _visible?: boolean
  _unparsed?: boolean
  _partial?: boolean
  _failed?: boolean
  _uncertainPlacement?: boolean
  /** Stable source-derived key for highlight/selection across updates */
  _featureKey?: string
  /** Draw order: restricted=0, unclear=1, allowed=2 (higher draws on top) */
  _severity?: number
}

export type ParkingGeometry = LineString | MultiLineString
export type ParkingFeature = Feature<ParkingGeometry, ParkingProperties>
export type ParkingFeatureCollection = FeatureCollection<
  ParkingGeometry,
  ParkingProperties
>

export const PARKING_SOURCE_ID = 'parking'
export const PARKING_LAYER_ID = 'parking-lines'
export const PARKING_HIGHLIGHT_CASING_LAYER_ID = 'parking-lines-highlight-casing'
export const PARKING_HIGHLIGHT_LAYER_ID = 'parking-lines-highlight'
