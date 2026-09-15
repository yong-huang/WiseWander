import { describe, it, expect } from 'vitest'
import { extractJson, stripFences, JsonParseError } from '../../../../../src/main/services/agent/json-utils'

describe('stripFences', () => {
  it('strips ```json fences', () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('strips plain ``` fences', () => {
    expect(stripFences('```\n[1,2]\n```')).toBe('[1,2]')
  })

  it('leaves unfenced text unchanged', () => {
    expect(stripFences('  {"a":1}  ')).toBe('{"a":1}')
  })
})

describe('extractJson', () => {
  it('parses a bare object', () => {
    expect(extractJson('{"action":"done"}')).toEqual({ action: 'done' })
  })

  it('parses an object wrapped in prose', () => {
    expect(extractJson('Here is my decision: {"action":"done"} — thanks!')).toEqual({ action: 'done' })
  })

  it('parses a fenced object with trailing text', () => {
    expect(extractJson('```json\n{"thought":"go"}\n```\nHope that helps.')).toEqual({ thought: 'go' })
  })

  it('parses an array', () => {
    expect(extractJson('steps: [1,2,3]')).toEqual([1, 2, 3])
  })

  it('prefers the outermost object when both braces and brackets exist', () => {
    expect(extractJson('{"items":[1,2]}')).toEqual({ items: [1, 2] })
  })

  it('throws JsonParseError on garbage', () => {
    expect(() => extractJson('no json here at all')).toThrow(JsonParseError)
  })

  it('truncates raw output in the error message', () => {
    try {
      extractJson('x'.repeat(500))
      expect.unreachable()
    } catch (err) {
      expect((err as Error).message.length).toBeLessThan(400)
    }
  })
})
