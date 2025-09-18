import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
  commitHookEffectListCreate,
  commitHookEffectListDestory,
  commitHookEffectListUnmount,
  commitMutationEffects
} from './commitWrok';
import { completeWork } from './completeWork';
import { createWorkInProgress, FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import {
  getHighestPriorityLane,
  Lane,
  lanesToSchedulerPriority,
  markRootFinished,
  mergeLanes,
  NoLane,
  SyncLane
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority,
  unstable_shouldYield,
  unstable_cancelCallback
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';

// 当前正在执行的fiber
let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffects: boolean = false;

// type RootExitStatus = number;
const RootInComplete = 1; // 进行中
const RootCompleted = 2; // 完成
// TODO 执行过程中报错了

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane;
  root.finishedWork = null;
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  // TODO调度功能
  const root = markUpdateFromFiberToRoot(fiber);
  markRootUpdated(root, lane);
  ensureRootIsScheduled(root);
}

function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes);
  const exitingCallbackNode = root.callbackNode;

  if (updateLane === NoLane) {
    if (exitingCallbackNode !== null) {
      unstable_cancelCallback(exitingCallbackNode)
    }
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }

  const curPriority = updateLane;
  const prevPriority = root.callbackPriority

  if (curPriority === prevPriority) {
    return 
  }

  if (exitingCallbackNode !== null) {
    unstable_cancelCallback(exitingCallbackNode)
  }

  let newCallbackNode = null;

  if (updateLane === SyncLane) {
    // 同步优先级 用微任务调度
    if (__DEV__) {
      console.log('在微任务中调度 优先级', updateLane);
    }
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    scheduleMicroTask(flushSyncCallbacks);
  } else {
    // 其他优先级，用宏任务调度
    const schedulerPriority = lanesToSchedulerPriority(updateLane);
    
     newCallbackNode = scheduleCallback(schedulerPriority, 
      // @ts-expect-error: scheduler callback type mismatch
      performConcurrentWorkOnRoot.bind(null, root));
  }
  root.callbackNode = newCallbackNode;
  root.callbackPriority = curPriority;
}

// 把本次更新的lane 记录在（加到）root中
function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

function markUpdateFromFiberToRoot(fiber: FiberNode) {
  let node = fiber;
  let parent = node.return;
  while (parent !== null) {
    node = parent;
    parent = node.return;
  }

  if (node.tag === HostRoot) {
    return node.stateNode;
  }
  return null;
}

function performConcurrentWorkOnRoot(root: FiberRootNode, didTimeout: boolean): any {
  const lane = getHighestPriorityLane(root.pendingLanes);
  const curCallbackNode = root.callbackNode;
  const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);

  if (didFlushPassiveEffect) {
   if (root.callbackNode !== curCallbackNode) {
    return null
   }
  }
  const needSync = lane === SyncLane || didTimeout;
  // render阶段
  const exitStatus =  renderRoot(root, lane, !needSync)

  ensureRootIsScheduled(root);

  if (exitStatus !== RootCompleted) {
    // 中断
    if (root.callbackNode !== curCallbackNode) {
      return null
    } 
    return performConcurrentWorkOnRoot.bind(null, root);
  }

  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = lane;
    wipRootRenderLane = NoLane;

    // wip fiberNode树 ，树中的flags
    commitRoot(root);
  } else if (__DEV__) {
    console.warn('还未实现的并发更新的结束状态');
  }
}

function performSyncWorkOnRoot(root: FiberRootNode) {
  const nextLane = getHighestPriorityLane(root.pendingLanes);

  if (nextLane !== SyncLane) {
    // 其他比SyncLane优先级低的lane
    ensureRootIsScheduled(root);
    return;
  }

  const exitStatus = renderRoot(root, nextLane, false);
  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = nextLane;
    wipRootRenderLane = NoLane;

    // wip fiberNode树 ，树中的flags
    commitRoot(root);
  } else if (__DEV__) {
    console.warn('还未实现的同步更新的结束状态');
  }
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
  if (__DEV__) {
    console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root);
  }

  if (wipRootRenderLane !== lane) {
    // 初始化
    prepareFreshStack(root, lane);
  }

  do {
    try {
      if (shouldTimeSlice) {
        workLoopConcurrent();
      } else {
        workLoopSync();
      }
      break;
    } catch (error) {
      if (__DEV__) {
        console.warn('WorkLoop 执行错误', error);
      }
      workInProgress = null;
    }
    // eslint-disable-next-line no-constant-condition
  } while (true);

  // 中断执行
  if (shouldTimeSlice && workInProgress !== null) {
    return RootInComplete;
  }
  // render阶段执行完了
  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.warn('render阶段结束时，wip不应该不为null');
  }
  // TODO报错
  return RootCompleted;
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;

  if (finishedWork === null) {
    return;
  }

  if (__DEV__) {
    console.warn('commit 阶段开始', finishedWork);
  }
  const lane = root.finishedLane;

  if (lane === NoLane && __DEV__) {
    console.warn('commit阶段 finishedLane 不应该是 NoLane');
  }

  // 重置
  root.finishedWork = null;
  root.finishedLane = NoLane;

  markRootFinished(root, lane);

  if ((finishedWork.flags & PassiveMask) !== NoFlags || (finishedWork.subtreeFlags & PassiveMask) !== NoFlags) {
    if (rootDoesHasPassiveEffects === false) {
      rootDoesHasPassiveEffects = true;
      // 调度副作用
      scheduleCallback(NormalPriority, () => {
        // 执行副作用
        flushPassiveEffects(root.pendingPassiveEffects);
        return;
      });
    }
  }

  // 判断是否存在3个子阶段需要执行的操作
  // root flags root subtreeFlags
  const subtreeHasEffect = (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

  if (subtreeHasEffect || rootHasEffect) {
    // beforeMutation
    // mutation Placement
    commitMutationEffects(finishedWork, root);
    root.current = finishedWork;
    // layout
  } else {
    root.current = finishedWork;
  }

  rootDoesHasPassiveEffects = false;
  ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
  let didFlushPassiveEffect = false

  pendingPassiveEffects.unmount.forEach(effect => {
    didFlushPassiveEffect = true;
    commitHookEffectListUnmount(Passive, effect);
  });
  pendingPassiveEffects.unmount = [];

  pendingPassiveEffects.update.forEach(effect => {
    didFlushPassiveEffect = true;
    commitHookEffectListDestory(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update.forEach(effect => {
    didFlushPassiveEffect = true;
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update = [];
  flushSyncCallbacks();
  return didFlushPassiveEffect;
}

function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function workLoopConcurrent() {
  while (workInProgress !== null && !unstable_shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber, wipRootRenderLane);
  fiber.memoizedProps = fiber.pendingProps;

  if (next === null) {
    completeUnitOfWork(fiber);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber;

  do {
    completeWork(node);
    const sibling = node.sibling;
    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }
    node = node.return;
    workInProgress = node;
  } while (node !== null);
}
