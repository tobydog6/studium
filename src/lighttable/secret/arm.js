// ARM (round 2 agent): the copy stand's boom arm, driven by the secret layer while S.ctx.STAND.lock is on
// (S.lockStand(true) stops main.js posing it). The joints are S.ctx.clampG › poleG › yawJ › j1 › j2 and the camera
// S.ctx.aim; lengths S.ctx.L1 / L2, pole S.ctx.POLE, clamp at S.ctx.CL; S.ctx.solveArm() is the 2-bone IK for the
// normal pose and S.ctx.poseStand(u) the fold/unfold. See docs/secret-round2.md for S.arm. Stub until built.
export function install(S) { S.arm = { async aside() {}, async reachTo() {}, async carry() {}, async rest() {}, hand() { return new S.THREE.Vector3(); } }; }
