import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import internals from 'shared/internals';
import { Action } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { createUpdate, createUpdateQueue, enqueueUpdate, processUpdateQueue, UpdateQueue } from './updateQueue';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane

const { currentDispatcher } = internals;

interface Hook {
  memeizedState: any;
  updateQueue: unknown;
  next: Hook | null;
}

export function renderWithHooks(wip: FiberNode, lane: Lane) {
  // 赋值
  currentlyRenderingFiber = wip;
  // 重置 hook链表
  wip.memoizedState = null;
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
  renderLane = NoLane
  return children;
}

const HookDispathcerOnMount: Dispatcher = {
  useState: mountState
};

const HookDispathcerOnUpdate: Dispatcher = {
  useState: updateState
};

function updateState<State>(): [State, Dispatch<State>] {
  // 找到当前useState对应的hook
  const hook = updateWorkInProgresHook();
  
  // 计算新state的逻辑
  const queue = hook.updateQueue as UpdateQueue<State>;
  const pending = queue.shared.pending;
  queue.shared.pending = null;

  if (pending !== null) {
    // 有更新
    const {memoizedState} = processUpdateQueue(hook.memeizedState, pending, renderLane);
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
    	throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行时的Hook比上次执行时多`
		);
  }

  currentHook = nextCurrentHook as Hook;
  const newHook: Hook = {
    memeizedState: currentHook.memeizedState,
    updateQueue: currentHook.updateQueue,
    next: null
  }
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
  const lane = requestUpdateLane()
  const update = createUpdate(action,lane);
  enqueueUpdate(updateQueue, update);
  scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memeizedState: null,
    updateQueue: null,
    next: null
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
