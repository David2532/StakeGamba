import{p as y,t as L,f as G,s as d,n as C,g as c,a as E,b as P,d as p}from"./iframe-_E5BIpMK.js";import{c as k,i as h,d as w,S as g,a as T}from"./create-runtime-stories-BnI1IGu5.js";import{s as B,G as S,t as m}from"./Game-C7pbc9dd.js";import{s as H,c as b,a as x,e as O}from"./Symbol-DRG7F6bu.js";import"./_commonjsHelpers-Cpj98o6Y.js";const l=(o,t=C)=>{T(o,{get skipLoadingScreen(){return t().skipLoadingScreen},action:async()=>{var e,a;await((a=(e=t()).action)==null?void 0:a.call(e,t().data))},children:(e,a)=>{g(e,{lang:"en",children:(n,i)=>{S(n,{})},$$slots:{default:!0}})},$$slots:{default:!0}})},M={title:"COMPONENTS/<Game>"},{Story:s}=w();var N=L("<!> <!> <!>",1);function _(o,t){y(t,!1),B(),h();var e=N(),a=G(e);s(a,{name:"component (loadingScreen)",children:($,R)=>{g($,{lang:"en",children:(u,q)=>{S(u,{})},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<undefined {...args}>
   <StoryLocale lang="en">
<Game />
</StoryLocale>
 </undefined>`}}});var n=d(a,2);const i=p(()=>m({skipLoadingScreen:!0,data:{},action:async()=>{await H.enhancedBoard.preSpin({paddingBoard:b.paddingReels[x.gameType]})}}));s(n,{name:"preSpin",get args(){return c(i)},template:l,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var f=d(n,2);const v=p(()=>m({skipLoadingScreen:!0,data:{},action:async()=>{O.broadcast({type:"boardHide"})}}));s(f,{name:"emitterEvent: boardHide",get args(){return c(v)},template:l,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}}),E(o,e),P()}_.__docgen={data:[],name:"ComponentsGame.stories.svelte"};const r=k(_,M),I=["ComponentLoadingScreen","PreSpin","EmitterEventBoardHide"],J={...r.ComponentLoadingScreen,tags:["svelte-csf-v5"]},K={...r.PreSpin,tags:["svelte-csf-v5"]},Q={...r.EmitterEventBoardHide,tags:["svelte-csf-v5"]};export{J as ComponentLoadingScreen,Q as EmitterEventBoardHide,K as PreSpin,I as __namedExportsOrder,M as default};
