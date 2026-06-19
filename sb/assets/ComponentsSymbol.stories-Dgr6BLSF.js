import{p as X,t as $,f as t,n as Z,s as S,a as n,b as ee,c as te,e as x,g as e,d as o}from"./iframe-Ch_20VKM.js";import{c as ne,i as oe,d as ae,e as d,a as y}from"./create-runtime-stories-DPY8SYX5.js";import{c as u,d as Y,f as R,C as F,T as G}from"./Symbol-aPOm5AQJ.js";import"./_commonjsHelpers-Cpj98o6Y.js";const W=["static","spin","land","win","postWinStatic","explosion"],se={title:"Components/<Symbol>",component:u,args:{x:100,y:100,rawSymbol:{name:"S",scatter:!0},state:"static"}},{Story:q}=ae();var re=$("<!> <!>",1),me=$("<!> <!>",1),le=$("<!> <!>",1),ce=$("<!> <!>",1);function j(z,D){X(D,!1);const i=180,J=[{name:"S"},{name:"W"}],K=[{name:"H1"},{name:"H2"},{name:"H3"},{name:"H4"},{name:"H5"},{name:"L2"},{name:"L1"},{name:"L4"},{name:"L3"}];oe();var P=ce(),M=t(P);q(M,{name:"component",template:(g,v=Z)=>{Y(g,{assets:R,children:(O,f)=>{u(O,te(v,{oncomplete:()=>console.log("complete")}))},$$slots:{default:!0}})},$$slots:{template:!0},parameters:{__svelteCsf:{rawCode:`<StoryPixiApp {assets}>
	<Symbol {...args} oncomplete={() => console.log('complete')} />
</StoryPixiApp>`}}});var N=S(M,2);q(N,{name:"symbols",template:g=>{Y(g,{assets:R,children:(v,O)=>{var f=le(),H=t(f);F(H,{scale:.5,children:(b,V)=>{var a=x(),h=t(a);d(h,1,()=>J,y,(C,s,T)=>{var r=x(),A=t(r);d(A,1,()=>W,y,(L,m,w)=>{var l=re();const c=o(()=>(w+1)*i),p=o(()=>(T+1)*i);var _=t(l);const B=o(()=>e(p)-100),E=o(()=>`${e(s).name}: ${e(m)}`);G(_,{get x(){return e(c)},get y(){return e(B)},anchor:{x:.5,y:0},get text(){return e(E)}});var I=S(_,2);u(I,{get x(){return e(c)},get y(){return e(p)},get rawSymbol(){return e(s)},get state(){return e(m)},loop:!0}),n(L,l)}),n(C,r)}),n(b,a)},$$slots:{default:!0}});var U=S(H,2);F(U,{scale:.5,x:550,children:(b,V)=>{var a=x(),h=t(a);d(h,1,()=>K,y,(C,s,T)=>{var r=x(),A=t(r);d(A,1,()=>W,y,(L,m,w)=>{var l=me();const c=o(()=>(w+1)*i),p=o(()=>(T+1)*i);var _=t(l);const B=o(()=>e(p)-100),E=o(()=>`${e(s).name}: ${e(m)}`);G(_,{get x(){return e(c)},get y(){return e(B)},anchor:{x:.5,y:0},get text(){return e(E)}});var I=S(_,2);u(I,{get x(){return e(c)},get y(){return e(p)},get rawSymbol(){return e(s)},get state(){return e(m)},loop:!0}),n(L,l)}),n(C,r)}),n(b,a)},$$slots:{default:!0}}),n(v,f)},$$slots:{default:!0}})},$$slots:{template:!0},parameters:{__svelteCsf:{rawCode:`<StoryPixiApp {assets}>
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
</StoryPixiApp>`}}}),n(z,P),ee()}j.__docgen={data:[],name:"ComponentsSymbol.stories.svelte"};const k=ne(j,se),xe=["Component","Symbols"],de={...k.Component,tags:["svelte-csf-v5"]},ye={...k.Symbols,tags:["svelte-csf-v5"]};export{de as Component,ye as Symbols,xe as __namedExportsOrder,se as default};
