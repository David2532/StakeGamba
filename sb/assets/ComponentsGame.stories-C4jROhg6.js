import{p as u,t as y,f as G,s as d,n as k,g as c,d as p,a as C,b as E}from"./iframe-BSFTehXB.js";import{c as P,s as h,i as w,d as T,S as g,a as b,b as B,e as H,f as x,g as I}from"./create-runtime-stories-DTjEnsM2.js";import{G as S,t as l}from"./Game-0tCe3pNC.js";import"./_commonjsHelpers-Cpj98o6Y.js";const m=(s,a=k)=>{b(s,{get skipLoadingScreen(){return a().skipLoadingScreen},action:async()=>{var e,n;await((n=(e=a()).action)==null?void 0:n.call(e,a().data))},children:(e,n)=>{g(e,{lang:"en",children:(t,i)=>{S(t,{get skipInitialLoadingScreen(){return a().skipLoadingScreen}})},$$slots:{default:!0}})},$$slots:{default:!0}})},O={title:"COMPONENTS/<Game>"},{Story:o}=T();var M=y("<!> <!> <!>",1);function _(s,a){u(a,!1),h(),w();var e=M(),n=G(e);o(n,{name:"component (loadingScreen)",children:(v,N)=>{g(v,{lang:"en",children:($,R)=>{S($,{})},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<undefined {...args}>
   <StoryLocale lang="en">
<Game />
</StoryLocale>
 </undefined>`}}});var t=d(n,2);const i=p(()=>l({skipLoadingScreen:!0,data:{},action:async()=>{await B.enhancedBoard.preSpin({paddingBoard:H.paddingReels[x.gameType]})}}));o(t,{name:"preSpin",get args(){return c(i)},template:m,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game skipInitialLoadingScreen={args.skipLoadingScreen} />
	</StoryLocale>
</StoryGameTemplate>`}}});var f=d(t,2);const L=p(()=>l({skipLoadingScreen:!0,data:{},action:async()=>{I.broadcast({type:"boardHide"})}}));o(f,{name:"emitterEvent: boardHide",get args(){return c(L)},template:m,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game skipInitialLoadingScreen={args.skipLoadingScreen} />
	</StoryLocale>
</StoryGameTemplate>`}}}),C(s,e),E()}_.__docgen={data:[],name:"ComponentsGame.stories.svelte"};const r=P(_,O),z=["ComponentLoadingScreen","PreSpin","EmitterEventBoardHide"],F={...r.ComponentLoadingScreen,tags:["svelte-csf-v5"]},J={...r.PreSpin,tags:["svelte-csf-v5"]},K={...r.EmitterEventBoardHide,tags:["svelte-csf-v5"]};export{F as ComponentLoadingScreen,K as EmitterEventBoardHide,J as PreSpin,z as __namedExportsOrder,O as default};
