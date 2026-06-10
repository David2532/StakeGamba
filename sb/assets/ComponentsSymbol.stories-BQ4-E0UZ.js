import{p as X,t as g,f as t,n as Z,s as S,a as n,b as ee,c as te,e as x,g as e,d as o}from"./iframe-DyvMaDPg.js";import{c as ne,i as oe,d as ae,e as H,b as R,C as F,f as y,g as d,T as G}from"./create-runtime-stories-vQdR6F29.js";import{S as u}from"./Symbol-CvTt0kXV.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./tweened-CH8Erv7J.js";const W=["static","spin","land","win","postWinStatic","explosion"],se={title:"Components/<Symbol>",component:u,args:{x:100,y:100,rawSymbol:{name:"S",scatter:!0},state:"static"}},{Story:q}=ae();var re=g("<!> <!>",1),me=g("<!> <!>",1),le=g("<!> <!>",1),ce=g("<!> <!>",1);function j(z,D){X(D,!1);const _=180,J=[{name:"L1"},{name:"L2"},{name:"L3"},{name:"L4"},{name:"L5"}],K=[{name:"S"},{name:"W",multiplier:2},{name:"H1"},{name:"H3"},{name:"H2"},{name:"H4"}];oe();var P=ce(),M=t(P);q(M,{name:"component",template:($,v=Z)=>{H($,{assets:R,children:(O,f)=>{u(O,te(v,{oncomplete:()=>console.log("complete")}))},$$slots:{default:!0}})},$$slots:{template:!0},parameters:{__svelteCsf:{rawCode:`<StoryPixiApp {assets}>
	<Symbol {...args} oncomplete={() => console.log('complete')} />
</StoryPixiApp>`}}});var N=S(M,2);q(N,{name:"symbols",template:$=>{H($,{assets:R,children:(v,O)=>{var f=le(),Y=t(f);F(Y,{scale:.5,children:(b,V)=>{var a=x(),h=t(a);y(h,1,()=>J,d,(C,s,L)=>{var r=x(),T=t(r);y(T,1,()=>W,d,(A,m,w)=>{var l=re();const c=o(()=>(w+1)*_),p=o(()=>(L+1)*_);var i=t(l);const B=o(()=>e(p)-100),E=o(()=>`${e(s).name}: ${e(m)}`);G(i,{get x(){return e(c)},get y(){return e(B)},anchor:{x:.5,y:0},get text(){return e(E)}});var I=S(i,2);u(I,{get x(){return e(c)},get y(){return e(p)},get rawSymbol(){return e(s)},get state(){return e(m)},loop:!0}),n(A,l)}),n(C,r)}),n(b,a)},$$slots:{default:!0}});var U=S(Y,2);F(U,{scale:.5,x:550,children:(b,V)=>{var a=x(),h=t(a);y(h,1,()=>K,d,(C,s,L)=>{var r=x(),T=t(r);y(T,1,()=>W,d,(A,m,w)=>{var l=me();const c=o(()=>(w+1)*_),p=o(()=>(L+1)*_);var i=t(l);const B=o(()=>e(p)-100),E=o(()=>`${e(s).name}: ${e(m)}`);G(i,{get x(){return e(c)},get y(){return e(B)},anchor:{x:.5,y:0},get text(){return e(E)}});var I=S(i,2);u(I,{get x(){return e(c)},get y(){return e(p)},get rawSymbol(){return e(s)},get state(){return e(m)},loop:!0}),n(A,l)}),n(C,r)}),n(b,a)},$$slots:{default:!0}}),n(v,f)},$$slots:{default:!0}})},$$slots:{template:!0},parameters:{__svelteCsf:{rawCode:`<StoryPixiApp {assets}>
	<Container scale={0.5}>
		{#each SYMBOLS_LEFT as symbol, rowIndex}
			{#each SYMBOL_STATES as state, columnIndex}
				{@const x = (columnIndex + 1) * BASE}
				{@const y = (rowIndex + 1) * BASE}
				<Text {x} y={y - 100} anchor={{ x: 0.5, y: 0 }} text={\`\${symbol.name}: \${state}\`} />
				<Symbol {x} {y} rawSymbol={symbol} {state} loop />
			{/each}
		{/each}
	</Container>

	<Container scale={0.5} x={550}>
		{#each SYMBOLS_RIGHT as symbol, rowIndex}
			{#each SYMBOL_STATES as state, columnIndex}
				{@const x = (columnIndex + 1) * BASE}
				{@const y = (rowIndex + 1) * BASE}
				<Text {x} y={y - 100} anchor={{ x: 0.5, y: 0 }} text={\`\${symbol.name}: \${state}\`} />
				<Symbol {x} {y} rawSymbol={symbol} {state} loop />
			{/each}
		{/each}
	</Container>
</StoryPixiApp>`}}}),n(z,P),ee()}j.__docgen={data:[],name:"ComponentsSymbol.stories.svelte"};const k=ne(j,se),ye=["Component","Symbols"],de={...k.Component,tags:["svelte-csf-v5"]},ue={...k.Symbols,tags:["svelte-csf-v5"]};export{de as Component,ue as Symbols,ye as __namedExportsOrder,se as default};
