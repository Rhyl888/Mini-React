import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import internals from 'shared/internals';
import { Action } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { createUpdate, createUpdateQueue, enqueueUpdate, processUpdateQueue, Update, UpdateQueue } from './updateQueue';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTags';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

const { currentDispatcher } = internals;

interface Hook {
  memeizedState: any;
  updateQueue: unknown;
  next: Hook | null;
  baseState: any;
  baseQueue: Update<any> | null;
}

export interface Effect {
  tag: Flags;
  create: EffectCallback | void;
  destroy: EffectCallback | void;
  deps: EffectDeps;
  next: Effect | null;
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null;
  lastRenderedState: State;
}

type EffectCallback = () => void;
export type EffectDeps = any[] | null;

export function renderWithHooks(wip: FiberNode, lane: Lane) {
  // 赋值
  currentlyRenderingFiber = wip;
  // 重置 hook链表
  wip.memoizedState = null;
  // 重置 effect链
  wip.updateQueue = null;
  renderLane = lane;
  const current = wip.alternate;

  if (current !== null) {
    // update更新
    currentDispatcher.current = HookDispathcerOnUpdate;
  } else {
    // mount 初始化
    currentDispatcher.current = HookDispathcerOnMount;
  }

  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);

  // 重置操作
  currentlyRenderingFiber = null;
  workInProgressHook = null;
  currentHook = null;
  renderLane = NoLane;
  return children;
}

const HookDispathcerOnMount: Dispatcher = {
  useState: mountState,
  useEffect: mountEffect
};

const HookDispathcerOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect
};

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
  hook.memeizedState = pushEffect(Passive | HookHasEffect, create, undefined, nextDeps);
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  const hook = updateWorkInProgresHook();
  const nextDeps = deps === undefined ? null : deps;
  let destroy: EffectCallback | void = undefined;
  if (currentHook !== null) {
    const prevEffect = currentHook.memeizedState as Effect;
    destroy = prevEffect.destroy;

    if (nextDeps !== null) {
      // 浅比较依赖
      const prevDeps = prevEffect.deps;
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        hook.memeizedState = pushEffect(Passive, create, destroy, nextDeps);
        return;
      }
    }
    // 浅比较 不相等情况
    (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
    hook.memeizedState = pushEffect(Passive | HookHasEffect, create, destroy, nextDeps);
  }
}

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
  if (prevDeps === null || nextDeps === null) {
    return false;
  }
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(prevDeps[i], nextDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

function pushEffect(
  hookFlags: Flags,
  create: EffectCallback | void,
  destroy: EffectCallback | void,
  deps: EffectDeps | null
): Effect {
  const effect: Effect = {
    tag: hookFlags,
    create,
    destroy,
    deps,
    next: null
  };

  const fiber = currentlyRenderingFiber as FiberNode;
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;

  if (updateQueue === null) {
    const updateQueue = createFCUpdateQueue();
    fiber.updateQueue = updateQueue;
    effect.next = effect;
    updateQueue.lastEffect = effect;
  } else {
    // 插入Effect
    const lastEffect = updateQueue.lastEffect;
    if (lastEffect === null) {
      effect.next = effect;
      updateQueue.lastEffect = effect;
    } else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      updateQueue.lastEffect = effect;
    }
  }
  return effect;
}

function createFCUpdateQueue<State>() {
  const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
  updateQueue.lastEffect = null;
  return updateQueue;
}

function updateState<State>(): [State, Dispatch<State>] {
  // 找到当前useState对应的hook
  const hook = updateWorkInProgresHook();

  // 计算新state的逻辑
  const queue = hook.updateQueue as UpdateQueue<State>;
  const baseState = hook.baseState;

  const pending = queue.shared.pending;
  const current = currentHook as Hook;
  let baseQueue = current.baseQueue;

  if (pending !== null) {
    // pending baseQueue update保存在current中
    if (baseQueue !== null) {
      // baseQueue不为空，说明有上次的更新没处理完
      // baseQueue b2 -> b0 -> b1 -> b2
      // pending p2 -> p0 -> p1 -> p2

      // b0
      const baseFirst = baseQueue.next;
      // p0
      const pendingFirst = pending.next;
      // b2 -> p0
      baseQueue.next = pendingFirst;
      // p2 -> b0
      pending.next = baseFirst;
      // p2 -> b0 -> b1 -> b2 -> p0 -> p1 -> p2
    }

    baseQueue = pending;
    // 保存到 current 上
    current.baseQueue = pending
    queue.shared.pending = null;

    if (baseQueue !== null) {
      const { memoizedState, baseQueue: newBaseQueue, baseState: newBaseState } = processUpdateQueue(baseState, baseQueue, renderLane);
      hook.memeizedState = memoizedState;
      hook.baseState = newBaseState;
      hook.baseQueue = newBaseQueue;
    }
  }


  if (pending !== null) {
    // 有更新
    const { memoizedState } = processUpdateQueue(hook.memeizedState, pending, renderLane);
    hook.memeizedState = memoizedState;
  }
  return [hook.memeizedState, queue.dispatch as Dispatch<State>];
}

function updateWorkInProgresHook(): Hook {
  let nextCurrentHook: Hook | null;

  if (currentHook === null) {
    // 这是这个FunctionComponent update时的第一个hook
    const current = currentlyRenderingFiber?.alternate;
    if (current !== null) {
      nextCurrentHook = current?.memoizedState;
    } else {
      nextCurrentHook = null;
    }
  } else {
    // FC update时候，后续的hook
    nextCurrentHook = currentHook.next;
  }

  if (nextCurrentHook === null) {
    throw new Error(`组件${currentlyRenderingFiber?.type}本次执行时的Hook比上次执行时多`);
  }

  currentHook = nextCurrentHook as Hook;
  const newHook: Hook = {
    memeizedState: currentHook.memeizedState,
    updateQueue: currentHook.updateQueue,
    next: null,
    baseState: currentHook.baseState,
    baseQueue: currentHook.baseQueue
  };
  if (workInProgressHook === null) {
    // mount时 第一个hook
    if (currentlyRenderingFiber === null) {
      throw new Error('请在函数组件内调用hook');
    } else {
      workInProgressHook = newHook;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // update时 后续的hook
    workInProgressHook.next = newHook;
    workInProgressHook = newHook;
  }
  return workInProgressHook;
}

function mountState<State>(initialState: (() => State) | State): [State, Dispatch<State>] {
  // 找到当前useState对应的hook
  const hook = mountWorkInProgressHook();
  let memeizedState;
  if (initialState instanceof Function) {
    memeizedState = initialState();
  } else {
    memeizedState = initialState;
  }

  const queue = createUpdateQueue<State>();
  hook.updateQueue = queue;
  hook.memeizedState = memeizedState;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
  queue.dispatch = dispatch;
  return [memeizedState, dispatch];
}

function dispatchSetState<State>(fiber: FiberNode, updateQueue: UpdateQueue<State>, action: Action<State>) {
  const lane = requestUpdateLane();
  const update = createUpdate(action, lane);
  enqueueUpdate(updateQueue, update);
  scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memeizedState: null,
    updateQueue: null,
    next: null,
    baseState: null,
    baseQueue: null
  };

  if (workInProgressHook === null) {
    // mount时 第一个hook
    if (currentlyRenderingFiber === null) {
      throw new Error('hook只能在函数组件中执行');
    } else {
      workInProgressHook = hook;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // update时 后续hook
    workInProgressHook.next = hook;
    workInProgressHook = hook;
  }
  return workInProgressHook;
}
