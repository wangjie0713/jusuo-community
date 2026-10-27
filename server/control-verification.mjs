// SPDX-License-Identifier: MPL-2.0
export class ControlVerificationError extends Error {
  constructor(message, code = 'control_confirmation_failed') {
    super(message);
    this.name = 'ControlVerificationError';
    this.code = code;
  }
}

export async function waitForExpectedState({
  readState,
  matches,
  timeoutMs = 8000,
  intervalMs = 350,
  now = Date.now,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  if (typeof readState !== 'function' || typeof matches !== 'function') {
    throw new TypeError('Control verification requires readState and matches functions.');
  }

  const deadline = now() + timeoutMs;
  while (true) {
    const state = await readState();
    if (state?.state === 'unavailable') {
      throw new ControlVerificationError('设备当前离线，无法确认本次控制结果。', 'device_unavailable');
    }
    if (matches(state)) return state;
    if (now() >= deadline) {
      throw new ControlVerificationError(
        'Home Assistant 已收到指令，但设备未在限定时间内确认状态，请稍后重试。',
        'control_confirmation_timeout',
      );
    }
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())));
  }
}
