import dayjs from 'dayjs'
import utcPlugin from 'dayjs/plugin/utc'
import timezonePlugin from 'dayjs/plugin/timezone'
import { resolveTimezone } from '@/lib/timezone'

dayjs.extend(utcPlugin)
dayjs.extend(timezonePlugin)

export function prepareDayjs (timezone) {
  dayjs.tz.setDefault(resolveTimezone(timezone))
}

export { resolveTimezone }
export default dayjs
