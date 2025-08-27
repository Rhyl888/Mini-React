import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';

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
    update.next = update
  } else {
    // 追加
    // pending = b -> a -> b
    update.next = pending.next
    pending.next = update
  }
  updateQueue.shared.pending = update
};

export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): { memoizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState
  };

  if (pendingUpdate !== null) {
    // 第一个update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next  as Update<any>;
    do {
      const updateLane = pending.lane;
      if (updateLane === renderLane) {
        const action = pendingUpdate.action;
        if (action instanceof Function) {
          baseState = action(baseState);
        } else {
          baseState = action;
        }
      } else {
        if (__DEV__){
          console.error('不应该进入updateLane !== renderLane')
        }
      }
      pending = pending.next as Update<any>;
    } while (pending !== first);
    
  }
  result.memoizedState = baseState;
  return result;
};
