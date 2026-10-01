/**
 * Identifies the current terms of use and privacy policy. Change it when
 * either document changes materially: everyone is asked to accept again.
 * Only compared for equality, so it must never repeat an earlier value.
 *
 * It is a label, not a date. Earlier values look like dates, but they were
 * bumped a day at a time and ran weeks ahead of the calendar. Next time set
 * it to the next in "r1", "r2", "r3", and so on.
 */
export const TERMS_VERSION = "r2"

/**
 * The date shown as "last updated" on the terms and privacy pages: the real
 * day (Asia/Bangkok) the change to either document is made, from the clock
 * (`TZ=Asia/Bangkok date +%F`), never from a migration name or the old value.
 * A unit test fails if it's in the future.
 */
export const TERMS_UPDATED = "2026-10-01"
