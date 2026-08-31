import type { ExpressionSpecification } from 'maplibre-gl'

/** Map line colors: allowed, restricted, or ambiguous schedule. */
export const LINE_COLORS = {
  allowed: '#16a34a',
  restricted: '#dc2626',
  ambiguous: '#d97706',
} as const

export const DEFAULT_LINE_COLOR = '#6b7280'

/** @deprecated Use LINE_COLORS — kept for components that key off polarity names. */
export const POLARITY_COLORS = {
  permitted: LINE_COLORS.allowed,
  not_permitted: LINE_COLORS.restricted,
  inactive: LINE_COLORS.allowed,
  restricted: LINE_COLORS.restricted,
  unknown: LINE_COLORS.ambiguous,
} as const

const polarityColorMatch: ExpressionSpecification = [
  'match',
  ['get', '_polarity'],
  'permitted',
  LINE_COLORS.allowed,
  'inactive',
  LINE_COLORS.allowed,
  'not_permitted',
  LINE_COLORS.restricted,
  'restricted',
  LINE_COLORS.restricted,
  DEFAULT_LINE_COLOR,
]

export const lineColorExpression: ExpressionSpecification = [
  'case',
  [
    'any',
    ['==', ['get', '_polarity'], 'unknown'],
    ['==', ['get', '_unparsed'], true],
  ],
  LINE_COLORS.ambiguous,
  ['has', '_polarity'],
  polarityColorMatch,
  DEFAULT_LINE_COLOR,
]

export const lineOpacityExpression: ExpressionSpecification = [
  'case',
  ['boolean', ['get', '_uncertainPlacement'], false],
  0.45,
  0.85,
]

export const lineWidthExpression: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  14.5,
  2.5,
  16,
  4,
  18,
  6.5,
  20,
  9,
]

/** Selected line fill width expression (thicker than base line across all zoom levels) */
export const selectedLineWidthExpression: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  14.5,
  4.5,
  16,
  6.5,
  18,
  9.5,
  20,
  13,
]

/** Selected line casing (black outline) width expression */
export const selectedCasingWidthExpression: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  14.5,
  7.5,
  16,
  10,
  18,
  14,
  20,
  18.5,
]

/** Selected outline border color (matches iOS selectedBorderColor = .black) */
export const selectedBorderColor = '#000000'

export const selectedLineOpacityExpression: ExpressionSpecification = [
  'case',
  ['boolean', ['get', '_uncertainPlacement'], false],
  0.65,
  1.0,
]

export const selectedCasingOpacityExpression: ExpressionSpecification = [
  'case',
  ['boolean', ['get', '_uncertainPlacement'], false],
  0.85,
  1.0,
]

/** Higher sort-key draws on top: restrictions under allowed. */
export const lineSortKeyExpression: ExpressionSpecification = [
  'coalesce',
  ['get', '_severity'],
  0,
]

export const CURB_ZOOM_MIN = 14.5
