// ARM (round 2 agent): the copy stand's boom arm, driven by the secret layer while S.ctx.STAND.lock is on
// (S.lockStand(true) stops main.js posing it). The joints are S.ctx.clampG › poleG › yawJ › j1 › j2 and the camera
// S.ctx.aim; lengths S.ctx.L1 / L2, pole S.ctx.POLE, clamp at S.ctx.CL; S.ctx.solveArm() is the 2-bone IK for the
// normal pose and S.ctx.poseStand(u) the fold/unfold. Export:
//   export function reachTo(S, worldPoint, o) → promise   the hand reaches a point (IK, with overshoot and settle)
//   export function carry(S, obj, from, to, o) → promise  picks obj up at from, lays it at to
//   export function restPose(S, o) → promise              back to where main.js left it
// loot.js calls these. Do not edit main.js; everything is in S.ctx.
export function install(S) { /* not built yet */ }
