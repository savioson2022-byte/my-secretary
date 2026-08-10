import assert from "node:assert/strict";
import { getPersistentAlarmOffsets } from "../src/lib/persistentAlarmSchedule.ts";

assert.deepEqual(getPersistentAlarmOffsets(4, 1), [0, 1, 3, 5]);
assert.deepEqual(getPersistentAlarmOffsets(3, 2), [0, 2, 6]);
assert.deepEqual(getPersistentAlarmOffsets(0, 0), [0]);
assert.equal(getPersistentAlarmOffsets(99, 99).length, 10);
assert.deepEqual(getPersistentAlarmOffsets(2, 99), [0, 10]);

console.log("persistent alarm schedule: 5/5 passed");
