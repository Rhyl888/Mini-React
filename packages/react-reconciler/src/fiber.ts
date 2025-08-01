import { Props, Key, Ref, ReactElementType } from 'shared/ReactTypes';
import { FunctionComponent, HostComponent, WorkTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';

export class FiberNode {
  tag: WorkTag;
  key: Key;
  type: any;
  stateNode: any;
  ref: Ref;

  pendingProps: Props;
  return: FiberNode | null;
  sibling: FiberNode | null;
  child: FiberNode | null;
  index: number;
  memoizedProps: Props | null;
  memoizedState: any;
  alternate: FiberNode | null;
  flags: Flags;
  subtreeFlags: Flags;
  updateQueue: unknown;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    this.tag = tag;
    this.key = key;
    // HostComponent <div> div DOM
    this.stateNode = null;
    // FunctionComponent () => {}
    this.type = null;

    // 构成树结构
    this.return = null;
    this.sibling = null;
    this.child = null;
    this.index = 0;

    this.ref = null;

    //作为工作单元
    this.pendingProps = pendingProps;
    this.memoizedProps = null;
    this.memoizedState = null;
    this.alternate = null;
    this.updateQueue = null;

    // 副作用
    this.flags = NoFlags;
    this.subtreeFlags = NoFlags;
  }
}

export class FiberRootNode {
  container: Container;
  current: FiberNode;
  finishedWork: FiberNode | null;
  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this;
    this.finishedWork = null;
  }
}

export const createWorkInProgress = (current: FiberNode, pendingProps: Props): FiberNode => {
  let wip = current.alternate;

  if (wip === null) {
    //mount
    wip = new FiberNode(current.tag, pendingProps, current.key);
    wip.type = current.type;
    wip.stateNode = current.stateNode;

    wip.alternate = current;
    current.alternate = wip;
  } else {
    //update
    wip.pendingProps = pendingProps;
    wip.flags = NoFlags;
    wip.subtreeFlags = NoFlags;
  }
  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.memoizedState = current.memoizedState;
  wip.memoizedProps = current.memoizedProps;
  return wip;
};

export function createFiberFromElement(element: ReactElementType): FiberNode {
  const { type, key, props } = element;
  let fiberTag: WorkTag = FunctionComponent;

  if (typeof type === 'string') {
    // <div/> type: "div"
    fiberTag = HostComponent;
  } else if (typeof type !== 'function' && __DEV__) {
    console.warn('未定义的type类型', element);
  }
  const fiber = new FiberNode(fiberTag, props, key);
  fiber.type = type;
  return fiber;
}
