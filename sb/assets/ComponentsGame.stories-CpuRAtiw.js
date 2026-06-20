import{p as y,t as L,f as C,s as d,n as G,g as c,d as p,a as E,b as P}from"./iframe-DgGCAgXp.js";import{c as k,i as h,d as w}from"./create-runtime-stories-BL4-csec.js";import{s as b,S as g,a as H,b as T,e as x}from"./Symbol-D4D_8pl4.js";import{G as S,t as m}from"./Game-7gy1LL5K.js";import"./_commonjsHelpers-Cpj98o6Y.js";const l=(o,t=G)=>{H(o,{get skipLoadingScreen(){return t().skipLoadingScreen},action:async()=>{var e,a;await((a=(e=t()).action)==null?void 0:a.call(e,t().data))},children:(e,a)=>{g(e,{lang:"en",children:(n,i)=>{S(n,{})},$$slots:{default:!0}})},$$slots:{default:!0}})},B={title:"COMPONENTS/<Game>"},{Story:r}=w();var O=L("<!> <!> <!>",1);function _(o,t){y(t,!1),b(),h();var e=O(),a=C(e);r(a,{name:"component (loadingScreen)",children:($,M)=>{g($,{lang:"en",children:(u,N)=>{S(u,{})},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<undefined {...args}>
   <StoryLocale lang="en">
<Game />
</StoryLocale>
 </undefined>`}}});var n=d(a,2);const i=p(()=>m({skipLoadingScreen:!0,data:{},action:async()=>{await T.enhancedBoard.preSpin({})}}));r(n,{name:"preSpin",get args(){return c(i)},template:l,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var f=d(n,2);const v=p(()=>m({skipLoadingScreen:!0,data:{},action:async()=>{x.broadcast({type:"boardHide"})}}));r(f,{name:"emitterEvent: boardHide",get args(){return c(v)},template:l,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}}),E(o,e),P()}_.__docgen={data:[],name:"ComponentsGame.stories.svelte"};const s=k(_,B),z=["ComponentLoadingScreen","PreSpin","EmitterEventBoardHide"],F={...s.ComponentLoadingScreen,tags:["svelte-csf-v5"]},I={...s.PreSpin,tags:["svelte-csf-v5"]},J={...s.EmitterEventBoardHide,tags:["svelte-csf-v5"]};export{F as ComponentLoadingScreen,J as EmitterEventBoardHide,I as PreSpin,z as __namedExportsOrder,B as default};
