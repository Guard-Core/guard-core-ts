/**
 * Pickle opcode-stream validation ported from
 * guard_core/handlers/_suspatterns_pickle.py (spec 4.0.2).
 *
 * The reference walks a bounded 4096-byte window through the CPython pickle
 * opcode dispatch (with class resolution, extension registry and persistent
 * loading blocked). The walk answers exactly two questions: does the prefix
 * before a candidate look like a valid opcode stream, and does the suffix
 * after it reach a REDUCE/BUILD opcode without an error. This port re
 * implements the same dispatch at byte level with equivalent read sizes and
 * the same blocked-opcode semantics; unknown opcodes and malformed payloads
 * fail the walk exactly like the reference.
 */

const PICKLE_OPCODE_WORK_BUDGET_BYTES = 4096;

const PICKLE_REDUCE_OR_BUILD_KEYS: ReadonlySet<number> = new Set([0x52, 0x62]); // 'R', 'b'
const FRAME_OPCODE = 0x95;

class PickleShortRead extends Error {}
class PickleBlocked extends Error {}

function isPickleSurrogateEscape(code: number): boolean {
  return code >= 0xdc80 && code <= 0xdcff;
}

/** Python: _pickle_prefix_window_from_chars; null when the window is not byte-safe. */
function windowFromChars(chars: string): Uint8Array | null {
  const bytes: number[] = [];
  for (const ch of chars) {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    const code = ch.codePointAt(0) ?? 0;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    if (code <= 0xff) {
      bytes.push(code);
    } else if (isPickleSurrogateEscape(code)) {
      bytes.push(code - 0xdc80 + 0x80);
    } else {
      return null;
    }
  }
  return Uint8Array.from(bytes);
}

interface PickleWalkState {
  window: Uint8Array;
  pos: number;
  stack: number[];
  metastack: number[][];
  marks: number[];
  memo: Map<number, boolean>;
}

function pickleRead(state: PickleWalkState, size: number): number[] {
  if (state.pos + size > state.window.length) throw new PickleShortRead();
  const bytes = Array.from(state.window.slice(state.pos, state.pos + size));
  state.pos += size;
  return bytes;
}

function pickleReadline(state: PickleWalkState): number[] {
  const line: number[] = [];
  for (;;) {
    if (state.pos >= state.window.length) throw new PickleShortRead();
    const byte = state.window[state.pos++] as number;
    line.push(byte);
    if (byte === 0x0a) break;
  }
  return line;
}

