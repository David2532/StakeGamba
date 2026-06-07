import{p as y,t as L,f as G,s as d,n as C,g as c,d as p,a as E,b as P}from"./iframe-CplbsSnD.js";import{c as k,s as h,i as w,d as T,S as g,a as b,b as B,e as H,f as x,g as O}from"./create-runtime-stories-BrmlIefc.js";import{G as S,t as m}from"./Game-B7CTu3mM.js";import"./_commonjsHelpers-Cpj98o6Y.js";const l=(s,t=C)=>{b(s,{get skipLoadingScreen(){return t().skipLoadingScreen},action:async()=>{var e,a;await((a=(e=t()).action)==null?void 0:a.call(e,t().data))},children:(e,a)=>{g(e,{lang:"en",children:(n,i)=>{S(n,{})},$$slots:{default:!0}})},$$slots:{default:!0}})},M={title:"COMPONENTS/<Game>"},{Story:o}=T();var N=L("<!> <!> <!>",1);function _(s,t){y(t,!1),h(),w();var e=N(),a=G(e);o(a,{name:"component (loadingScreen)",children:($,R)=>{g($,{lang:"en",children:(u,q)=>{S(u,{})},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<undefined {...args}>
   <StoryLocale lang="en">
<Game />
</StoryLocale>
 </undefined>`}}});var n=d(a,2);const i=p(()=>m({skipLoadingScreen:!0,data:{},action:async()=>{await B.enhancedBoard.preSpin({paddingBoard:H.paddingReels[x.gameType]})}}));o(n,{name:"preSpin",get args(){return c(i)},template:l,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var f=d(n,2);const v=p(()=>m({skipLoadingScreen:!0,data:{},action:async()=>{O.broadcast({type:"boardHide"})}}));o(f,{name:"emitterEvent: boardHide",get args(){return c(v)},template:l,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}}),E(s,e),P()}_.__docgen={data:[],name:"ComponentsGame.stories.svelte"};const r=k(_,M),F=["ComponentLoadingScreen","PreSpin","EmitterEventBoardHide"],I={...r.ComponentLoadingScreen,tags:["svelte-csf-v5"]},J={...r.PreSpin,tags:["svelte-csf-v5"]},K={...r.EmitterEventBoardHide,tags:["svelte-csf-v5"]};export{I as ComponentLoadingScreen,K as EmitterEventBoardHide,J as PreSpin,F as __namedExportsOrder,M as default};
