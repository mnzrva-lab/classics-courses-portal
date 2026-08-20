export type ZonedDateTimeParts = {
  date: string
  time: string
}

function numberPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = parts.find((part) => part.type === type)?.value
  if (!value) throw new Error(`Missing ${type} while formatting date`)
  return Number(value)
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function isoToZonedParts(iso: string | null, timeZone: string): ZonedDateTimeParts {
  if (!iso) return { date: '', time: '' }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))

  const year = String(numberPart(parts, 'year')).padStart(4, '0')
  const month = String(numberPart(parts, 'month')).padStart(2, '0')
  const day = String(numberPart(parts, 'day')).padStart(2, '0')
  const hour = String(numberPart(parts, 'hour')).padStart(2, '0')
  const minute = String(numberPart(parts, 'minute')).padStart(2, '0')

  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` }
}

function zoneOffsetMs(instantMs: number, timeZone: string) {
  const instant = new Date(Math.floor(instantMs / 1000) * 1000)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)

  const asUtc = Date.UTC(
    numberPart(parts, 'year'),
    numberPart(parts, 'month') - 1,
    numberPart(parts, 'day'),
    numberPart(parts, 'hour'),
    numberPart(parts, 'minute'),
    numberPart(parts, 'second')
  )

  return asUtc - instant.getTime()
}

export function zonedLocalToIso(date: string, time: string, timeZone: string) {
  if (!date || !time) return null
  if (!isValidTimeZone(timeZone)) throw new Error('Please enter a valid IANA timezone, such as Asia/Taipei.')

  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)

  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    throw new Error('Invalid date or time.')
  }

  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  let offset = zoneOffsetMs(wallClockAsUtc, timeZone)
  let instant = wallClockAsUtc - offset

  const correctedOffset = zoneOffsetMs(instant, timeZone)
  if (correctedOffset !== offset) {
    offset = correctedOffset
    instant = wallClockAsUtc - offset
  }

  return new Date(instant).toISOString()
}
