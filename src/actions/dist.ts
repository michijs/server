import { tsconfig } from '../config/tsconfig';
import { config } from '../config/config';
import { exec } from 'child_process';
import fs from 'fs';

export function dist(callback: () => void, watch = false){
  fs.rmdirSync(tsconfig.compilerOptions.outDir, { recursive: true });
  exec(`tsc ${watch ? '-w': ''} --project ${config.esbuildOptions.tsconfig}`, callback);
}