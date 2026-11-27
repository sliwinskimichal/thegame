/**
 * Job choice behind an interface (F2-3 stage 2). The default ranks open jobs by the dwarf's personal
 * priority for the work type, then the job priority, then distance, then order age; the dwarf then tries
 * the best few candidates for a free work spot. The utility layer of the ai-programmer (F2-18) will
 * replace it without touching the board or the dwarves.
 */
import { JOB_RULES } from '../../content/dwarves';
import type { JobBoard } from './board';
import { JS, JT, JT_WORK, WORK_INDEX } from './types';

/** What a chooser may ask about a dwarf. */
export interface DwarfView {
  cellOf(d: number): number;
  pickTierOf(d: number): number;
  /** Personal priority (0 = never, 1..9) of a work index (WORK_INDEX). */
  workPriority(d: number, work: number): number;
  /** The dwarf's own plan to this job failed recently. */
  avoids(d: number, jobHandle: number): boolean;
}

export interface JobChooser {
  /** Write up to `out.length` job slots for dwarf d, best first; return how many. */
  candidates(d: number, board: JobBoard, dwarves: DwarfView, out: Int32Array): number;
}

export class PriorityDistanceChooser implements JobChooser {
  private readonly score = new Float64Array(64);

  candidates(d: number, board: JobBoard, dw: DwarfView, out: Int32Array): number {
    const K = Math.min(out.length, this.score.length, Math.max(1, JOB_RULES.chooseAttempts));
    const W = board.world.w;
    const cell = dw.cellOf(d);
    const cx = cell % W;
    const cy = (cell - cx) / W;
    const tier = dw.pickTierOf(d);
    let n = 0;
    for (let s = 0; s < board.span; s++) {
      if (board.state[s] !== JS.OPEN) continue;
      const t = board.type[s]!;
      const wp = dw.workPriority(d, WORK_INDEX[JT_WORK[t]!]);
      if (wp <= 0) continue;
      if (!board.isOpen(s)) continue;
      if (t === JT.DIG && tier < board.needTier[s]!) continue;
      const i = board.target[s]!;
      const x = i % W;
      const y = (i - x) / W;
      if (dw.avoids(d, board.handle(s))) continue;
      // higher is better: personal priority, job priority, then nearer, then older
      const dist = Math.abs(x - cx) + Math.abs(y - cy);
      const sc = wp * 1e12 + board.prio[s]! * 1e10 - dist * 1e6 - (board.seq[s]! % 1e6);
      // insert into the top-K list (descending score)
      let k = n < K ? n++ : K;
      if (k === K && sc <= this.score[K - 1]!) continue;
      if (k === K) k = K - 1;
      while (k > 0 && this.score[k - 1]! < sc) {
        this.score[k] = this.score[k - 1]!;
        out[k] = out[k - 1]!;
        k--;
      }
      this.score[k] = sc;
      out[k] = s;
    }
    return n;
  }
}
