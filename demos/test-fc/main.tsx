import ReactDOM from 'react-dom';
import React from 'react';
import { useState } from 'react';

function App() {
	const [num, update] = useState(100)
	return (
		<ul onClick={() => update(50)}>
			{new Array(num).fill(0).map((_, i) => <Child key={i}>{i}</Child>)}
		</ul>
	)
}

function Child({children}: {children: React.ReactNode}) {

	const now = performance.now();
	while (performance.now() - now < 4) {
		// 模拟渲染耗时

	}
	return <li>{children}</li>
}

const root = ReactDOM.createRoot(document.getElementById('root')!);

 root.render(<App />);

declare global {
	interface Window {
		root: any;
	}
}

window.root = root;
