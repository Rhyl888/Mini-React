import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import internals from 'shared/internals';
import { Action } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { createUpdate, createUpdateQueue, enqueueUpdate, UpdateQueue } from './updateQueue';
import { scheduleUpdateOnFiber } from './workLoop';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;


const { currentDispatcher } = internals

interface Hook {
  memeizedState: any;
  updateQueue: unknown;
  next: Hook | null
}

export function renderWithHooks(wip: FiberNode) {
  // 赋值
  currentlyRenderingFiber = wip;
  // 重置
  wip.memoizedState = null

  const current = wip.alternate

  if (current !== null) {
    // update更新
  } else {
    // mount 初始化
    currentDispatcher.current = HookDispathcerOnMount
  }


  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);

  // 重置操作
  currentlyRenderingFiber = null;
  return children;
}


const HookDispathcerOnMount: Dispatcher = {
  useState: mountState
}


function mountState<State>(initialState: (() => State) | State): [State, Dispatch<State>] {

  // 找到当前useState对应的hook
  const hook = mountWorkInProgressHook();
  let memeizedState;
  if (initialState instanceof Function) {
    memeizedState = initialState()
  } else {
    memeizedState = initialState
  }

  const queue = createUpdateQueue<State>();
  hook.updateQueue = queue
  hook.memeizedState = memeizedState

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue)
  queue.dispatch = dispatch;
  return [memeizedState, dispatch]
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  const update = createUpdate(action);
  enqueueUpdate(updateQueue, update);
  scheduleUpdateOnFiber(fiber);
}



function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memeizedState: null,
    updateQueue: null,
    next: null
  }

  if (workInProgressHook === null) {
    // mount时 第一个hook
    if (currentlyRenderingFiber === null) {
      throw new Error('hook只能在函数组件中执行')
    } else {
      workInProgressHook = hook
      currentlyRenderingFiber.memoizedState = workInProgressHook
    }
  } else {
    // update时 后续hook
    workInProgressHook.next = hook
    workInProgressHook = hook
  }
  return workInProgressHook
}