/**
 * Frame-time measurement for the lab (BUG-002): the cost of rendering a frame, not
 * the time to submit WebGL commands. Methods, in order of preference:
 *  - 'timer-query': EXT_disjoint_timer_query_webgl2, GPU time of the frame,
 *  - 'gl.finish':   wall time of render() bracketed by gl.finish() (CPU + GPU; on
 *                   SwiftShader the GPU is the CPU, so this is the real cost there).
 * Compilation is excluded by warm-up frames before sampling.
 */
export type FrameMethod = 'timer-query' | 'gl.finish';

export interface FrameStats {
  method: FrameMethod;
  n: number;
  min: number;
  p50: number;
  p95: number;
  mean: number;
}

/** Robust summary of frame samples (ms). */
export function summarizeFrames(samples: readonly number[], method: FrameMethod): FrameStats {
  const s = samples.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  const n = s.length;
  const q = (p: number) => (n === 0 ? NaN : s[Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))))]!);
  return { method, n, min: n ? s[0]! : NaN, p50: q(0.5), p95: q(0.95), mean: n ? s.reduce((a, b) => a + b, 0) / n : NaN };
}

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

/**
 * Measure `frames` frames after `warmup` unmeasured ones. `render` draws one frame.
 * With the timer-query extension the queries are resolved over the next animation frames.
 */
export async function measureFrames(gl: WebGL2RenderingContext, render: () => void, frames = 20, warmup = 5): Promise<FrameStats> {
  for (let i = 0; i < warmup; i++) render();
  gl.finish();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
  if (ext) {
    const qs: WebGLQuery[] = [];
    for (let i = 0; i < frames; i++) {
      const q = gl.createQuery()!;
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      render();
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      qs.push(q);
    }
    const out: number[] = [];
    for (let tries = 0; tries < 120 && out.length < qs.length; tries++) {
      await new Promise((r) => requestAnimationFrame(r));
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) break; // timings invalid: fall back below
      while (out.length < qs.length && gl.getQueryParameter(qs[out.length]!, gl.QUERY_RESULT_AVAILABLE)) {
        out.push((gl.getQueryParameter(qs[out.length]!, gl.QUERY_RESULT) as number) / 1e6);
      }
    }
    qs.forEach((q) => gl.deleteQuery(q));
    if (out.length === frames) return summarizeFrames(out, 'timer-query');
  }
  const out: number[] = [];
  for (let i = 0; i < frames; i++) {
    gl.finish();
    const t0 = performance.now();
    render();
    gl.finish();
    out.push(performance.now() - t0);
  }
  return summarizeFrames(out, 'gl.finish');
}
