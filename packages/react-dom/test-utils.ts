// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { createRoot } from 'react-dom';
import { ReactElementType } from 'shared/ReactTypes';

export function renderIntoDocument(element: ReactElementType) {
  const div = document.createElement('div');
  // element
  return createRoot(div).render(element);
}