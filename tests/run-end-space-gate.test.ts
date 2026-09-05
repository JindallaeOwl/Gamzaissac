import { describe, expect, it } from 'vitest';
import {
  RunEndConfirmGate,
  requiresFreshPress,
  resolveRunEndKeyAction,
} from '../src/utils/runEndInput';

describe('run end confirm gate', () => {
  it('treats only Space as needing a fresh press', () => {
    // Space는 게임 중 액티브 발동에 쓰이고 Enter는 쓰이지 않는다.
    expect(requiresFreshPress('Space')).toBe(true);
    expect(requiresFreshPress('Enter')).toBe(false);
    expect(requiresFreshPress('NumpadEnter')).toBe(false);
  });

  it('ignores Space that was already held when the overlay opened', () => {
    const gate = new RunEndConfirmGate();
    gate.open();

    expect(gate.accepts('Space')).toBe(false);
  });

  it('accepts Space once it has been released and pressed again', () => {
    const gate = new RunEndConfirmGate();
    gate.open();
    gate.noteKeyUp('Space');

    expect(gate.accepts('Space')).toBe(true);
  });

  it('lets Enter through immediately', () => {
    const gate = new RunEndConfirmGate();
    gate.open();

    expect(gate.accepts('Enter')).toBe(true);
    expect(gate.accepts('NumpadEnter')).toBe(true);
  });

  it('rejects keys that are not confirm keys at all', () => {
    const gate = new RunEndConfirmGate();
    gate.open();
    gate.noteKeyUp('Space');

    expect(gate.accepts('KeyE')).toBe(false);
  });

  it('locks again each time the overlay reopens', () => {
    // 게임오버 → 타이틀 → 새 런 → 다시 게임오버에서 걸쇠가 열린 채 남으면 안 된다.
    const gate = new RunEndConfirmGate();
    gate.open();
    gate.noteKeyUp('Space');
    expect(gate.accepts('Space')).toBe(true);

    gate.open();
    expect(gate.accepts('Space')).toBe(false);
  });
});

describe('run end key action', () => {
  const shown = {
    overlayShown: true,
    transitionStarted: false,
    outcome: 'defeated',
    expectedOutcome: 'defeated',
  } as const;

  it('confirms when the gate accepts', () => {
    expect(resolveRunEndKeyAction({ ...shown, code: 'Enter' }, true)).toBe('confirm');
  });

  it('suppresses — not ignores — a Space the gate is still holding', () => {
    // ignore로 두면 포커스된 버튼이 브라우저 기본 동작으로 눌려 걸쇠가 무의미해진다.
    // suppress여야 부르는 쪽이 preventDefault를 한다.
    expect(resolveRunEndKeyAction({ ...shown, code: 'Space' }, false)).toBe('suppress');
  });

  it('ignores keys that are not confirm keys, so typing still works', () => {
    expect(resolveRunEndKeyAction({ ...shown, code: 'KeyE' }, false)).toBe('ignore');
    expect(resolveRunEndKeyAction({ ...shown, code: 'KeyE' }, true)).toBe('ignore');
  });

  it('ignores everything while the overlay is not shown', () => {
    expect(resolveRunEndKeyAction({ ...shown, overlayShown: false, code: 'Space' }, false)).toBe(
      'ignore',
    );
  });

  it('ignores everything once the transition already started', () => {
    expect(resolveRunEndKeyAction({ ...shown, transitionStarted: true, code: 'Enter' }, true)).toBe(
      'ignore',
    );
  });

  it('ignores the other overlay outcome', () => {
    // 게임오버 리스너와 탈출 리스너가 서로의 화면에 반응하면 안 된다.
    expect(resolveRunEndKeyAction({ ...shown, outcome: 'escaped', code: 'Enter' }, true)).toBe(
      'ignore',
    );
  });
});
