import { ReactElementType } from 'shared/ReactTypes';
import { createUpdate, createUpdateQueue, enqueueUpdate, UpdateQueue } from './upateQueue';
import { FiberNode, FiberRootNode } from './fiber';
import { Container } from './hostConfig';
import { HostRoot } from './workTags';
import { scheduleUpdateOnFiber } from './workLoop';

export function createContainer(container: Container) {
  const hostRootFiber = new FiberNode(HostRoot, {}, null);
  const root = new FiberRootNode(container, hostRootFiber);
  hostRootFiber.UpdateQueue = createUpdateQueue();
  return root;
}

export function updateContainer(element: ReactElementType | null, root: FiberRootNode) {
  const hostRootFiber = root.current;
  const update = createUpdate<ReactElementType | null>(element);
  enqueueUpdate(hostRootFiber.UpdateQueue as UpdateQueue<ReactElementType | null>, update);
  scheduleUpdateOnFiber(hostRootFiber);
  return element;
}
