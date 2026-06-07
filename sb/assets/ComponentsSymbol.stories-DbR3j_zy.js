import{p as X,t as $,f as t,n as Z,s as S,a as n,b as ee,c as te,e as x,g as e,d as o}from"./iframe-BSFTehXB.js";import{h as u,c as ne,i as oe,d as re,j as H,k as R,C as F,l as y,m as d,T as G}from"./create-runtime-stories-DTjEnsM2.js";import"./_commonjsHelpers-Cpj98o6Y.js";const W=["static","spin","land","win","postWinStatic","explosion"],ae={title:"Components/<Symbol>",component:u,args:{x:100,y:100,rawSymbol:{name:"S",scatter:!0},state:"static"}},{Story:j}=re();var se=$("<!> <!>",1),me=$("<!> <!>",1),le=$("<!> <!>",1),ce=$("<!> <!>",1);function k(z,D){X(D,!1);const _=180,J=[{name:"L1"},{name:"L2"},{name:"L3"},{name:"L4"},{name:"L5"}],K=[{name:"S"},{name:"W",multiplier:2},{name:"H1"},{name:"H3"},{name:"H2"},{name:"H4"}];oe();var P=ce(),M=t(P);j(M,{name:"component",template:(g,v=Z)=>{H(g,{assets:R,children:(O,f)=>{u(O,te(v,{oncomplete:()=>console.log("complete")}))},$$slots:{default:!0}})},$$slots:{template:!0},parameters:{__svelteCsf:{rawCode:`<StoryPixiApp {assets}>\r
	<Symbol {...args} oncomplete={() => console.log('complete')} />\r
</StoryPixiApp>`}}});var N=S(M,2);j(N,{name:"symbols",template:g=>{H(g,{assets:R,children:(v,O)=>{var f=le(),Y=t(f);F(Y,{scale:.5,children:(b,V)=>{var r=x(),h=t(r);y(h,1,()=>J,d,(C,a,L)=>{var s=x(),T=t(s);y(T,1,()=>W,d,(A,m,w)=>{var l=se();const c=o(()=>(w+1)*_),p=o(()=>(L+1)*_);var i=t(l);const B=o(()=>e(p)-100),E=o(()=>`${e(a).name}: ${e(m)}`);G(i,{get x(){return e(c)},get y(){return e(B)},anchor:{x:.5,y:0},get text(){return e(E)}});var I=S(i,2);u(I,{get x(){return e(c)},get y(){return e(p)},get rawSymbol(){return e(a)},get state(){return e(m)},loop:!0}),n(A,l)}),n(C,s)}),n(b,r)},$$slots:{default:!0}});var U=S(Y,2);F(U,{scale:.5,x:550,children:(b,V)=>{var r=x(),h=t(r);y(h,1,()=>K,d,(C,a,L)=>{var s=x(),T=t(s);y(T,1,()=>W,d,(A,m,w)=>{var l=me();const c=o(()=>(w+1)*_),p=o(()=>(L+1)*_);var i=t(l);const B=o(()=>e(p)-100),E=o(()=>`${e(a).name}: ${e(m)}`);G(i,{get x(){return e(c)},get y(){return e(B)},anchor:{x:.5,y:0},get text(){return e(E)}});var I=S(i,2);u(I,{get x(){return e(c)},get y(){return e(p)},get rawSymbol(){return e(a)},get state(){return e(m)},loop:!0}),n(A,l)}),n(C,s)}),n(b,r)},$$slots:{default:!0}}),n(v,f)},$$slots:{default:!0}})},$$slots:{template:!0},parameters:{__svelteCsf:{rawCode:`<StoryPixiApp {assets}>\r
	<Container scale={0.5}>\r
		{#each SYMBOLS_LEFT as symbol, rowIndex}\r
			{#each SYMBOL_STATES as state, columnIndex}\r
				{@const x = (columnIndex + 1) * BASE}\r
				{@const y = (rowIndex + 1) * BASE}\r
				<Text {x} y={y - 100} anchor={{ x: 0.5, y: 0 }} text={\`\${symbol.name}: \${state}\`} />\r
				<Symbol {x} {y} rawSymbol={symbol} {state} loop />\r
			{/each}\r
		{/each}\r
	</Container>\r
\r
	<Container scale={0.5} x={550}>\r
		{#each SYMBOLS_RIGHT as symbol, rowIndex}\r
			{#each SYMBOL_STATES as state, columnIndex}\r
				{@const x = (columnIndex + 1) * BASE}\r
				{@const y = (rowIndex + 1) * BASE}\r
				<Text {x} y={y - 100} anchor={{ x: 0.5, y: 0 }} text={\`\${symbol.name}: \${state}\`} />\r
				<Symbol {x} {y} rawSymbol={symbol} {state} loop />\r
			{/each}\r
		{/each}\r
	</Container>\r
</StoryPixiApp>`}}}),n(z,P),ee()}k.__docgen={data:[],name:"ComponentsSymbol.stories.svelte"};const q=ne(k,ae),Se=["Component","Symbols"],xe={...q.Component,tags:["svelte-csf-v5"]},ye={...q.Symbols,tags:["svelte-csf-v5"]};export{xe as Component,ye as Symbols,Se as __namedExportsOrder,ae as default};
