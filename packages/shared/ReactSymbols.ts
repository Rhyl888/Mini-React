const supportSymbol = typeof Symbol === 'function' && Symbol.for;

console.log('supportSymbol:', supportSymbol); // 添加这行调试
console.log('typeof Symbol:', typeof Symbol); // 添加这行调试
console.log('Symbol.for:', Symbol.for); // 添加这行调试

export const REACT_ELEMENT_TYPE = supportSymbol ? Symbol.for('react.element') : 0xeac7;