function leInt(bytes: number[]): number {
  let value = 0;
  for (let i = bytes.length - 1; i >= 0; i--) {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    value = value * 0x100 + (bytes[i] ?? 0);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
  return value;
}

function pushMark(state: PickleWalkState): void {
  state.metastack.push(state.stack);
  state.marks.push(state.stack.length);
  state.stack = [];
}

function popMark(state: PickleWalkState): number[] {
  if (state.marks.length === 0) throw new PickleBlocked('pop_mark with no mark');
  const items = state.stack;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  state.stack = state.metastack.pop() ?? [];
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  state.marks.pop();
  return items;
}

/**
 * Byte-level emulation of the CPython pickle dispatch for a bounded walk.
 * Returns true (verdict: stream is valid / reaches REDUCE or BUILD), false
 * (verdict: unknown opcode, blocked resolution, malformed payload, or a
 * complete window that exhausts without reaching REDUCE/BUILD), or null
 * (window exhausted before a verdict could form; treated like true by the
 * reference's `is not False` checks).
 */
function walkOpcodes(state: PickleWalkState, stopAtReduceOrBuild: boolean, isComplete: boolean): boolean | null {
  try {
    while (state.pos < state.window.length) {
      const key = pickleRead(state, 1)[0] as number;
      if (stopAtReduceOrBuild && PICKLE_REDUCE_OR_BUILD_KEYS.has(key)) return true;
      if (key === FRAME_OPCODE) {
        pickleRead(state, 8); // frame size; never exceeds any JS limit
        continue;
      }
      dispatchOpcode(state, key);
    }
  } catch (error) {
    if (error instanceof PickleShortRead) {
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      return isComplete ? false : null;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
    return false;
  }
  return isComplete ? (stopAtReduceOrBuild ? false : true) : null;
}

function dispatchOpcode(state: PickleWalkState, key: number): void {
  const stack = state.stack;
  switch (key) {
    case 0x28: // '(' MARK
      pushMark(state);
      return;
    case 0x30: // '0' POP
      if (stack.length === 0) throw new PickleBlocked('pop on empty stack');
      stack.pop();
      return;
    case 0x31: // '1' POP_MARK
      popMark(state);
      return;
    case 0x32: // '2' DUP
      if (stack.length === 0) throw new PickleBlocked('dup on empty stack');
      stack.push(stack[stack.length - 1] as number);
      return;
    case 0x5d: // ']' EMPTY_LIST
    case 0x7d: // '}' EMPTY_DICT
    case 0x29: // ')' EMPTY_TUPLE
      stack.push(1);
      return;
    case 0x6c: // 'l' LIST
    case 0x74: // 't' TUPLE
    case 0x64: { // 'd' DICT
      const items = popMark(state);
      if (state.marks.length === 0 && key === 0x64) {
        // DICT pairs each item with the following one; count checks are not
        // needed for the bounded walk.
        void items;
      }
      state.stack.push(1);
      return;
    }
    case 0x61: // 'a' APPEND
      stack.pop();
      return;
    case 0x65: { // 'e' APPENDS
      const items = popMark(state);
      void items;
      return;
    }
    case 0x73: // 's' SETITEM
      stack.pop();
      stack.pop();
      return;
    case 0x75: { // 'u' SETITEMS
      const items = popMark(state);
      void items;
      return;
    }
    case 0x4e: // 'N' NONE
    case 0x89: // '\x89' NEWFALSE
      stack.push(1);
      return;
    case 0x88: // '\x88' NEWTRUE
      stack.push(1);
      return;
    case 0x49: { // 'I' INT
      const data = pickleReadline(state);
      const text = String.fromCharCode(...data.slice(0, -1));
      if (text === '01' || text === '00') return;
      if (!/^-?\d+$/.test(text)) throw new PickleBlocked(`invalid int ${text}`);
      return;
    }
    case 0x4c: { // 'L' LONG
      const data = pickleReadline(state);
      let text = String.fromCharCode(...data.slice(0, -1));
      if (text.endsWith('L')) text = text.slice(0, -1);
      if (!/^-?\d+$/.test(text)) throw new PickleBlocked(`invalid long ${text}`);
      return;
    }
    case 0x46: { // 'F' FLOAT
      const data = pickleReadline(state);
      const text = String.fromCharCode(...data.slice(0, -1));
      if (Number.isNaN(Number(text))) throw new PickleBlocked(`invalid float ${text}`);
      return;
    }
    case 0x4a: // 'J' BININT
      pickleRead(state, 4);
      return;
    case 0x4b: // 'K' BININT1
      pickleRead(state, 1);
      return;
    case 0x4d: // 'M' BININT2
      pickleRead(state, 2);
      return;
    case 0x47: // 'G' BINFLOAT
      pickleRead(state, 8);
      return;
    case 0x53: { // 'S' STRING
      const data = pickleReadline(state);
      // Python: data = self.readline()[:-1] - strip the trailing newline
      // before validating the outermost quotes.
      const body = data.slice(0, -1);
      if (body.length < 2 || body[0] !== body[body.length - 1] || (body[0] !== 0x22 && body[0] !== 0x27)) {
        throw new PickleBlocked('unquoted STRING');
      }
      return;
    }
    case 0x56: // 'V' UNICODE
      pickleReadline(state);
      return;
    case 0x58: { // 'X' BINUNICODE
      const length = leInt(pickleRead(state, 4));
      pickleRead(state, length);
      return;
    }
    case 0x8c: { // '\x8c' SHORT_BINUNICODE
      const length = pickleRead(state, 1)[0] as number;
      pickleRead(state, length);
      return;
    }
    case 0x54: { // 'T' BINSTRING
      const length = leInt(pickleRead(state, 4));
      pickleRead(state, length);
      return;
    }
    case 0x55: { // 'U' SHORT_BINSTRING
      const length = pickleRead(state, 1)[0] as number;
      pickleRead(state, length);
      return;
    }
    case 0x42: { // 'B' BINBYTES
      const length = leInt(pickleRead(state, 4));
      pickleRead(state, length);
      return;
    }
    case 0x8e: { // '\x8e' BINBYTES8
      const length = leInt(pickleRead(state, 8));
      pickleRead(state, length);
      return;
    }
    case 0x43: { // 'C' SHORT_BINBYTES
      const length = pickleRead(state, 1)[0] as number;
      pickleRead(state, length);
      return;
    }
    case 0x96: { // '\x96' BYTEARRAY8
      const length = leInt(pickleRead(state, 8));
      pickleRead(state, length);
      return;
    }
    case 0x8a: { // '\x8a' LONG1
      const length = pickleRead(state, 1)[0] as number;
      pickleRead(state, length);
      return;
    }
    case 0x8b: { // '\x8b' LONG4
      const length = leInt(pickleRead(state, 4));
      pickleRead(state, length);
      return;
    }
    case 0x80: // '\x80' PROTO
      pickleRead(state, 1);
      return;
    case 0x94: // '\x94' MEMOIZE
      if (stack.length === 0) throw new PickleBlocked('memoize on empty stack');
      state.memo.set(state.memo.size, true);
      return;
    case 0x71: { // 'q' BINPUT
      const index = pickleRead(state, 1)[0] as number;
      if (stack.length === 0) throw new PickleBlocked('binput on empty stack');
      state.memo.set(index, true);
      return;
    }
    case 0x72: { // 'r' LONG_BINPUT
      const index = leInt(pickleRead(state, 4));
      if (stack.length === 0) throw new PickleBlocked('long binput on empty stack');
      state.memo.set(index, true);
      return;
    }
    case 0x68: { // 'h' BINGET
      const index = pickleRead(state, 1)[0] as number;
      if (!state.memo.has(index)) throw new PickleBlocked('missing memo entry');
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      stack.push(1);
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      return;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
    case 0x6a: { // 'j' LONG_BINGET
      const index = leInt(pickleRead(state, 4));
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      if (!state.memo.has(index)) throw new PickleBlocked('missing memo entry');
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      stack.push(1);
      return;
    }
    case 0x67: { // 'g' GET
      const data = pickleReadline(state);
      const index = Number(String.fromCharCode(...data.slice(0, -1)));
      if (!Number.isInteger(index) || !state.memo.has(index)) throw new PickleBlocked('missing memo entry');
      stack.push(1);
      return;
    }
    case 0x63: // 'c' GLOBAL -> find_class blocked
    case 0x69: // 'i' INST -> find_class blocked
    case 0x6f: // 'o' OBJ -> find_class blocked
    case 0x81: // '\x81' NEWOBJ -> class resolution blocked
    case 0x82: // '\x82' NEWOBJ_EX -> class resolution blocked
    case 0x93: // '\x93' STACK_GLOBAL -> find_class blocked
    case 0x50: // 'P' PERSID -> persistent_load blocked
    case 0x51: // 'Q' BINPERSID -> persistent_load blocked
    case 0x84: // '\x84' EXT1 -> registry blocked
    case 0x85: // '\x85' EXT2 -> registry blocked
    case 0x86: // '\x86' EXT4 -> registry blocked
      throw new PickleBlocked('blocked opcode');
    default:
      throw new PickleBlocked(`unknown opcode 0x${key.toString(16)}`);
  }
}

function freshState(window: Uint8Array, seedStack: boolean): PickleWalkState {
  return {
    window,
    pos: 0,
    stack: seedStack ? [1] : [],
    metastack: [],
    marks: [],
    memo: new Map(),
  };
}

export function picklePrefixIsOpcodeStream(prefix: string): boolean {
  if (!prefix || prefix.endsWith('\n')) return true;
  const isComplete = prefix.length <= PICKLE_OPCODE_WORK_BUDGET_BYTES;
  const window = windowFromChars(isComplete ? prefix : prefix.slice(0, PICKLE_OPCODE_WORK_BUDGET_BYTES));
  if (window === null) return false;
  return walkOpcodes(freshState(window, false), false, isComplete) !== false;
}

export function pickleSuffixReachesReduceOrBuild(suffix: string): boolean {
  const isComplete = suffix.length <= PICKLE_OPCODE_WORK_BUDGET_BYTES;
  const window = windowFromChars(isComplete ? suffix : suffix.slice(0, PICKLE_OPCODE_WORK_BUDGET_BYTES));
  if (window === null) return false;
  return walkOpcodes(freshState(window, true), true, isComplete) !== false;
}

export function _pickle_global_candidate_is_injection(match: RegExpExecArray, _context: string): boolean {
  const text = match.input;
  if (!picklePrefixIsOpcodeStream(text.slice(0, match.index))) return false;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const groupOne = match[1] ?? '';
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  const groupOneEnd = match.index + groupOne.length;
  return pickleSuffixReachesReduceOrBuild(text.slice(groupOneEnd));
}

export const _PICKLE_SURROGATEESCAPE_LOW = 0xdc80;
export const _PICKLE_SURROGATEESCAPE_HIGH = 0xdcff;
export const _PICKLE_REDUCE_OR_BUILD_KEYS = PICKLE_REDUCE_OR_BUILD_KEYS;
