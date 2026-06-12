import{p as y,t as L,f as C,s as d,n as G,g as c,d as p,a as E,b as P}from"./iframe-D8zJoRmp.js";import{c as k,s as h,i as w,d as b,S as g,a as H,b as T,e as x}from"./create-runtime-stories-Bv3iEogr.js";import{G as S,t as m}from"./Game-C9SmUSi3.js";import"./_commonjsHelpers-Cpj98o6Y.js";const l=(o,t=G)=>{H(o,{get skipLoadingScreen(){return t().skipLoadingScreen},action:async()=>{var e,a;await((a=(e=t()).action)==null?void 0:a.call(e,t().data))},children:(e,a)=>{g(e,{lang:"en",children:(n,i)=>{S(n,{})},$$slots:{default:!0}})},$$slots:{default:!0}})},B={title:"COMPONENTS/<Game>"},{Story:s}=b();var O=L("<!> <!> <!>",1);function _(o,t){y(t,!1),h(),w();var e=O(),a=C(e);s(a,{name:"component (loadingScreen)",children:($,M)=>{g($,{lang:"en",children:(u,N)=>{S(u,{})},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<undefined {...args}>
   <StoryLocale lang="en">
<Game />
</StoryLocale>
 </undefined>`}}});var n=d(a,2);const i=p(()=>m({skipLoadingScreen:!0,data:{},action:async()=>{await T.enhancedBoard.preSpin({})}}));s(n,{name:"preSpin",get args(){return c(i)},template:l,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var f=d(n,2);const v=p(()=>m({skipLoadingScreen:!0,data:{},action:async()=>{x.broadcast({type:"boardHide"})}}));s(f,{name:"emitterEvent: boardHide",get args(){return c(v)},template:l,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}}),E(o,e),P()}_.__docgen={data:[],name:"ComponentsGame.stories.svelte"};const r=k(_,B),j=["ComponentLoadingScreen","PreSpin","EmitterEventBoardHide"],z={...r.ComponentLoadingScreen,tags:["svelte-csf-v5"]},F={...r.PreSpin,tags:["svelte-csf-v5"]},I={...r.EmitterEventBoardHide,tags:["svelte-csf-v5"]};export{z as ComponentLoadingScreen,I as EmitterEventBoardHide,F as PreSpin,j as __namedExportsOrder,B as default};
