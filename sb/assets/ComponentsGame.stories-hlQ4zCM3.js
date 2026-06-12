import{p as y,t as L,f as G,s as d,n as C,g as c,d as p,a as E,b as P}from"./iframe-BFkyO9LE.js";import{c as k,s as h,i as w,d as T,a as b,b as B,e as H,f as x}from"./create-runtime-stories-DI-2Alk5.js";import{S as g,a as O}from"./Symbol-CXQflEdC.js";import{G as S,t as m}from"./Game-LXQyjSI6.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./InfoBook-0Ymaab0E.js";const l=(o,t=C)=>{O(o,{get skipLoadingScreen(){return t().skipLoadingScreen},action:async()=>{var e,a;await((a=(e=t()).action)==null?void 0:a.call(e,t().data))},children:(e,a)=>{g(e,{lang:"en",children:(n,i)=>{S(n,{})},$$slots:{default:!0}})},$$slots:{default:!0}})},M={title:"COMPONENTS/<Game>"},{Story:s}=T();var N=L("<!> <!> <!>",1);function _(o,t){y(t,!1),h(),w();var e=N(),a=G(e);s(a,{name:"component (loadingScreen)",children:($,R)=>{g($,{lang:"en",children:(u,q)=>{S(u,{})},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<undefined {...args}>
   <StoryLocale lang="en">
<Game />
</StoryLocale>
 </undefined>`}}});var n=d(a,2);const i=p(()=>m({skipLoadingScreen:!0,data:{},action:async()=>{await b.enhancedBoard.preSpin({paddingBoard:B.paddingReels[H.gameType]})}}));s(n,{name:"preSpin",get args(){return c(i)},template:l,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
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
</StoryGameTemplate>`}}}),E(o,e),P()}_.__docgen={data:[],name:"ComponentsGame.stories.svelte"};const r=k(_,M),J=["ComponentLoadingScreen","PreSpin","EmitterEventBoardHide"],K={...r.ComponentLoadingScreen,tags:["svelte-csf-v5"]},Q={...r.PreSpin,tags:["svelte-csf-v5"]},U={...r.EmitterEventBoardHide,tags:["svelte-csf-v5"]};export{K as ComponentLoadingScreen,U as EmitterEventBoardHide,Q as PreSpin,J as __namedExportsOrder,M as default};
