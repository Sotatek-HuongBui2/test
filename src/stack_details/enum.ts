import moment from "moment";

export enum IsLock {
  FALSE,
  TRUE,
}

export enum StatusStacking {
  STAKE = 'STAKE',
  UNSTAKE = 'UNSTAKE',
}

export const ONE_DAY = 1000 * 60 * 5
export const TOTAL_REWARD = 1000000
//LOCK_TIME = 1000 * 60 * 60 * 24 * 14
export const LOCK_TIME = 1000 * 60 * 5

export const TOKEN_SYMBOL = 'slft'

export const DATE_NOW = Number(moment(new Date))

export const PERCENT_BEFORE_LOCK_TIME = 0.02

export const NUMBER_DAY_IN_YEAR = 365
export const NUMBER_DAY_IN_MONTH = 30

export const KEY_IN_CACHE = {
  APR: 'apr',
  TOTAL_REWARD_DAY: 'total_reward_day',
  APR_IN_DAY: 'apr_in_day'
}
