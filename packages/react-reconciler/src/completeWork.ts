import { FiberNode } from './fiber';
import { NoFlags, Update } from './fiberFlags';
import { appendInitialChild, Container, createInstance, createTextInstance } from 'hostConfig';
import { Fragment, FunctionComponent, HostComponent, HostRoot, HostText } from './workTags';
import { updateFiberProps } from 'react-dom/src/SyntheticEvent';

function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update;
}

export function completeWork(wip: FiberNode) {
  // 归阶段
  const newProps = wip.pendingProps;
  const current = wip.alternate;

  switch (wip.tag) {
    case HostComponent:
      if (current !== null && wip.stateNode) {
        // update
        //1. props 是否变化
        //2. 变了Update flag
        // className style
        updateFiberProps(wip.stateNode, newProps);
      } else {
        // 1.构建DOM
        // const instance = createInstance(wip.type, newProps);
        const instance = createInstance(wip.type, newProps);
        // 2. 将DOM插入到DOM树中
        appendAllChildren(instance, wip);
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;
    case HostText:
      if (current !== null && wip.stateNode) {
        // update
        const oldText = current.memoizedProps?.content;
        const newText = newProps.content;
        if (oldText !== newText) {
          markUpdate(wip);
        }
      } else {
        // 1.构建DOM
        const instance = createTextInstance(newProps.content);
        // 2. 将DOM插入到DOM树中
        // 对于文本节点，我们不需要附加子节点。
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;
    case HostRoot:
    case FunctionComponent:
    case Fragment:
      bubbleProperties(wip);
      return null;
    default:
      if (__DEV__) {
        console.warn('未处理的completeWork情况', wip);
      }
  }
}

function appendAllChildren(parent: Container, wip: FiberNode) {
  let node = wip.child;
  while (node !== null) {
    if (node.tag === HostComponent || node.tag === HostText) {
      appendInitialChild(parent, node?.stateNode);
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === wip) {
      return;
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === wip) {
        return;
      }
      node = node?.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function bubbleProperties(wip: FiberNode) {
  let subtreeFlags = NoFlags;
  let child = wip.child;
  while (child !== null) {
    subtreeFlags |= child.subtreeFlags;
    subtreeFlags |= child.flags;

    child.return = wip;
    child = child.sibling;
  }
  wip.subtreeFlags |= subtreeFlags;
}
