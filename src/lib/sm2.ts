import type { ReviewGrade } from '../types'

export interface SM2State {
  interval: number      // days until next review
  easeFactor: number    // >= 1.3
  repetitions: number   // number of successful reviews in a row
}

const MIN_EASE = 1.3

/**
 * SM-2 algorithm implementation
 * grade: 0=忘了, 1=模糊, 2=记得, 3=很熟
 */
export function sm2Next(state: SM2State, grade: ReviewGrade): SM2State {
  const { interval, easeFactor, repetitions } = state

  let newEase = easeFactor + (0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02))
  if (newEase < MIN_EASE) newEase = MIN_EASE

  let newInterval: number
  let newRepetitions: number

  if (grade < 2) {
    // Failed — reset
    newInterval = 1
    newRepetitions = 0
  } else {
    newRepetitions = repetitions + 1
    if (repetitions === 0) {
      newInterval = 1
    } else if (repetitions === 1) {
      newInterval = 6
    } else {
      newInterval = Math.round(interval * easeFactor)
    }
  }

  return {
    interval: newInterval,
    easeFactor: newEase,
    repetitions: newRepetitions,
  }
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export const initialSM2State: SM2State = {
  interval: 1,
  easeFactor: 2.5,
  repetitions: 0,
}
