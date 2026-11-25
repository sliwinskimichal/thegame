/** Registry of render styles competing in the visual tournament (#1). */
import type { RenderStyle } from '../style';
import { S03, S05, S09 } from './derived';
import { S04, S07 } from './flat';
import { S01 } from './s01-diorama';
import { R2A, R2B, R2C } from './round2';
import { S06, S08, S10, S12 } from './shaded';
import { S02, S11 } from './voxel';

export const STYLES: readonly RenderStyle[] = [S01, S02, S03, S04, S05, S06, S07, S08, S09, S10, S11, S12, R2A, R2B, R2C];
