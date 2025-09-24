/* eslint-disable @typescript-eslint/no-explicit-any */
export type Type = any;
export type Key = any;
export type Ref = { current: any } | ((instance: any) => void) | null;
export type Props = any;
export type ElementType = any;

export interface ReactElementType {
  $$typeof: symbol | number;
  type: ElementType;
  key: Key;
  ref: Ref;
  props: Props;
  _mark: 'nianwang';
}

export type Action<State> = State | ((prevState: State) => State);
