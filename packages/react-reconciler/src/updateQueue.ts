import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { isSubSetOfLanes, Lane, NoLane } from './fiberLanes';

export interface Update<State> {
  action: Action<State>;
  lane: Lane;
  next: Update<any> | null;
}

export interface UpdateQueue<State> {
  updateQueue: any;
  shared: {
    pending: Update<State> | null;
  };
  dispatch: Dispatch<State> | null;
}

export const createUpdate = <State>(action: Action<State>, lane: Lane): Update<State> => {
  return {
    action,
    lane,
    next: null
  };
};

export const createUpdateQueue = <Action>() => {
  return {
    shared: {
      pending: null
    },
    dispatch: null
  } as UpdateQueue<Action>;
};

export const enqueueUpdate = <Action>(updateQueue: UpdateQueue<Action>, update: Update<Action>) => {
  const pending = updateQueue.shared.pending;
  // 环状链表
  if (pending === null) {
    // 首次 pending = a -> a
    update.next = update;
  } else {
    // 追加
    // pending = b -> a -> b
    update.next = pending.next;
    pending.next = update;
  }
  updateQueue.shared.pending = update;
};

export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): { memoizedState: State; baseState: State; baseQueue: Update<State> | null } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
    baseState,
    baseQueue: null
  };

  if (pendingUpdate !== null) {
    // 第一个update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;

    let newBaseState = baseState;
    let newBaseQueueFirst: Update<State> | null = null;
    let newBaseQueueLast: Update<State> | null = null;
    let newState = baseState;

    do {
      const updateLane = pending.lane;
      if (!isSubSetOfLanes(renderLane, updateLane)) {
        // 优先级不够
        const clone = createUpdate(pending.action, pending.lane);
        // 是不是第一个被跳过的
        if (newBaseQueueFirst === null) {
          newBaseQueueFirst = clone;
          newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          // first u0 -> b
          (newBaseQueueLast as Update<State>).next = clone;
          newBaseQueueLast = clone;
        }
      } else {
        // 优先级足够
        if (newBaseQueueLast !== null) {
          const clone = createUpdate(pending.action, NoLane);
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }

        const action = pendingUpdate.action;
        if (action instanceof Function) {
          newState = action(newState);
        } else {
          newState = action;
        }
      }
      pending = pending.next as Update<any>;
    } while (pending !== first);

    if (newBaseQueueLast === null) {
      // 本次计算没有update被跳过
      newBaseState = newState;
    } else {
      // 合并成环状链表
      newBaseQueueLast.next = newBaseQueueFirst;
    }
    // 保存本次所有 update 处理后的最终 state（即组件渲染用的最新状态）。
    result.memoizedState = newState;
    // 保存本次未被处理（优先级不够、被跳过）的 update 之前的 state，方便下次高优先级更新时作为起点
    result.baseState = newBaseState;
    // 保存本次未被处理的 update 队列（比如优先级不够的 update），下次调度时可以继续处理这些 update。
    result.baseQueue = newBaseQueueLast;
  }
  return result;
};
