import { FiberNode } from './fiber';

export function beginWork(fiber: FiberNode) {
  console.log('fiber', fiber);

  return null;
}
