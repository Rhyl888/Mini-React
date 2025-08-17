import { FiberRootNode } from "./fiber"

export type Lane = number
export type Lanes = number


export const SyncLane = 0b0001
export const NoLane = 0b0000
export const NoLanes = 0b0000


export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}


export function requestUpdateLane(): Lane {
  return SyncLane;
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
  // 返回最高优先级的 lane, 也就是数值最小，优先级最高
  return lanes & -lanes;
}


export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;
}
