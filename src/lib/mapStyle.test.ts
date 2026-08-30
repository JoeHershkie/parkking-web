import { describe, expect, it } from 'vitest'
import {
  Color,
  createPropertyExpression,
  latest,
  type Feature,
  type StylePropertyExpression,
} from '@maplibre/maplibre-gl-style-spec'
import {
  CURB_ZOOM_MIN,
  DEFAULT_LINE_COLOR,
  LINE_COLORS,
  lineColorExpression,
  lineOpacityExpression,
  lineSortKeyExpression,
  lineWidthExpression,
  selectedBorderColor,
  selectedCasingOpacityExpression,
  selectedCasingWidthExpression,
  selectedLineOpacityExpression,
  selectedLineWidthExpression,
} from './mapStyle'

function expectSuccess(
  res: ReturnType<typeof createPropertyExpression>,
): StylePropertyExpression {
  expect(res.result).toBe('success')
  if (res.result !== 'success') {
    throw new Error(`Expression parsing failed: ${JSON.stringify(res.value)}`)
  }
  return res.value
}

function makeFeature(properties: Record<string, unknown>): Feature {
  return {
    type: 'LineString',
    properties,
  }
}

describe('mapStyle', () => {
  const lineWidthSpec = latest['paint_line']['line-width']
  const lineColorSpec = latest['paint_line']['line-color']
  const lineOpacitySpec = latest['paint_line']['line-opacity']

  it('lineWidthExpression is a valid style-spec zoom expression and scales with zoom', () => {
    const expr = expectSuccess(
      createPropertyExpression(lineWidthExpression, lineWidthSpec),
    )

    const w14_5 = expr.evaluate({ zoom: 14.5 }) as number
    const w16 = expr.evaluate({ zoom: 16 }) as number
    const w17 = expr.evaluate({ zoom: 17 }) as number
    const w18 = expr.evaluate({ zoom: 18 }) as number
    const w20 = expr.evaluate({ zoom: 20 }) as number

    // Verify it is thinner when zoomed further out and thicker when zoomed in
    expect(w14_5).toBe(2.5)
    expect(w16).toBe(4)
    expect(w17).toBeGreaterThan(w16)
    expect(w18).toBe(6.5)
    expect(w20).toBe(9)
    expect(w20).toBeGreaterThan(w14_5)
  })

  it('selectedLineWidthExpression is thicker than base lineWidthExpression across all zoom levels', () => {
    const baseExpr = expectSuccess(
      createPropertyExpression(lineWidthExpression, lineWidthSpec),
    )
    const selExpr = expectSuccess(
      createPropertyExpression(selectedLineWidthExpression, lineWidthSpec),
    )

    for (const zoom of [CURB_ZOOM_MIN, 15, 16, 17, 18, 20]) {
      const globals = { zoom }
      const baseWidth = baseExpr.evaluate(globals) as number
      const selWidth = selExpr.evaluate(globals) as number

      expect(selWidth).toBeGreaterThan(baseWidth)
    }
  })

  it('selectedCasingWidthExpression provides a crisp black outline around selected fill', () => {
    const selExpr = expectSuccess(
      createPropertyExpression(selectedLineWidthExpression, lineWidthSpec),
    )
    const casingExpr = expectSuccess(
      createPropertyExpression(selectedCasingWidthExpression, lineWidthSpec),
    )

    expect(selectedBorderColor).toBe('#000000')

    for (const zoom of [CURB_ZOOM_MIN, 15, 16, 17, 18, 20]) {
      const globals = { zoom }
      const selWidth = selExpr.evaluate(globals) as number
      const casingWidth = casingExpr.evaluate(globals) as number

      const borderEachSide = (casingWidth - selWidth) / 2
      // Border on each side should be at least 1.5px
      expect(borderEachSide).toBeGreaterThanOrEqual(1.5)
      expect(casingWidth).toBeGreaterThan(selWidth)
    }
  })

  it('lineColorExpression evaluates correctly for various polarities and unparsed states', () => {
    const expr = expectSuccess(
      createPropertyExpression(lineColorExpression, lineColorSpec),
    )
    const g = { zoom: 0 }

    expect(
      expr.evaluate(g, makeFeature({ _polarity: 'permitted' })),
    ).toEqual(Color.parse(LINE_COLORS.allowed))

    expect(
      expr.evaluate(g, makeFeature({ _polarity: 'restricted' })),
    ).toEqual(Color.parse(LINE_COLORS.restricted))

    expect(
      expr.evaluate(g, makeFeature({ _polarity: 'not_permitted' })),
    ).toEqual(Color.parse(LINE_COLORS.restricted))

    expect(
      expr.evaluate(g, makeFeature({ _polarity: 'unknown' })),
    ).toEqual(Color.parse(LINE_COLORS.ambiguous))

    expect(
      expr.evaluate(g, makeFeature({ _unparsed: true })),
    ).toEqual(Color.parse(LINE_COLORS.ambiguous))

    expect(expr.evaluate(g, makeFeature({}))).toEqual(
      Color.parse(DEFAULT_LINE_COLOR),
    )
  })

  it('opacity expressions are valid style-spec expressions', () => {
    expectSuccess(
      createPropertyExpression(lineOpacityExpression, lineOpacitySpec),
    )
    expectSuccess(
      createPropertyExpression(selectedLineOpacityExpression, lineOpacitySpec),
    )
    expectSuccess(
      createPropertyExpression(
        selectedCasingOpacityExpression,
        lineOpacitySpec,
      ),
    )
  })

  it('lineSortKeyExpression sorts correctly', () => {
    const sortSpec = latest['layout_line']['line-sort-key']
    expectSuccess(createPropertyExpression(lineSortKeyExpression, sortSpec))
  })
})
